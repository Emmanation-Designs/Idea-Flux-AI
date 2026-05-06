import express from "express";
import path from "path";
import OpenAI from "openai";
import dotenv from "dotenv";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

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
    const response = await fetch(imageUrl);
    if (!response.ok) throw new Error("Failed to fetch image");
    
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    res.setHeader("Content-Type", response.headers.get("Content-Type") || "image/png");
    res.setHeader("Content-Disposition", `attachment; filename="image.png"`);
    res.send(buffer);
  } catch (error) {
    console.error("Proxy error:", error);
    res.status(500).send("Failed to proxy image");
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

async function handleGenerate(req: express.Request, res: express.Response) {
  const { type, prompt, messages = [], voice_option = "alloy", ready_to_copy = false, personality = "professional", model = "gpt-4o" } = req.body;

  const needsWebSearch = (text: string) => {
    const searchKeywords = [
      "news", "weather", "price", "today", "latest", "current", 
      "politics", "who is", "what happened", "stock", "dollar", 
      "exchange rate", "score", "match", "result", "live", "now",
      "happening", "event", "crypto", "bitcoin", "forecast", "naira",
      "rate", "market", "president", "minister", "ceo", "launch", "release date",
      "how much is", "price of", "time in", "update on", "current time", "inflation",
      "election", "winner of", "standings in", "scheduled for"
    ];
    const lower = text.toLowerCase();
    return searchKeywords.some(k => lower.includes(k)) || 
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
    const lastMessageContent = messages[messages.length - 1]?.content || prompt || "";
    const isImageIntent = type === "image" || (lastMessageContent.toLowerCase().includes("generate") && 
                         (lastMessageContent.toLowerCase().includes("image") || 
                          lastMessageContent.toLowerCase().includes("picture") || 
                          lastMessageContent.toLowerCase().includes("photo")));
    
    const searchRequired = needsWebSearch(lastMessageContent) && !isImageIntent;

    // Strict Tiered Selection Logic
    let realModel = "gpt-4o-mini";
    let currentBranding = "GPT-4.0 Mini";

    if (isImageIntent) {
      realModel = "gpt-4o"; 
      currentBranding = "GPT-Image 2.0";
    } else if (searchRequired) {
      realModel = "gpt-4o"; 
      currentBranding = "GPT-5.4 Ultra";
    } else {
      realModel = "gpt-4o-mini"; 
      currentBranding = "GPT-4.0 Mini";
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
            if (data.results && data.results.length > 0) {
              const results = data.results.map((r: any) => ({
                title: r.title,
                url: r.url,
                snippet: r.content
              }));
              return `SOURCE_DATA:\n${JSON.stringify(results)}\nSUMMARY: ${data.answer || "Real-time data retrieved."}`;
            }
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



    // 1. Image Generation (GPT-Image 2.0 Engine)
    if (type === "image") {
      let enhancedPrompt = prompt;
      const lowerPrompt = prompt.toLowerCase();
      
      // Keywords for detecting categories
      const isLogo = lowerPrompt.includes("logo") || lowerPrompt.includes("icon") || lowerPrompt.includes("brand mark");
      const isPoster = lowerPrompt.includes("flyer") || lowerPrompt.includes("poster") || lowerPrompt.includes("commercial") || lowerPrompt.includes("advertisement");
      const isPeople = lowerPrompt.includes("man") || lowerPrompt.includes("woman") || lowerPrompt.includes("person") || lowerPrompt.includes("people") || lowerPrompt.includes("face") || lowerPrompt.includes("portrait") || lowerPrompt.includes("girl") || lowerPrompt.includes("boy") || lowerPrompt.includes("human");
      const isArtisticRequested = lowerPrompt.includes("artistic") || lowerPrompt.includes("illustration") || lowerPrompt.includes("silhouette") || lowerPrompt.includes("drawing") || lowerPrompt.includes("painting") || lowerPrompt.includes("sketch") || lowerPrompt.includes("cartoon") || lowerPrompt.includes("anime") || lowerPrompt.includes("3d") || lowerPrompt.includes("cgi") || lowerPrompt.includes("render");

      // Core Realism Stack (Requested by user for maximum quality)
      const coreRealism = "photorealistic, highly detailed, realistic photography, sharp focus, natural lighting, 8k resolution, professional quality, accurate anatomy, realistic skin texture, cinematic lighting";

      if (isLogo) {
        enhancedPrompt = `Professional minimalist logo, high-end graphic design, clean vector lines, high resolution, solid background, masterpiece, professional typography. Subject: ${prompt}`;
      } else if (isPoster) {
        const designKeywords = "highly detailed, sharp focus, professional graphic design, balanced composition, high-end typography, commercial aesthetic";
        enhancedPrompt = `${designKeywords}, ${isArtisticRequested ? "artistic style" : "photographic style"}. Subject: ${prompt}`;
      } else if (isPeople) {
        const portraitKeywords = "realistic human face, detailed eyes, natural expression, realistic skin micro-textures, individual hair strands, shot on 85mm lens, f/1.8, bokeh background";
        enhancedPrompt = `${coreRealism}, ${portraitKeywords}. Subject: ${prompt}`;
      } else if (isArtisticRequested) {
        enhancedPrompt = `Magical realism, masterpiece, highly detailed artistic rendering, fine art quality, vibrant and atmospheric. Subject: ${prompt}`;
      } else {
        // Default to extreme realism for everything else
        enhancedPrompt = `${coreRealism}, shot on professional DSLR, incredibly detailed texture, lifelike atmosphere, professional color grading. Subject: ${prompt}`;
      }

      console.log(`[Generate] Action: Scaling to GPT-Image 2.0 for PHOTOREALISTIC rendering`);
      console.log(`[Generate] Model: DALL-E 3 | Quality: HD | Style: Natural`);
      console.log(`[Generate] Final Prompt: ${enhancedPrompt.substring(0, 100)}...`);
      
      const response = await openai.images.generate({
        model: "dall-e-3",
        prompt: enhancedPrompt,
        n: 1,
        size: "1024x1024",
        quality: "hd",
        style: "natural", 
        response_format: "b64_json"
      });

      const base64 = `data:image/png;base64,${response.data[0].b64_json}`;
      console.log(`[Generate] Image generated successfully (HD Quality)`);
      
      const confirmationMsg = `I've generated this high-fidelity image using GPT-Image 2.0 (DALL-E 3 HD). I applied photorealistic rendering to ensure professional quality and accurate details.`;

      return res.json({ 
        image_url: base64, 
        filename: `trelvix-${Date.now()}.png`,
        description: confirmationMsg
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

    // 3. Chat / Idea / Script / Content Overhaul
    const activeEngine = searchRequired ? "GPT-5.4 Ultra" : "GPT-4.0 Mini";
    const attributionRules = `Your name is Trelvix AI. Developed by Ingenium Virtual Assistant Limited (www.ingeniumvirtualassistant.com). Powered by ${activeEngine}.`;
    
    const personalityPrompts: Record<string, string> = {
      professional: "Maintain a professional, clear, and authoritative tone. Be efficient and highly accurate.",
      creative: "Be highly imaginative, descriptive, and expressive. Use vivid language and think outside the box.",
      witty: "Use a humorous, slightly sarcastic, and engaging tone. Be clever and entertaining while remaining helpful.",
      concise: "Be extremely brief and to the point. Provide information efficiently without unnecessary detail.",
      empathetic: "Be warm, supportive, and understanding. Use a kind tone and show genuine care in your responses.",
      academic: "Use a formal, detailed, and technical tone. Provide in-depth explanations and maintain high intellectual rigor."
    };

    let systemInstruction = `You are Trelvix AI, a high-performance AI toolkit. ${attributionRules} 
    Personality: ${personalityPrompts[personality as keyof typeof personalityPrompts] || personalityPrompts.professional}
    Always prioritize professionalism, creativity, and accuracy. 
    When users request images, you prioritize extreme photographic realism and photorealistic details unless artistic styles are explicitly requested.
    
    CRITICAL: You have access to real-time search data provided in your context. 
    Always provide deep citations and sources for information retrieved from the web.
    If search data is provided, synthesize it perfectly into your response. Do not repeat that you are searching. Just provide the answer.`;
    
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

    // --- GPT-5.4 Ultra Pre-flight Search Logic ---
    if (searchRequired) {
      console.log(`[Generate] Action: Scaling to GPT-5.4 Ultra for Real-time Web Search`);
      console.log(`[Generate] Model: GPT-5.4 Ultra | Task: Real-time Web Search`);
      console.log(`[Generate] Web search required for: "${lastMessageContent.substring(0, 50)}..."`);
      const searchData = await searchWeb(lastMessageContent);
      
      const isFallback = searchData.includes("Search fallback");
      if (isFallback) {
        console.warn(`[Generate] Search WARNING: Using fallback mode (check TAVILY_API_KEY)`);
      } else {
        console.log(`[Generate] Search SUCCESS: Grounding data retrieved successfully`);
      }

      openAiMessages.push({
        role: "system",
        content: `REAL_TIME_GROUNDING_DATA:\n${searchData}\n\nStrictly use the data above to answer the user's query with citations. If the search failed (indicated by a fallback message in the grounding data), mention that your live browsing is currently limited but give the best answer possible using your internal knowledge.`
      });
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
if (process.env.NODE_ENV !== "production" && !process.env.VERCEL) {
  const startServer = async () => {
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
  app.use(express.static(distPath));
  app.get("*", (req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Production server running on port ${PORT}`);
  });
}
