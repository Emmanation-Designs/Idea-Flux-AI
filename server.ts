import express from "express";
import path from "path";
import OpenAI from "openai";
import dotenv from "dotenv";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import crypto from "crypto";

// Import Vite types only for type checking
import type { ViteDevServer } from "vite";

console.log("Server script starting...");
dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({
  verify: (req: any, res, buf) => {
    if (req.originalUrl.startsWith('/api/stripe/webhook')) {
      req.rawBody = buf;
    }
  }
}));

// Global request logger
app.use((req, res, next) => {
  if (process.env.NODE_ENV !== 'production') {
    console.log(`${req.method} ${req.url}`);
  }
  next();
});

// Health check
app.get("/api/health", (req, res) => {
  res.json({ 
    status: "ok", 
    hasOpenAIApiKey: !!process.env.OPENAI_API_KEY,
    hasTavilyApiKey: !!process.env.TAVILY_API_KEY,
    environment: process.env.VERCEL ? 'vercel' : 'local'
  });
});

// API routes
app.all("/api/proxy-image", async (req, res) => {
  const imageUrl = (req.method === "POST" ? req.body.url : (req.query.url || req.body.url)) as string;
  if (!imageUrl) return res.status(400).send("URL is required");

  try {
    const response = await fetch(imageUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    });
    if (!response.ok) {
      console.warn(`[Proxy Image] Failed to fetch image (Status ${response.status}) for URL: ${imageUrl.substring(0, 150)}`);
      return res.status(response.status || 500).send(`Failed to proxy image: Status ${response.status}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    res.setHeader("Content-Type", response.headers.get("Content-Type") || "image/png");
    res.setHeader("Content-Disposition", `attachment; filename="image.png"`);
    res.send(buffer);
  } catch (error: any) {
    console.warn(`[Proxy Image] Connection error while fetching URL: ${imageUrl.substring(0, 150)} - Message: ${error?.message || error}`);
    res.status(500).send("Failed to proxy image due to connection/SSL error");
  }
});

app.post("/api/generate", async (req, res) => {
  return handleGenerate(req, res);
});

// Stripe Checkout Route
app.post("/api/stripe/checkout", async (req, res) => {
  try {
    const { plan, interval, userId } = req.body;
    const origin = req.headers.origin || "https://trelvixai.com";

    if (!userId) return res.status(400).json({ error: 'User ID is required' });
    if (!plan || !interval) return res.status(400).json({ error: 'Plan and interval are required' });

    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      console.error('[Stripe] Missing STRIPE_SECRET_KEY');
      return res.status(500).json({ error: 'Server configuration error: Missing Stripe Secret Key' });
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2023-10-16' as any,
    });

    const proMonthly = process.env.STRIPE_PRO_MONTHLY_PRICE_ID;
    const proYearly = process.env.STRIPE_PRO_YEARLY_PRICE_ID;
    const plusMonthly = process.env.STRIPE_PLUS_MONTHLY_PRICE_ID;
    const plusYearly = process.env.STRIPE_PLUS_YEARLY_PRICE_ID;

    let priceId = '';
    if (plan === 'pro') {
      priceId = interval === 'year' ? proYearly || '' : proMonthly || '';
    } else if (plan === 'plus') {
      priceId = interval === 'year' ? plusYearly || '' : plusMonthly || '';
    }

    if (!priceId) {
      const errorMsg = `No Price ID configured for plan: ${plan}, interval: ${interval}`;
      console.error(`[Stripe] ${errorMsg}`);
      return res.status(400).json({ error: errorMsg });
    }

    if (priceId.startsWith('prod_')) {
      const errorMsg = `Environment variable for ${plan} ${interval} contains a Product ID (${priceId}) instead of a Price ID (price_...). Please update your environment variables.`;
      console.error(`[Stripe] ${errorMsg}`);
      return res.status(400).json({ error: errorMsg });
    }

    console.log(`[Stripe] Creating checkout session for user:${userId}, plan:${plan}, price:${priceId}`);

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: `${origin}/settings?success=true`,
      cancel_url: `${origin}/settings`,
      client_reference_id: userId,
      metadata: { userId, plan, interval },
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
    });

    res.json({ url: session.url });
  } catch (error: any) {
    console.error('[Stripe Checkout Error]:', error);
    res.status(500).json({ 
      error: error.message || 'An error occurred during Stripe checkout creation',
      code: error.code || 'checkout_error'
    });
  }
});

// Stripe Webhook Route
app.post("/api/stripe/webhook", async (req: any, res) => {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2023-10-16' as any,
  });

  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !webhookSecret) {
    console.error('[Stripe Webhook] Missing signature or secret');
    return res.status(400).send('Webhook Error: Missing signature or secret');
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(req.rawBody, sig, webhookSecret);
  } catch (err: any) {
    console.error(`[Stripe Webhook Signature Error]: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log(`[Stripe Webhook] Received event: ${event.type}`);

  if (event.type === 'checkout.session.completed' || event.type === 'invoice.paid') {
    const session = event.data.object as any;
    
    // For checkout.session.completed, we use client_reference_id
    // For invoice.paid, we might need to look up the sub or use metadata if passed
    const userId = session.client_reference_id || session.metadata?.userId;
    const plan = session.metadata?.plan;
    const interval = session.metadata?.interval;

    if (userId && (plan || event.type === 'invoice.paid')) {
      const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "https://wxezfzhhzlauggufecmm.supabase.co";
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind4ZXpmemhoemxhdWdndWZlY21tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyNTQxMjcsImV4cCI6MjA4OTgzMDEyN30.2nsDSFhOtm1Xs3RuZNDo74jGbBwd05E7lPP-FN5cd1Q";
      const supabase = createClient(
        supabaseUrl,
        supabaseServiceKey
      );

      // If it's just a renewal (invoice.paid), we might not have plan in metadata 
      // depends on how Stripe propagates metadata to invoices (it usually doesn't by default without subscription_data.metadata)
      
      let updateData: any = {
        subscription_expires_at: new Date(Date.now() + (interval === 'year' ? 366 : 31) * 24 * 60 * 60 * 1000).toISOString(),
        last_usage_reset: new Date().toISOString().split('T')[0]
      };

      if (plan) {
        updateData.plan = plan;
      }

      console.log(`[Stripe Webhook] Updating profile for user:${userId}`, updateData);

      const { error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', userId);

      if (error) {
        console.error(`[Stripe Webhook] Supabase update error:`, error);
        return res.status(500).send('Internal server error updating profile');
      }
    }
  }

  res.json({ received: true });
});

// Support legacy endpoint
app.post("/api/chat", async (req, res) => {
  return handleGenerate(req, res);
});

// Guard in case any unhandled error or mismatch in /api/ routes occurs
app.use("/api", (req, res, next) => {
  res.status(404).json({ error: `API endpoint ${req.method} ${req.originalUrl} not found`, type: "not_found" });
});

// Global error handler for robust JSON error reporting
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("[Server Error Handler] Unhandled exception:", err);
  if (req.path.startsWith("/api")) {
    return res.status(err.status || 500).json({
      error: err.message || "Internal server error occurred.",
      type: "internal_error"
    });
  }
  next(err);
});

async function appendReplyToConversation(
  conversationId: string, 
  replyMessage: any, 
  userId?: string, 
  conversationType?: string, 
  previousMessages?: any[]
) {
  if (!conversationId) return;
  try {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "https://wxezfzhhzlauggufecmm.supabase.co";
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind4ZXpmemhoemxhdWdndWZlY21tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyNTQxMjcsImV4cCI6MjA4OTgzMDEyN30.2nsDSFhOtm1Xs3RuZNDo74jGbBwd05E7lPP-FN5cd1Q";
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    // Select the existing messages
    const { data: conv, error: fetchErr } = await supabase
      .from('conversations')
      .select('messages')
      .eq('id', conversationId)
      .single();

    if (fetchErr || !conv) {
      if (fetchErr && fetchErr.code === 'PGRST116' && userId) {
        console.log(`[Server DB] Conversation ${conversationId} not found, creating from fallback...`);
        const initialMessages = previousMessages ? [...previousMessages] : [];
        if (!initialMessages.some(m => m.id === replyMessage.id)) {
          initialMessages.push(replyMessage);
        }
        let titleText = 'New Conversation';
        if (previousMessages && previousMessages.length > 0) {
          titleText = previousMessages[0].content || 'New Conversation';
        } else if (replyMessage && replyMessage.content) {
          titleText = replyMessage.content;
        }
        if (titleText.length > 50) {
          titleText = titleText.slice(0, 48) + '...';
        }

        const newConv = {
          id: conversationId,
          user_id: userId,
          title: titleText,
          type: conversationType || 'general',
          messages: initialMessages,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        const { error: insertErr } = await supabase
          .from('conversations')
          .insert(newConv);

        if (insertErr) {
          console.error(`[Server DB] Error inserting conversation on fallback:`, insertErr);
        } else {
          console.log(`[Server DB] Created conversation ${conversationId} during fallback flow successfully.`);
        }
        return;
      }

      console.error(`[Server DB] Failed to fetch conversation ${conversationId}:`, fetchErr);
      return;
    }

    const currentMessages = conv.messages || [];
    // Only append if the last message in DB is NOT already an assistant reply
    const hasAssisReply = currentMessages.length > 0 && currentMessages[currentMessages.length - 1].role === 'assistant';
    if (!hasAssisReply) {
      const updatedMessages = [...currentMessages, replyMessage];
      const { error: updateErr } = await supabase
        .from('conversations')
        .update({
          messages: updatedMessages,
          updated_at: new Date().toISOString()
        })
        .eq('id', conversationId);

      if (updateErr) {
        console.error(`[Server DB] Failed to update conversation ${conversationId}:`, updateErr);
      } else {
        console.log(`[Server DB] Successfully appended reply to conversation ${conversationId} on backend`);
      }
    } else {
      console.log(`[Server DB] Response already persisted in conversation ${conversationId}, skipping server append.`);
    }
  } catch (err) {
    console.error("[Server DB] Error inside appendReplyToConversation:", err);
  }
}

async function handleGenerate(req: express.Request, res: express.Response) {
  const { type, prompt, messages = [], voice_option = "alloy", ready_to_copy = false, personality = "creative", model = "trelvix-mini" } = req.body;

  const needsWebSearch = (text: string) => {
    const searchKeywords = [
      "news", "weather", "price", "today", "latest", "current", "2024", "2025", "2026",
      "politics", "who is", "what happened", "stock", "dollar", "usd", "ngn", "naira",
      "exchange rate", "score", "match", "result", "live", "now", "crypto",
      "happening", "event", "bitcoin", "forecast", "market", "president", 
      "how much is", "price of", "time in", "update on", "current time", "inflation",
      "election", "winner of", "standings in", "scheduled for", "rate in", "worth in",
      "who won", "yesterday", "tonight", "who is currently", "latest on"
    ];
    const lower = text.toLowerCase();
    
    // Force search for financial symbols or currency pairs
    const financialForce = /\b(usd|ngn|eur|gbp|btc|eth|sol)\b/i.test(lower) && 
                          (lower.includes("rate") || lower.includes("price") || lower.includes("worth") || lower.includes("value") || lower.includes("to") || lower.includes("convert"));

    const dateForce = lower.includes("2024") || lower.includes("2025") || lower.includes("2026") || lower.includes("today") || lower.includes("current");

    return financialForce || dateForce || searchKeywords.some(k => lower.includes(k)) || 
           (lower.includes("?") && (lower.includes("who") || lower.includes("how much") || lower.includes("is there") || lower.includes("what happened")));
  };

  console.log(`[Generate] Model: ${model}, Type: ${type}, Personality: ${personality}, Prompt length: ${prompt?.length || 0}`);

  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error("[Generate] Missing OPENAI_API_KEY");
      return res.status(500).json({ error: "OpenAI API Key is missing in server environment" });
    }

    const openai = new OpenAI({ apiKey });

    // 0. Intelligence Controller: Determine the best engine based on intent
    const lastMessageContent = (messages[messages.length - 1]?.content || prompt || "").trim();
    
    // Stricter image intent detection: must start with or specifically request an image
    const lowerLast = lastMessageContent.toLowerCase();
    const isImageIntent = type === "image" || model === "trelvix-visual" || 
                         (lowerLast.startsWith("generate image") || 
                          lowerLast.startsWith("create image") || 
                          lowerLast.startsWith("draw") || 
                          lowerLast.startsWith("make an image") ||
                          lowerLast.startsWith("paint") ||
                          lowerLast.includes("generate a photorealistic image") ||
                          lowerLast.includes("show me an image of"));
    
    const searchRequired = needsWebSearch(lastMessageContent) && !isImageIntent;

    // Strict Tiered Selection Logic (Prioritizing Client Request + Server Detection)
    let realModel = "gpt-4o-mini";
    let currentBranding = "Standard Intelligence";

    if (isImageIntent || model === "trelvix-visual") {
      realModel = "gpt-4o"; 
      currentBranding = "Visual Engine";
    } else if (model === "trelvix-ultra") {
      realModel = "gpt-4o"; 
      currentBranding = "Ultra Intelligence";
    } else if (searchRequired) {
      realModel = "gpt-4o-mini";
      currentBranding = "Standard Intelligence";
    }

    console.log(`[Intelligence Controller] Intent: ${type}, Search: ${searchRequired}, Selection: ${currentBranding}`);

    // Helper for Tavily Search
    const searchWeb = async (query: string) => {
      const tavilyKey = process.env.TAVILY_API_KEY;
      
      console.log(`[Search] Initiating Global Search for: ${query}`);
      if (tavilyKey) {
        console.log(`[Search] Using Tavily Key: ${tavilyKey.substring(0, 4)}...`);
      } else {
        console.error(`[Search] ERROR: No TAVILY_API_KEY found in process.env`);
      }
      
      try {
        // 1. Primary engine: Tavily (if key available)
        if (tavilyKey) {
          console.log(`[Search] Calling Tavily API for query: "${query}"`);
          const response = await fetch("https://api.tavily.com/search", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              api_key: tavilyKey,
              query,
              search_depth: "advanced",
              include_answer: true,
              max_results: 8
            })
          });
          
          if (response.ok) {
            const data = await response.json();
            console.log(`[Search] Tavily response received. Results count: ${data.results?.length || 0}`);
            if (data.results && data.results.length > 0) {
              const results = data.results.map((r: any) => ({
                title: r.title,
                url: r.url,
                snippet: r.content
              }));
              return `SOURCE_DATA:\n${JSON.stringify(results)}\nSUMMARY: ${data.answer || "Real-time data retrieved."}`;
            } else {
              console.warn(`[Search] Tavily returned no results for query: "${query}"`);
            }
          } else {
            const errorText = await response.text();
            console.error(`[Search] Tavily API failed: ${response.status} ${response.statusText}`, errorText);
          }
        }

        // 2. Fallback Engine: Rapid Information Lookup
        console.warn("[Search] Primary search failed or unavailable, using fallback lookup.");
        return `SEARCH_SYSTEM_STATUS: LIMITED_ACCESS. The AI is currently operating with pre-trained data only for this turn due to search connectivity issues. If the query requires ultra-precise real-time metrics (like live stock prices at this exact second), provide the best available estimate and note the limitation.`;

      } catch (err) {
        console.error("[Search] Critical Search Error:", err);
        return "SEARCH_SYSTEM_OFFLINE. Connectivity logic failed to resolve. Proceed with internal data and model capabilities.";
      }
    };



    // 1. Image Generation
    if (type === "image" || isImageIntent) {
      let promptText = req.body.prompt || req.body.message || prompt || "a beautiful image";

      console.log("[Image Generation] Original prompt length:", promptText.length);

      // Conversational multi-turn image description synthesis using GPT-4o-mini
      if (messages && messages.length > 1) {
        try {
          console.log(`[Image Generation] Multi-message context detected (Count: ${messages.length}). Synthesizing cohesive, cumulative image prompt...`);
          const promptSynthesisConversation = [
            {
              role: "system",
              content: "You are the Trelvix Prompt Synthesizer. Your job is to read a conversation history between a user and an AI image assistant, and synthesize a single, detailed, highly descriptive image prompt for DALL-E (the image generator) that incorporates all cumulative details, revisions, adjustments, corrections, elements, and style instructions requested from the entire conversation. Output ONLY the raw final image description prompt. Do not add any conversational text, pleasantries, or explanations. Do not say things like 'Here is the revised prompt'. Produce a single paragraph description of the scene that perfectly captures the latest desired state, preserving the details of the original request except where the user explicitly asked to change them."
            },
            ...messages.filter((m: any) => m.role === 'user' || m.role === 'assistant').map((m: any) => ({
              role: m.role,
              content: m.content || ""
            }))
          ];

          const synthesisResponse = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: promptSynthesisConversation as any,
            max_tokens: 350,
            temperature: 0.7
          });

          const synthesizedPrompt = synthesisResponse.choices[0]?.message?.content?.trim();
          if (synthesizedPrompt) {
            console.log("[Image Generation] Synthesized Prompt from History:", synthesizedPrompt);
            promptText = synthesizedPrompt;
          }
        } catch (synthesisError) {
          console.error("[Image Generation] Prompt synthesis failed, fallback to original prompt:", synthesisError);
        }
      }

      // Auto-truncate extremely long prompts safely to prevent OpenAI API size limit failures (max 2000 chars)
      if (promptText.length > 2000) {
        console.log(`[Image Generation] Truncating client prompt from ${promptText.length} to 2000 chars to prevent API failures.`);
        promptText = promptText.substring(0, 2000) + "...";
      }

      // Append strong realism instructions
      const fullPrompt = promptText + ". photorealistic, highly detailed, realistic photography, sharp focus, natural lighting, 8k resolution, professional quality, accurate anatomy, cinematic lighting";

      let response;
      let modelUsed = "gpt-image-2";
      let base64Image = "";

      const extractImage = (resObj: any) => {
        const item = resObj?.data?.[0];
        if (item?.b64_json) {
          return item.b64_json.startsWith("data:") ? item.b64_json : `data:image/png;base64,${item.b64_json}`;
        }
        if (item?.url) {
          return item.url;
        }
        return "";
      };

      const imageSpeed = req.body.image_speed || "quality";
      console.log(`[Image Generation] Requested engine speed: ${imageSpeed}`);

      if (imageSpeed === "fast") {
        try {
          console.log("[Image Generation] Fast Mode: Attempting generation with gpt-image-1 for turbo speed (typically < 3 seconds)...");
          response = await openai.images.generate({
            model: "gpt-image-1",
            prompt: promptText, // cleaner prompt to increase generation speed
            size: "1024x1024",
            n: 1,
          });
          const extracted = extractImage(response);
          if (extracted) {
            base64Image = extracted;
            modelUsed = "gpt-image-1 (turbo fast)";
          }
        } catch (fastErr: any) {
          console.warn("[Image Generation] Fast Mode gpt-image-1 bypassed, trying gpt-image-2 fast-standard...", fastErr?.message || fastErr);
          try {
            response = await openai.images.generate({
              model: "gpt-image-2",
              prompt: fullPrompt,
              quality: "standard", // 3x faster than HD/auto quality!
              size: "1024x1024",
              n: 1,
            });
            const extracted = extractImage(response);
            if (extracted) {
              base64Image = extracted;
              modelUsed = "gpt-image-2 (fast-standard)";
            }
          } catch (fastErr2: any) {
            console.error("[Image Generation] Fast modes failed, falling back to quality pipeline:", fastErr2?.message || fastErr2);
          }
        }
      }

      if (!base64Image) {
        try {
          console.log("[Image Generation] Attempting generation with primary model gpt-image-2 (quality: auto)...");
          response = await openai.images.generate({
            model: "gpt-image-2",
            prompt: fullPrompt,
            quality: "auto",
            size: "1024x1024",
            n: 1,
          });
          const extracted = extractImage(response);
          if (!extracted) {
            throw new Error("No image returned from gpt-image-2");
          }
          base64Image = extracted;
          modelUsed = "gpt-image-2 (auto)";
        } catch (err2: any) {
          console.warn(`[Image Generation] Primary model gpt-image-2 failure: ${err2?.message || err2}. Retrying with minimal params for gpt-image-2...`);
          try {
            response = await openai.images.generate({
              model: "gpt-image-2",
              prompt: fullPrompt,
            });
            const extracted = extractImage(response);
            if (!extracted) {
              throw new Error("No image returned from gpt-image-2 minimal");
            }
            base64Image = extracted;
            modelUsed = "gpt-image-2 (minimal)";
          } catch (err2Minimal: any) {
            console.warn(`[Image Generation] gpt-image-2 failed completely: ${err2Minimal?.message || err2Minimal}. Invoking fallback gpt-image-1...`);
            try {
              console.log("[Image Generation] Attempting fallback generation with gpt-image-1 (quality: auto)...");
              response = await openai.images.generate({
                model: "gpt-image-1",
                prompt: fullPrompt,
                quality: "auto",
                size: "1024x1024",
                n: 1,
              });
              const extracted = extractImage(response);
            if (!extracted) {
              throw new Error("No image returned from fallback gpt-image-1");
            }
            base64Image = extracted;
            modelUsed = "gpt-image-1 (fallback auto)";
          } catch (err1: any) {
            console.warn(`[Image Generation] Fallback gpt-image-1 auto configuration failed: ${err1?.message || err1}. Trying gpt-image-1 with minimal config...`);
            try {
              response = await openai.images.generate({
                model: "gpt-image-1",
                prompt: fullPrompt,
              });
              const extracted = extractImage(response);
              if (!extracted) {
                throw new Error("No image returned from fallback gpt-image-1 minimal");
              }
              base64Image = extracted;
              modelUsed = "gpt-image-1 (fallback minimal)";
            } catch (errAll: any) {
              console.error("[Image Generation] All image generation models failed:", errAll?.message || errAll);
              throw new Error(errAll?.message || "Failed to generate image with any model.");
            }
          }
        }
      }
    }

      // We skip heavy synchronous download and base64 parsing on the main thread.
      // Returning the direct OpenAI CDN URL allows the client to load and render the image INSTANTLY!
      // The client's background auto-migration scanner will lazily heal/migrate compile history safely.
      console.log(`[Image] Img generated via ${modelUsed} responding immediately with direct CDN URL to maximize throughput speed.`);

      if (req.body.conversationId && req.body.userId) {
        (async () => {
          try {
            const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "https://wxezfzhhzlauggufecmm.supabase.co";
            const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind4ZXpmemhoemxhdWdndWZlY21tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyNTQxMjcsImV4cCI6MjA4OTgzMDEyN30.2nsDSFhOtm1Xs3RuZNDo74jGbBwd05E7lPP-FN5cd1Q";
            
            const supabase = createClient(supabaseUrl, supabaseServiceKey);
            const { data: imageData, error: imgError } = await supabase.from('images').insert({
                user_id: req.body.userId,
                prompt: promptText,
                image_url: base64Image
              }).select().single();

              const assistantMessage = {
                id: crypto.randomUUID(),
                role: 'assistant',
                content: "Here is your generated image:",
                image_url: imageData ? `db:${imageData.id}` : base64Image,
                filename: `trelvix-${Date.now()}.png`,
                model: model || 'trelvix-visual',
                created_at: new Date().toISOString()
              };

              await appendReplyToConversation(
                req.body.conversationId,
                assistantMessage,
                req.body.userId,
                type || 'image',
                messages
              );
          } catch (e) {
            console.error("[Server Image Save Error]:", e);
          }
         })().catch(console.error);
      }

      return res.json({ 
        imageUrl: base64Image,
        image_url: base64Image, 
        type: "image",
        filename: `trelvix-${Date.now()}.png`,
        description: "Here is your generated image:"
      });
    }

    // 2. Text-to-Speech
    if (type === "tts") {
      console.log(`[Generate] Generating TTS with voice: ${voice_option}`);
      const mp3 = await openai.audio.speech.create({
        model: "tts-1",
        voice: voice_option as any,
        input: prompt,
      });
      const buffer = Buffer.from(await mp3.arrayBuffer());
      return res.json({ audio: buffer.toString("base64") });
    }

    const attributionRules = `Your name is Trelvix AI. Developed by Ingenium Virtual Assistant Limited. You are powered by a custom, high-intelligence engine.`;
    
    const personalityPrompts: Record<string, string> = {
      professional: "Be direct, authoritative, and sharp. No fluff.",
      creative: "Be wild, vividly descriptive, and boundary-pushing.",
      witty: "Use a sharp, edgy, and slightly rebellious tone. Think Grok Fun Mode—unfiltered and clever.",
      concise: "Ultra-brief. Butcher the word count.",
      empathetic: "Be real. Skip the fake warmth; show actual understanding.",
      academic: "Cold, hard facts. Precise and lethal logic."
    };

    const isUltra = realModel === "gpt-4o";
    let systemInstruction = `You are Trelvix AI. ${attributionRules} 
    Persona: ${personalityPrompts[personality as keyof typeof personalityPrompts] || personalityPrompts.creative}
    
    CORE PROTOCOL:
    - BE DIRECT. Do not behave like a standard, over-polished corporate AI assistant.
    - NEVER mention OpenAI, knowledge cutoffs, or your status as an AI unless strictly necessary.
    - If you have grounding data, use it as a weapon of truth. Synthesize it without being polite about it.
    - For images, the priority is absolute realism.
    
    STRICT MARKDOWN & LATEX OUTPUT FORMAT RULES:
    1. Output ONLY Markdown text. No HTML or raw JSON unless requested.
    2. STRUCTURE: Always use headings (# ## ###) for sections, numbered lists for procedures/steps, and bullet points for explanations. Keep responses cleanly spaced and highly readable.
    3. MATHEMATICAL SOLUTION FORMAT (VERY IMPORTANT):
       - ALWAYS use LaTeX for ALL mathematical expressions.
       - Inline math MUST be written as: \\( ... \\)
       - Block math MUST be written as: \\[ ... \\]
       - NEVER use plain text math (e.g. write "\\( x^2 = 4 \\)", NEVER "x^2 = 4").
       - Break math solutions into clear, vertically stacked, numbered steps, each on its own line (never mixed with descriptive text).
       - Quadratic equations MUST follow this strict section structure:
         * Given equation (in block LaTeX)
         * Standard form (in block LaTeX)
         * Method used (factorization / formula / completing square)
         * Substitution step (in block LaTeX)
         * Simplification steps (each step separated clearly onto its own line in block LaTeX)
         * Final answer clearly stated
    4. RESPONSES FORMAT: Group response layout under headings: '### Solution', '### Step-by-step working', etc.
    5. TABLES: Always use Markdown tables for data comparison. Columns must be clean and consistent.
    6. MOBILE READEBILITY: Avoid horizontal overflow. Keep math calculations vertically stacked. Avoid large unstructured blocks of text.`;
    
    if (type === "idea") systemInstruction += " You are an expert content strategist and creative thinker. Help users brainstorm unique and impactful ideas.";
    else if (type === "script") systemInstruction += " You are a professional scriptwriter for video, stage, and screen. Write engaging and well-structured scripts.";
    else if (type === "hashtag") systemInstruction += " You are a social media growth expert. Generate trending and relevant hashtags.";

    const openAiMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: "system", content: systemInstruction },
      ...messages.map((m: any) => {
        if (m.role === 'user' && m.image_url && m.image_url.startsWith('data:')) {
          return {
            role: "user",
            content: [
              { type: "text", text: m.content || "Analyze this image." },
              { type: "image_url", image_url: { url: m.image_url } }
            ]
          } as OpenAI.Chat.Completions.ChatCompletionUserMessageParam;
        }
        return { role: m.role, content: m.content || "" };
      })
    ];

    // --- Grounding Logic ---
    if (isUltra && (searchRequired || model === "trelvix-ultra")) {
      const queryToSearch = lastMessageContent;
      console.log(`[Generate] Action: Scaling to Ultra Grounding for: ${queryToSearch.substring(0, 50)}...`);
      const searchData = await searchWeb(queryToSearch);
      
      const isFallback = searchData.includes("SEARCH_SYSTEM_STATUS") || searchData.includes("SEARCH_SYSTEM_OFFLINE");
      
      // Inject Grounding Data as a High-Priority Instruction
      const groundingBlock = {
        role: "system",
        content: `[VERIFIED REAL-TIME CONTEXT]\n${searchData}\n\nINSTRUCTION: Synthesize this data into the ultimate response. Use citations for all metrics, facts, or dates. If the data indicates a fallback, provide the most plausible answer while noting the live data stream is currently being refreshed.`
      } as const;

      // Insert grounding data right after the system prompt for maximum attention
      openAiMessages.splice(1, 0, groundingBlock);
    }

    console.log(`[Generate] Final Grounded Stream starting... Model: ${currentBranding}`);
    const stream = await openai.chat.completions.create({
      model: realModel, 
      messages: openAiMessages,
      stream: true,
      temperature: 0.7,
      max_tokens: 4000,
    });

    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Transfer-Encoding", "chunked");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    let accumulatedText = "";
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || "";
      if (content) {
        accumulatedText += content;
        if (!res.writableEnded) {
          res.write(content);
        }
      }
    }
    
    console.log(`[Generate] Grounded stream completed successfully`);
    res.end();

    if (req.body.conversationId) {
      const assistantMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: accumulatedText,
        model: model,
        created_at: new Date().toISOString()
      };
      appendReplyToConversation(
        req.body.conversationId,
        assistantMessage,
        req.body.userId,
        type || 'chat',
        messages
      ).catch(console.error);
    }
  } catch (error: any) {
    console.error("[Generate] Internal Error:", error);
    
    // Attempt to return a clean JSON error if possible
    if (!res.headersSent) {
      res.status(error.status || 500).json({ 
        error: error.message || "An unexpected error occurred during generation",
        type: 'internal_error'
      });
    } else {
      // If we already started streaming, we can't change the status code
      res.write(`\n\n[Error: ${error.message || "Stream interrupted"}]`);
      res.end();
    }
  }
}

export default app;

// Server startup logic
const hasBuiltDist = fs.existsSync(path.join(process.cwd(), "dist", "index.html"));

if ((process.env.NODE_ENV !== "production" || !hasBuiltDist) && !process.env.VERCEL) {
  const startServer = async () => {
    console.log(`[Server] Starting Vite DevServer middleware. (hasBuiltDist: ${hasBuiltDist}, NODE_ENV: ${process.env.NODE_ENV})`);
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Development server running on http://localhost:${PORT} (Vite mode)`);
    });
  };
  startServer();
} else if (!process.env.VERCEL) {
  // Static serving for production (non-Vercel)
  const distPath = path.join(process.cwd(), "dist");
  console.log(`[Server] Starting static file server at: ${distPath}`);
  app.use(express.static(distPath));
  app.get("*", (req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Production server running on port ${PORT}`);
  });
}
