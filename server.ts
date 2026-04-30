import express from "express";
import path from "path";
import OpenAI from "openai";
import dotenv from "dotenv";

// Import Vite types only for type checking
import type { ViteDevServer } from "vite";

console.log("Server script starting...");
dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());

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

// Support legacy endpoint
app.post("/api/chat", async (req, res) => {
  return handleGenerate(req, res);
});

async function handleGenerate(req: express.Request, res: express.Response) {
  const { type, prompt, messages = [], voice_option = "alloy", ready_to_copy = false } = req.body;

  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "OpenAI API Key is missing in server environment" });
    }

    const openai = new OpenAI({ apiKey });

    if (type === "image") {
      let enhancedPrompt = prompt;
      const isLogo = prompt.toLowerCase().includes("logo");
      const isFlyer = prompt.toLowerCase().includes("flyer") || prompt.toLowerCase().includes("poster");

      if (isLogo) {
        enhancedPrompt = `${prompt}, clean vector logo, professional, minimalist, high resolution, white background`;
      } else if (isFlyer) {
        enhancedPrompt = `${prompt}, professional graphic design, modern layout, vibrant colors, high resolution, sharp focus`;
      } else {
        enhancedPrompt = `${prompt}, highly realistic, photorealistic, detailed, sharp focus, natural lighting, 8k resolution, cinematic lighting`;
      }

      const response = await openai.images.generate({
        model: "dall-e-3",
        prompt: enhancedPrompt,
        n: 1,
        size: "1024x1024",
      });

      const imageUrl = response.data[0].url;
      if (!imageUrl) throw new Error("No image URL generated");

      // Fetch the image and convert to base64
      const imgFetch = await fetch(imageUrl);
      if (!imgFetch.ok) throw new Error(`Failed to fetch generated image`);
      
      const arrayBuffer = await imgFetch.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const base64 = `data:${imgFetch.headers.get("content-type") || "image/png"};base64,${buffer.toString("base64")}`;

      return res.json({ image_url: base64 });
    }

    if (type === "tts") {
      const mp3 = await openai.audio.speech.create({
        model: "tts-1",
        voice: voice_option as any,
        input: prompt,
      });
      const buffer = Buffer.from(await mp3.arrayBuffer());
      return res.json({ audio: buffer.toString("base64") });
    }

    // Role instructions
    const attributionRules = `Your name is Trelvix AI. Developed by Ingenium Virtual Assistant Limited (www.ingeniumvirtualassistant.com).`;
    
    let systemInstruction = `You are Trelvix AI. ${attributionRules}`;
    if (type === "idea") systemInstruction += " You are an expert content strategist.";
    else if (type === "script") systemInstruction += " You are a professional scriptwriter.";
    else if (type === "hashtag") systemInstruction += " You are a social media expert.";

    const stream = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemInstruction },
        ...messages.map((m: any) => ({
          role: m.role,
          content: m.content,
        }))
      ],
      stream: true,
    });

    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Transfer-Encoding", "chunked");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || "";
      if (content) res.write(content);
    }
    res.end();
  } catch (error: any) {
    console.error("AI Error:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message || "Failed to generate content" });
    } else {
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
