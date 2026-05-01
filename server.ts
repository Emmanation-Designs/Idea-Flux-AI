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
    if (!userId) return res.status(400).json({ error: 'User ID is required' });

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2024-06-20' as any,
    });

    let priceId = '';
    if (plan === 'pro') {
      priceId = interval === 'year' 
        ? process.env.STRIPE_PRO_YEARLY_PRICE_ID! 
        : process.env.STRIPE_PRO_MONTHLY_PRICE_ID!;
    } else if (plan === 'plus') {
      priceId = interval === 'year' 
        ? process.env.STRIPE_PLUS_YEARLY_PRICE_ID! 
        : process.env.STRIPE_PLUS_MONTHLY_PRICE_ID!;
    }

    if (!priceId) return res.status(400).json({ error: 'Invalid plan or interval' });

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: `https://trelvixai.com/settings?success=true`,
      cancel_url: `https://trelvixai.com/settings`,
      client_reference_id: userId,
      metadata: { userId, plan, interval },
    });

    res.json({ url: session.url });
  } catch (error: any) {
    console.error('[Stripe Checkout Error]:', error);
    res.status(500).json({ error: error.message });
  }
});

// Stripe Webhook Route
app.post("/api/stripe/webhook", async (req: any, res) => {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2024-06-20' as any,
  });

  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(req.rawBody, sig!, webhookSecret!);
  } catch (err: any) {
    console.error(`[Webhook Error]: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.client_reference_id || session.metadata?.userId;
    const plan = session.metadata?.plan;
    const interval = session.metadata?.interval;

    if (userId && plan) {
      const supabase = createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      const expiresAt = new Date();
      if (interval === 'year') {
        expiresAt.setFullYear(expiresAt.getFullYear() + 1);
      } else {
        expiresAt.setDate(expiresAt.getDate() + 30);
      }

      await supabase
        .from('profiles')
        .update({
          plan: plan,
          subscription_expires_at: expiresAt.toISOString(),
          last_usage_reset: new Date().toISOString().split('T')[0]
        })
        .eq('id', userId);
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

    console.log(`[Generate] Starting chat completion stream with model gpt-4o-mini`);
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
