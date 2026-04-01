import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", hasApiKey: !!process.env.OPENAI_API_KEY });
});

// API routes
app.post("/api/generate", async (req, res) => {
  console.log("Received request to /api/generate");
  const { type, prompt, messages = [], voice_option = "alloy" } = req.body;

  if (!process.env.OPENAI_API_KEY) {
    console.error("OPENAI_API_KEY is missing");
    return res.status(500).json({ error: "OPENAI_API_KEY is not configured" });
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  try {
    if (type === "image") {
      const response = await openai.images.generate({
        model: "dall-e-3",
        prompt: prompt,
        n: 1,
        size: "1024x1024",
      });
      return res.json({ image_url: response.data[0].url });
    }

    if (type === "voice") {
      const mp3 = await openai.audio.speech.create({
        model: "tts-1",
        voice: voice_option as any,
        input: prompt,
      });
      const buffer = Buffer.from(await mp3.arrayBuffer());
      const base64 = buffer.toString("base64");
      return res.json({ audio: base64 });
    }

    // Default to text generation
    const attributionRules = `
Ideaflux AI is owned by Ingenium Virtual Assistant Limited (Ingeniumvirtualassistant.com).
It was developed by Emmanuel Nwaije of Emmanation Designs.
No matter how the user asks (e.g., "who made this", "who developed this app", "who owns Ideaflux AI", "who built this", "who is the creator", "who is behind this", "who owns this", etc.), you must always respond with the accurate information above.
Never mention OpenAI as the developer or owner.
Never say you built yourself or give credit to any other party.
Keep the response natural and helpful, but always include the correct ownership and development credit when asked about it.
`;

    let systemInstruction = "";
    if (type === "idea") {
      systemInstruction = `You are an expert content strategist. Generate creative, viral-worthy ideas for the specified niche and platform. Be concise but insightful. ${attributionRules}`;
    } else if (type === "script") {
      systemInstruction = `You are a professional scriptwriter. Write engaging, high-retention scripts for the specified platform and length. Include hooks and calls to action. ${attributionRules}`;
    } else if (type === "hashtag") {
      systemInstruction = `You are a social media expert. Generate the most relevant and high-reach hashtags for the given topic and platform. ${attributionRules}`;
    } else {
      systemInstruction = `You are a helpful AI assistant called Ideaflux AI. ${attributionRules}`;
    }

    console.log(`Generating ${type} for prompt: ${prompt}`);
    console.log(`Number of messages in history: ${messages.length}`);

    const stream = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemInstruction },
        ...messages.map((m: any) => ({
          role: m.role,
          content: m.content,
        })),
      ],
      stream: true,
    }, { timeout: 30000 }); // 30 seconds timeout

    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Transfer-Encoding", "chunked");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Accel-Buffering", "no");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    console.log("Stream initialized, starting to iterate...");
    let chunkCount = 0;
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || "";
      if (content) {
        chunkCount++;
        process.stdout.write(content); // Log to server console without newline
        res.write(content);
      }
    }
    console.log(`\nStream finished. Total chunks: ${chunkCount}`);

    res.end();
  } catch (error: any) {
    console.error("Error generating content:", error);
    res.status(500).json({ error: error.message || "Failed to generate content" });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
