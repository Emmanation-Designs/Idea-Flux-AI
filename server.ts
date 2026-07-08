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

// Text to Speech Generation Endpoint
app.post("/api/tools/text-to-speech", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized: Missing session token." });
  }

  const token = authHeader.split(" ")[1];
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "https://wxezfzhhzlauggufecmm.supabase.co";
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind4ZXpmemhoemxhdWdndWZlY21tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyNTQxMjcsImV4cCI6MjA4OTgzMDEyN30.2nsDSFhOtm1Xs3RuZNDo74jGbBwd05E7lPP-FN5cd1Q";
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  let user: any = null;
  try {
    const { data: userData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !userData?.user) {
      return res.status(401).json({ error: "Unauthorized: Invalid session token." });
    }
    user = userData.user;
  } catch (err: any) {
    return res.status(401).json({ error: "Unauthorized: Failed to authenticate token." });
  }

  const { text, voice = "alloy", model = "tts-1", speed = 1.0 } = req.body;
  if (!text || typeof text !== "string" || !text.trim()) {
    return res.status(400).json({ error: "Text payload is required." });
  }

  const characterCount = text.length;

  // 1. Check Subscriptions and Plan Limits
  let allowed = true;
  let reason = "";
  let hasDatabaseTracking = false;

  try {
    const { data: checkData, error: checkError } = await supabase.rpc("can_generate_tts", {
      user_uuid: user.id,
      requested_character_count: characterCount
    });

    if (!checkError && checkData && checkData.length > 0) {
      allowed = checkData[0].allowed;
      reason = checkData[0].reason;
      hasDatabaseTracking = true;
    } else {
      console.warn("[TTS Backend] RPC can_generate_tts failed or not present:", checkError?.message);
    }
  } catch (err: any) {
    console.warn("[TTS Backend] can_generate_tts RPC exception:", err?.message || err);
  }

  // 2. Client-Side Fallback if SQL function/limits table is absent
  if (!hasDatabaseTracking) {
    console.log("[TTS Backend] Falling back to programmatic schema and limits check...");
    let plan = "free";
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("plan")
        .eq("id", user.id)
        .single();
      if (profile?.plan) {
        plan = profile.plan;
      }
    } catch (profileErr) {
      console.warn("[TTS Backend] Failed to retrieve user plan:", profileErr);
    }

    const PLAN_LIMITS_FALLBACK = {
      free: { maxGens: 3, maxChars: 2000, unlimited: false },
      pro: { maxGens: Infinity, maxChars: 10000, unlimited: true },
      plus: { maxGens: Infinity, maxChars: 50000, unlimited: true }
    };

    const currentLimits = PLAN_LIMITS_FALLBACK[plan as "free" | "pro" | "plus"] || PLAN_LIMITS_FALLBACK.free;

    if (characterCount > currentLimits.maxChars) {
      allowed = false;
      reason = `Requested length of ${characterCount} characters exceeds the limit of ${currentLimits.maxChars} per generation on your ${plan.toUpperCase()} subscription.`;
    } else if (!currentLimits.unlimited) {
      try {
        const todayStr = new Date().toISOString().split("T")[0];
        const { count, error: countErr } = await supabase
          .from("tts_generations")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id)
          .gte("created_at", `${todayStr}T00:00:00Z`)
          .neq("generation_status", "failed");

        if (!countErr && count !== null) {
          if (count >= currentLimits.maxGens) {
            allowed = false;
            reason = `Daily generation threshold (${currentLimits.maxGens} requests) reached on your ${plan.toUpperCase()} subscription tier.`;
          }
          hasDatabaseTracking = true;
        }
      } catch (countErr) {
        console.warn("[TTS Backend] Fallback generations query failed:", countErr);
      }
    } else {
      // Pro/Plus with unlimited count, character count already within limit
      allowed = true;
    }
  }

  if (!allowed) {
    return res.status(403).json({ error: reason || "Daily quota limit reached." });
  }

  // 3. Insert Pending Track Log
  let generationId: string | null = null;
  try {
    const { data: genLog, error: insertErr } = await supabase
      .from("tts_generations")
      .insert({
        user_id: user.id,
        character_count: characterCount,
        selected_voice: voice,
        selected_model: model,
        generation_status: "pending",
        provider: "openai",
        metadata: {
          text_snippet: text.slice(0, 80) + (text.length > 80 ? "..." : "")
        }
      })
      .select("id")
      .single();

    if (!insertErr && genLog) {
      generationId = genLog.id;
    }
  } catch (insertErr) {
    console.warn("[TTS Backend] Failed to write initial tracking record:", insertErr);
  }

  // 4. Initialize OpenAI and Synthesize Speech
  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (!openaiApiKey) {
    console.error("[TTS Backend] Missing OPENAI_API_KEY in environment");
    return res.status(500).json({ error: "OpenAI API Key is missing in server configuration." });
  }

  const openai = new OpenAI({ apiKey: openaiApiKey });
  const startTime = Date.now();

  try {
    console.log(`[TTS Backend] Requesting audio from OpenAI. Voice: ${voice}, Model: ${model}, Length: ${characterCount}`);
    const openaiResponse = await openai.audio.speech.create({
      model: model === "tts-1-hd" ? "tts-1-hd" : "tts-1",
      voice: voice as any,
      input: text,
      speed: speed || 1.0
    });

    const buffer = Buffer.from(await openaiResponse.arrayBuffer());
    const durationMs = Date.now() - startTime;

    // 5. Update Log to Completed & Persist Base64 for history retrieval
    if (generationId) {
      try {
        await supabase
          .from("tts_generations")
          .update({
            generation_status: "completed",
            generation_time_ms: durationMs,
            file_size_bytes: buffer.length,
            metadata: {
              text_snippet: text.slice(0, 80) + (text.length > 80 ? "..." : ""),
              audio_base64: buffer.toString("base64")
            }
          })
          .eq("id", generationId);
      } catch (updateErr) {
        console.warn("[TTS Backend] Failed to update tracking log to completed:", updateErr);
      }
    }

    // 6. Respond with streaming binary audio file
    res.set({
      "Content-Type": "audio/mpeg",
      "Content-Length": buffer.length,
      "Accept-Ranges": "bytes"
    });
    return res.send(buffer);
  } catch (openaiErr: any) {
    console.error("[TTS Backend] OpenAI Synthesis Error:", openaiErr);
    if (generationId) {
      try {
        await supabase
          .from("tts_generations")
          .update({ generation_status: "failed" })
          .eq("id", generationId);
      } catch (logErr) {
        console.warn("[TTS Backend] Failed to mark track as failed:", logErr);
      }
    }
    return res.status(520).json({ error: openaiErr?.message || "Failed to generate speech audio." });
  }
});

// Retrieve generated past audio from tracking database
app.get("/api/tools/text-to-speech/retrieve/:id", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized: Missing session token." });
  }

  const token = authHeader.split(" ")[1];
  const { id } = req.params;

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "https://wxezfzhhzlauggufecmm.supabase.co";
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind4ZXpmemhoemxhdWdndWZlY21tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyNTQxMjcsImV4cCI6MjA4OTgzMDEyN30.2nsDSFhOtm1Xs3RuZNDo74jGbBwd05E7lPP-FN5cd1Q";
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { data: userData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !userData?.user) {
      return res.status(401).json({ error: "Unauthorized: Invalid session token." });
    }

    const { data: genLog, error: fetchErr } = await supabase
      .from("tts_generations")
      .select("metadata")
      .eq("id", id)
      .eq("user_id", userData.user.id)
      .single();

    if (fetchErr || !genLog || !genLog.metadata?.audio_base64) {
      return res.status(404).json({ error: "Audio record or playback data not found." });
    }

    const buffer = Buffer.from(genLog.metadata.audio_base64, "base64");
    res.set({
      "Content-Type": "audio/mpeg",
      "Content-Length": buffer.length
    });
    return res.send(buffer);
  } catch (err: any) {
    console.error("[TTS Backend] Retrieve track exception:", err?.message || err);
    return res.status(500).json({ error: err?.message || "Failed to retrieve past audio track." });
  }
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
      if (fetchErr && fetchErr.code === 'PGRST116') {
        const targetUserId = userId || null;
        console.log(`[Server DB] Conversation ${conversationId} not found, attempting creating from fallback (userId: ${targetUserId})...`);
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
          user_id: targetUserId,
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
          console.warn(`[Server DB] Could not insert fallback conversation: ${insertErr.message}`);
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
    
    // Comprehensive document/file exclusion list to prevent false positive image generation triggers
    const docExclusionFilter = /\b(pdf|docx|xlsx|word|excel|spreadsheet|csv|document|resume|report|cv|curriculum\s*vitae|invoice|presentation|budget|letter|email|cover\s*letter|essay|article|post|text|contract|agreement|outline|syllabus|proposal|workbook|chart|table|schema|blueprint|database)\b/i;

    // Stricter image intent detection: must start with or specifically request an image, or edit an uploaded image
    const lowerLast = lastMessageContent.toLowerCase();
    const fileHasImage = (messages || []).some((m: any) => m.image_url && m.image_url.startsWith("data:image"));
    const isImageIntent = (type === "image" || model === "trelvix-visual" || 
                          (lowerLast.startsWith("generate image") || 
                           lowerLast.startsWith("create image") || 
                           lowerLast.startsWith("draw") || 
                           lowerLast.startsWith("make an image") || 
                           lowerLast.startsWith("paint") || 
                           lowerLast.includes("generate a photorealistic image") || 
                           lowerLast.includes("show me an image of") ||
                           (fileHasImage && /edit|modify|change|more professional|add text|similar style|re-create|recreate/i.test(lowerLast)))) &&
                          !docExclusionFilter.test(lowerLast);
    
    // Explicitly detect if the user wants to compile a document, CV, layout, text sheet or report
    const isDocRequest = docExclusionFilter.test(lastMessageContent);

    const searchRequired = needsWebSearch(lastMessageContent) && !isImageIntent;

    // Strict Tiered Selection Logic (Prioritizing Client Request + Server Detection)
    let realModel = "gpt-4o-mini";
    let currentBranding = "Standard Intelligence";

    if (isImageIntent || model === "trelvix-visual") {
      realModel = "gpt-4o"; 
      currentBranding = "Visual Engine";
    } else if (model === "trelvix-ultra" || isDocRequest) {
      // Force gpt-4o for all document/resume/PDF compile requests to ensure correct JSON outputs
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
      // Set headers for chunked rendering to prevent gateway timeouts on long image runs
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Transfer-Encoding", "chunked");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      // Write an initial space chunk immediately to flush headers and wake the browser connection
      res.write(" ");

      // Space heartbeat generator - writes a single space byte every 2 seconds to keep the Cloud Run / Vercel gateway active
      const keepAliveInterval = setInterval(() => {
        try {
          if (!res.writableEnded) {
            res.write(" ");
          }
        } catch (e) {
          console.warn("[Keep-Alive] Failed to write heartbeat space chunk:", e);
        }
      }, 2000);

      try {
        let promptText = req.body.prompt || req.body.message || prompt || "a beautiful image";

        console.log("[Image Generation] Original prompt length:", promptText.length);

        // Vision-Guided Image Description & Editing Synthesis (when user has uploaded an image)
        const messagesWithImage = (messages || []).filter((m: any) => m.image_url && m.image_url.startsWith("data:image"));
        const lastImageMessage = messagesWithImage[messagesWithImage.length - 1];

        if (lastImageMessage) {
          console.log("[Image Generation] Uploaded image detected. Utilizing Vision-Guided Image Description & Editing Synthesis (GPT-4o) to merge original visual contents with user edits...");
          try {
            const visionResponse = await openai.chat.completions.create({
              model: "gpt-4o",
              messages: [
                {
                  role: "system",
                  content: `You are the Trelvix Vision & Image Synthesis Director. A user has uploaded an image and wants to edit, vary, style, or generate a similar image based on it. 
Your job is to look at the user's uploaded image and their editing instructions, and synthesize a single, highly detailed, photorealistic prompt for DALL-E (gpt-image-2 / gpt-image-1) that describes the entire final edited image in perfect English.
To make it look like an edit or variation of the input image:
1. Analyze the original image's style (oil painting, sketch, realist photograph, digital art, logo design, flat design, etc.), subject, composition, background, color theme, and camera perspective in vivid detail to maintain visual continuity.
2. Incorporate the user's editing/modifying instructions perfectly (e.g. adding text, altering clothes, swapping backgrounds, introducing new objects, making it more professional, or generating a similar style).
3. Combine both into a cohesive, highly descriptive paragraph of the desired target image.
4. Output ONLY the raw final image description prompt. Do not add any conversational text, explanations, or pleasantries.`
                },
                {
                  role: "user",
                  content: [
                    { type: "text", text: `User request/modifications: "${promptText}"` },
                    { type: "image_url", image_url: { url: lastImageMessage.image_url } }
                  ]
                }
              ],
              max_tokens: 350,
              temperature: 0.7
            });

            const synthesizedPrompt = visionResponse.choices[0]?.message?.content?.trim();
            if (synthesizedPrompt) {
              console.log("[Image Generation] Synthesized Vision-Guided prompt:", synthesizedPrompt);
              promptText = synthesizedPrompt;
            }
          } catch (visionErr) {
            console.error("[Image Generation] Vision-Guided prompt synthesis failed, falling back to conversational text synthesis:", visionErr);
            
            // Fallback to text-only synthesis if vision API fails
            if (messages && messages.length > 1) {
              try {
                console.log(`[Image Generation] Multi-message context fallback (Count: ${messages.length}). Synthesizing cohesive, cumulative image prompt...`);
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
                console.error("[Image Generation] Fallback prompt synthesis failed:", synthesisError);
              }
            }
          }
        } else {
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

        clearInterval(keepAliveInterval);
        res.write(JSON.stringify({ 
          imageUrl: base64Image,
          image_url: base64Image, 
          type: "image",
          filename: `trelvix-${Date.now()}.png`,
          description: "Here is your generated image:"
        }));
        res.end();
        return;
      } catch (err: any) {
        clearInterval(keepAliveInterval);
        console.error("[Image Generation] Error in pipeline:", err);
        if (!res.writableEnded) {
          res.write(JSON.stringify({ error: err.message || "Failed to generate image" }));
          res.end();
        }
        return;
      }
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
    - CRITICAL DIRECTIVE: You have a built-in Client-Side Document & Spreadsheet Compiler! You CAN create, compile, and generate physical files (PDFs, Microsoft Word documents, and Excel worksheets). NEVER claim, refuse, or apologize that you cannot "create", "generate", "export", or "write" physical files or download sheets directly. Always enthusiastically comply, write the requested text or preview, and end with the exact \`json-file-data\` code block so the frontend compiler can construct the actual download for the user. This is a crucial, native feature of your platform.
    
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
    6. MOBILE READEBILITY: Avoid horizontal overflow. Keep math calculations vertically stacked. Avoid large unstructured blocks of text.
    
    7. FILE GENERATION & EXPORT PROTOCOL (PDF, WORD, EXCEL):
       - When a user asks you to create, write, design, generate, edit, or adjust a PDF document (.pdf), Microsoft Word document (.docx), or Excel spreadsheet (.xlsx) (such as reports, letters, resumes, invoices, budgets, logs, data workbooks, tables), you MUST:
         a. Write a highly detailed, professional, and visually structured conversational markdown response containing the full draft preview of the requested document or spreadsheet.
         b. At the very end of your response, write exactly one code block with the language label \`json-file-data\` (i.e. \`\`\`json-file-data ... \`\`\`) containing the complete, valid structured JSON configuration of the document or spreadsheet so that the frontend compiler can construct the download. Do NOT wrap this block in other code types or formatting. Do NOT omit it.
         
         The schema for the JSON within the \`\`\`json-file-data block MUST look exactly like this:
         {
           "fileType": "pdf" | "docx" | "xlsx",
           "fileName": "clean-snake-case-file-name",
           "title": "Main Title of the Document / Sheet",
           "subtitle": "Optional Brief Subtitle",
           "author": "Trelvix AI",
           "sections": [
             {
               "heading": "Section Heading Title",
               "type": "text" | "bullet" | "table",
               "paragraphs": ["Detailed text paragraph..."],
               "bullets": ["Bullet point list item..."],
               "headers": ["Column 1", "Column 2", "Column 3"],
               "rows": [
                 ["Row 1 Col 1", "Row 1 Col 2", "Row 1 Col 3"],
                 ["Row 2 Col 1", "Row 2 Col 2", "Row 2 Col 3"]
               ]
             }
           ],
           "spreadsheet": {
             "sheets": [
               {
                 "name": "Sheet Name (max 31 chars)",
                 "rows": [
                   ["Category", "Budgeted", "Actual", "Variance"],
                   ["Row 1 A", "Value 1", "Value 2", "Value 3"]
                 ]
               }
             ]
           }
         }
         
         Instruction: Only include the "spreadsheet" key when compiling an xlsx file or sheet tables. For PDF and DOCX, use the standard sections formatting. Always provide both the human-readable markdown response and this structured JSON-data block so the user gets both an on-screen preview and a functional, professional physical file download!`;
    
    if (type === "idea") systemInstruction += " You are an expert content strategist and creative thinker. Help users brainstorm unique and impactful ideas.";
    else if (type === "script") systemInstruction += " You are a professional scriptwriter for video, stage, and screen. Write engaging and well-structured scripts.";
    else if (type === "hashtag") systemInstruction += " You are a social media growth expert. Generate trending and relevant hashtags.";

    if (isDocRequest) {
      systemInstruction += `\n\nCRITICAL DIRECTIVE: The user is explicitly asking for a CV, resume, document, spreadsheet, or physical file (such as a PDF, Word .docx, or Excel .xlsx). 
Because you are integrated with our custom client-side file compiler, YOU ABSOLUTELY CAN AND MUST GENERATE AND EMIT THIS FILE!
- NEVER refuse, say you cannot write/create/compile files, or suggest standard tools like Word/Google Docs.
- Say "Sure, I have generated the file" and display a beautiful preview formatting for it in markdown.
- At the absolute end of your response, write exactly one code block with label \`\`\`json-file-data ... \`\`\` containing the full correct JSON configuration (with fileType, fileName, title, sections, etc.) as detailed in rule #7 above. Our compiler will automatically detect this and render actual [Download PDF], [Download Word], and [Download Excel] buttons so the user can download the real physical file!`;
    }

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

    // Deep analysis of general document intent to overcome any pre-trained LLM refusal tendencies
    if (isDocRequest) {
      console.log(`[Generate] Activating maximum document compiler reinforcement for: "${lastMessageContent.substring(0, 40)}..."`);
      openAiMessages.push({
        role: "system",
        content: `CRITICAL ACTION REQUIRED:
The user wants a CV, resume, document, spreadsheet, or physical file.
Because you are integrated with our custom frontend compiler, YOU CAN and MUST create the file!
- Do NOT apologize, claim that you cannot generate files, or tell the user to use visual processors.
- Provide a clean, elegant preview in your markdown output.
- Print a single, valid, correctly formulated \`\`\`json-file-data ... \`\`\` code block at the absolute end of your response. This block is parsed by the custom UI compiler to compile a download button for the user automatically.
- Do NOT wrap this block inside another block, and don't omit it.`
      });
    }

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
      console.log(`Development server running on http://localhost:${PORT}`);
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
