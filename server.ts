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
  const { type, prompt, messages = [], voice_option = "alloy", ready_to_copy = false, personality = "professional" } = req.body;

  console.log(`[Generate] Type: ${type}, Personality: ${personality}, Prompt length: ${prompt?.length || 0}`);

  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error("[Generate] Missing OPENAI_API_KEY");
      return res.status(500).json({ error: "OpenAI API Key is missing in server environment" });
    }

    const openai = new OpenAI({ apiKey });

    // Helper for Tavily Search
    const searchTavily = async (query: string) => {
      const tavilyKey = process.env.TAVILY_API_KEY;
      if (!tavilyKey) {
        console.warn("[Search] No TAVILY_API_KEY found");
        return "Search failed: No API key configured.";
      }
      try {
        console.log(`[Search] Query: ${query}`);
        const response = await fetch("https://api.tavily.com/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            api_key: tavilyKey,
            query,
            search_depth: "advanced",
            include_answer: true,
            max_results: 5
          })
        });
        const data = await response.json();
        return JSON.stringify(data.results.map((r: any) => ({
          title: r.title,
          url: r.url,
          content: r.content
        })));
      } catch (err) {
        console.error("[Search] Error:", err);
        return "Search failed due to an error.";
      }
    };

    // 1. Image Generation (DALL-E 3)
    if (type === "image") {
      let enhancedPrompt = prompt;
      const isLogo = prompt.toLowerCase().includes("logo");
      const isFlyer = prompt.toLowerCase().includes("flyer") || prompt.toLowerCase().includes("poster");

      if (isLogo) {
        enhancedPrompt = `${prompt}, clean vector logo, professional, minimalist, high resolution, white background, masterpiece, 4k`;
      } else if (isFlyer) {
        enhancedPrompt = `${prompt}, professional graphic design, modern layout, vibrant colors, high resolution, sharp focus, marketing material`;
      } else {
        enhancedPrompt = `${prompt}, highly realistic, photorealistic, detailed, sharp focus, natural lighting, 8k resolution, cinematic lighting`;
      }

      console.log(`[Generate] Generating image with prompt: ${enhancedPrompt}`);
      const response = await openai.images.generate({
        model: "dall-e-3",
        prompt: enhancedPrompt,
        n: 1,
        size: "1024x1024",
        quality: "hd",
        response_format: "b64_json"
      });

      const base64 = `data:image/png;base64,${response.data[0].b64_json}`;
      console.log(`[Generate] Image generated successfully`);
      return res.json({ image_url: base64, filename: `trelvix-${Date.now()}.png` });
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

    // 3. Chat / Idea / Script / Content
    const attributionRules = `Your name is Trelvix AI. Developed by Ingenium Virtual Assistant Limited (www.ingeniumvirtualassistant.com).`;
    
    const personalityPrompts: Record<string, string> = {
      professional: "Maintain a professional, clear, and direct tone. Be efficient and helpful.",
      creative: "Be highly imaginative, descriptive, and expressive. Use vivid language and think outside the box.",
      witty: "Use a humorous, slightly sarcastic, and engaging tone. Be clever and entertaining while remaining helpful.",
      concise: "Be extremely brief and to the point. Provide information efficiently without unnecessary detail.",
      empathetic: "Be warm, supportive, and understanding. Use a kind tone and show genuine care in your responses.",
      academic: "Use a formal, detailed, and technical tone. Provide in-depth explanations and maintain high intellectual rigor."
    };

    let systemInstruction = `You are Trelvix AI, a high-performance AI toolkit. ${attributionRules} 
    Personality: ${personalityPrompts[personality as keyof typeof personalityPrompts] || personalityPrompts.professional}
    Always prioritize professionalism, creativity, and accuracy.`;
    
    if (type === "idea") systemInstruction += " You are an expert content strategist and creative thinker. Help users brainstorm unique and impactful ideas.";
    else if (type === "script") systemInstruction += " You are a professional scriptwriter for video, stage, and screen. Write engaging and well-structured scripts.";
    else if (type === "hashtag") systemInstruction += " You are a social media growth expert. Generate trending and relevant hashtags.";
    else if (type === "general") systemInstruction += " You are a versatile AI assistant capable of helping with any task.";

    // Convert messages to OpenAI format, handling Vision if an image is in the last user message
    const openAiMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: "system", content: systemInstruction },
      ...messages.map((m: any) => {
        // Handle images in content if present (GPT-4o Vision)
        if (m.role === 'user' && m.image_url && m.image_url.startsWith('data:')) {
          return {
            role: "user",
            content: [
              { type: "text", text: m.content || "Analyze this image." },
              { type: "image_url", image_url: { url: m.image_url } }
            ]
          } as OpenAI.Chat.Completions.ChatCompletionUserMessageParam;
        }
        return {
          role: m.role,
          content: m.content || "",
        };
      })
    ];

    console.log(`[Generate] Starting chat completion with search tools for gpt-4o-mini`);
    
    const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
      {
        type: "function",
        function: {
          name: "search_web",
          description: "Search the internet for real-time, live information, news, and current events.",
          parameters: {
            type: "object",
            properties: {
              query: { type: "string", description: "The search query to look up." }
            },
            required: ["query"]
          }
        }
      }
    ];

    let response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: openAiMessages,
      tools,
      tool_choice: "auto",
    });

    const responseMessage = response.choices[0].message;

    if (responseMessage.tool_calls) {
      console.log(`[Generate] Tool call detected: ${responseMessage.tool_calls[0].function.name}`);
      const toolCalls = responseMessage.tool_calls;
      
      openAiMessages.push(responseMessage);

      for (const toolCall of toolCalls) {
        if (toolCall.function.name === "search_web") {
          const args = JSON.parse(toolCall.function.arguments);
          const searchResult = await searchTavily(args.query);
          
          openAiMessages.push({
            tool_call_id: toolCall.id,
            role: "tool",
            content: searchResult,
          } as any);
        }
      }

      // Second completion with search results
      const finalResponse = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: openAiMessages,
        stream: true,
      });

      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.setHeader("Transfer-Encoding", "chunked");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      for await (const chunk of finalResponse) {
        const content = chunk.choices[0]?.delta?.content || "";
        if (content) res.write(content);
      }
      res.end();
      return;
    }

    // If no tool call, just standard stream
    console.log(`[Generate] No tool call, streaming standard response`);
    const stream = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: openAiMessages,
      stream: true,
      max_tokens: 4000,
    });

    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Transfer-Encoding", "chunked");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || "";
      if (content) {
        res.write(content);
      }
    }
    
    console.log(`[Generate] Stream completed successfully`);
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
