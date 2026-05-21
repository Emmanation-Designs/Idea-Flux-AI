import express from "express";
import path from "path";
import OpenAI from "openai";
import dotenv from "dotenv";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";

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
      const supabase = createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
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

async function handleGenerate(req: express.Request, res: express.Response) {
  const { type, prompt, messages = [], voice_option = "alloy", ready_to_copy = false, personality = "professional", model = "trelvix-mini" } = req.body;

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
      // Optimize and clean prompt
      let basePrompt = (prompt || lastMessageContent || "").trim();
      
      // Limit prompt length for image generation (max 400 characters) for maximum stability
      if (basePrompt.length > 400) {
        basePrompt = basePrompt.substring(0, 400);
      }

      const lowerPrompt = basePrompt.toLowerCase();
      
      const isLogo = lowerPrompt.includes("logo") || lowerPrompt.includes("icon");
      const isPoster = lowerPrompt.includes("flyer") || lowerPrompt.includes("poster") || lowerPrompt.includes("design");
      const isPeople = lowerPrompt.includes("man") || lowerPrompt.includes("woman") || lowerPrompt.includes("person") || lowerPrompt.includes("human") || lowerPrompt.includes("face");
      const isArtisticRequested = lowerPrompt.includes("artistic") || lowerPrompt.includes("illustration") || lowerPrompt.includes("3d") || lowerPrompt.includes("cartoon") || lowerPrompt.includes("painting");

      const coreRealism = "photorealistic, highly detailed, realistic photography, sharp focus, natural lighting, 8k resolution, professional quality, accurate anatomy, cinematic lighting, detailed skin texture";
      const designBoost = "professional design, custom typography, clean lines, high contrast";

      let finalPrompt = basePrompt;

      if (isLogo) {
        finalPrompt = `Professional minimalist logo, high-end graphic design, vector style, white background. ${designBoost}. Subject: ${basePrompt}`;
      } else if (isPoster) {
        finalPrompt = `Highly detailed professional graphic design, poster aesthetic, ${coreRealism}. ${designBoost}. Subject: ${basePrompt}`;
      } else if (isPeople) {
        finalPrompt = `${coreRealism}, natural features, shot on 85mm lens. Subject: ${basePrompt}`;
      } else if (isArtisticRequested) {
        finalPrompt = `Masterpiece, fine art rendering, highly detailed, ${coreRealism}. Subject: ${basePrompt}`;
      } else {
        finalPrompt = `${coreRealism}, professional photography, lifelike. Subject: ${basePrompt}`;
      }

      console.log(`[Generate] Image generation initiated. Final optimized prompt: "${finalPrompt}"`);

      let generatedBase64: string | null = null;
      const engineUsed = "DALL-E 3 (OpenAI)";

      try {
        console.log(`[Generate] Generating image via DALL-E 3 (OpenAI)...`);
        const response = await openai.images.generate({
          model: "dall-e-3",
          prompt: finalPrompt,
          n: 1,
          size: "1024x1024"
        });

        if (response?.data?.[0]?.b64_json) {
          generatedBase64 = `data:image/png;base64,${response.data[0].b64_json}`;
          console.log(`[Generate] DALL-E 3 image generated successfully (b64_json)`);
        } else if (response?.data?.[0]?.url) {
          const imgUrl = response.data[0].url;
          console.log(`[Generate] DALL-E 3 image URL returned, fetching & converting to Base64...`);
          const imgResp = await fetch(imgUrl);
          if (imgResp.ok) {
            const arrayBuffer = await imgResp.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            const contentType = imgResp.headers.get("content-type") || "image/png";
            generatedBase64 = `data:${contentType};base64,${buffer.toString("base64")}`;
            console.log(`[Generate] Successfully fetched and converted DALL-E 3 image URL to Base64`);
          } else {
            throw new Error(`Failed to fetch generated image from URL (Status ${imgResp.status})`);
          }
        } else {
          throw new Error("Empty representation from DALL-E 3 API");
        }
      } catch (err: any) {
        console.error(`[Generate] DALL-E 3 generation failed:`, err?.message || err);
      }

      if (!generatedBase64) {
        return res.status(200).json({ 
          error: "Failed to generate image. The service is currently busy or rate-limited. Please try again with a simpler description.", 
          type: 'generation_failed' 
        });
      }

      return res.json({ 
        image_url: generatedBase64, 
        filename: `trelvix-${Date.now()}.png`,
        description: `Your image has been generated with maximum realism and cinematic precision using ${engineUsed}.`
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
    Persona: ${personalityPrompts[personality as keyof typeof personalityPrompts] || personalityPrompts.professional}
    
    CORE PROTOCOL:
    - BE DIRECT. Do not behave like a standard, over-polished corporate AI assistant.
    - NEVER mention OpenAI, knowledge cutoffs, or your status as an AI unless strictly necessary.
    - If you have grounding data, use it as a weapon of truth. Synthesize it without being polite about it.
    - For images, the priority is absolute realism.`;
    
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

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || "";
      if (content) res.write(content);
    }
    
    console.log(`[Generate] Grounded stream completed successfully`);
    res.end();
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
