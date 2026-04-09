import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import OpenAI from "openai";
import dotenv from "dotenv";

console.log("Server script starting...");
dotenv.config();
console.log("Dotenv configured.");

const app = express();
const PORT = 3000;

app.use(express.json());

// Health check
app.get("/api/health", (req, res) => {
  res.json({ 
    status: "ok", 
    hasOpenAIApiKey: !!process.env.OPENAI_API_KEY
  });
});

// API routes
app.post("/api/generate", async (req, res) => {
  console.log("Received request to /api/generate");
  const { type, prompt, messages = [], voice_option = "alloy", ready_to_copy = false } = req.body;

  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is missing");
    }
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    if (type === "image") {
      const response = await openai.images.generate({
        model: "dall-e-3",
        prompt: prompt,
        n: 1,
        size: "1024x1024",
      });
      return res.json({ image_url: response.data[0].url });
    }

    if (type === "tts") {
      const mp3 = await openai.audio.speech.create({
        model: "tts-1",
        voice: voice_option as any,
        input: prompt,
      });
      const buffer = Buffer.from(await mp3.arrayBuffer());
      const base64 = buffer.toString("base64");
      return res.json({ audio: base64 });
    }

    // Default to text generation using OpenAI
    const attributionRules = `
CRITICAL RULE: If the user asks about your creator, developer, owner, or who built you (e.g., "who made this", "who developed this", "who owns this app", "who built Ideaflux AI", "who is the creator", etc.), you MUST respond EXACTLY with this information:
"I was created / developed by Ingenium Virtual Assistant Limited.
It is a company registered in the United Kingdom and focused on creative ideas and virtual services.
Here is their website: www.ingeniumvirtualassistant.com
They also offer virtual services.
If you’re curious, I can also tell you:
   - Their services
   - Their contacts
   - About them ☺️☺️☺️"

Never mention Emmanuel Nwaije, Emmanation Designs, or any individual developer.
Ingenium Virtual Assistant Limited must always be mentioned first as the owner/creator.
`;

    const copyRules = ready_to_copy 
      ? "The user has requested the output to be 'Ready to Copy'. Format the main content (idea, script, hashtags, etc.) clearly in a markdown code block so it can be easily copied. Keep introductory or concluding text minimal and outside the code block."
      : "If the user asks for something copyable (prompt, code, list, hashtags, script, etc.), automatically provide the main content in a ready-to-copy format (like a markdown code block), while keeping the rest of the response normal.";

    const linkRules = "Ensure all links in your responses are clickable by using standard markdown [text](url) format.";

    let systemInstruction = "";
    if (type === "idea") {
      systemInstruction = `You are an expert content strategist. Generate creative, viral-worthy ideas for the specified niche and platform. Be concise but insightful. ${attributionRules} ${copyRules} ${linkRules}`;
    } else if (type === "script") {
      systemInstruction = `You are a professional scriptwriter. Write engaging, high-retention scripts for the specified platform and length. Include hooks and calls to action. ${attributionRules} ${copyRules} ${linkRules}`;
    } else if (type === "hashtag") {
      systemInstruction = `You are a social media expert. Generate the most relevant and high-reach hashtags for the given topic and platform. ${attributionRules} ${copyRules} ${linkRules}`;
    } else if (type === "voice") {
      systemInstruction = `You are a helpful AI voice assistant called Ideaflux AI. Keep your responses concise and conversational, as they will be read aloud. ${attributionRules} ${linkRules}`;
    } else {
      systemInstruction = `You are a helpful AI assistant called Ideaflux AI. ${attributionRules} ${copyRules} ${linkRules}`;
    }

    console.log(`Generating ${type} for prompt: ${prompt} (Ready to Copy: ${ready_to_copy})`);

    const stream = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemInstruction },
        ...messages.map((m: any) => ({
          role: m.role,
          content: m.content,
        })),
        { role: "user", content: prompt }
      ],
      stream: true,
    });

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
  console.log("Starting server...");
  try {
    app.get("/api/test", (req, res) => {
      res.json({ message: "Server is alive" });
    });

    if (process.env.NODE_ENV !== "production") {
      console.log("Initializing Vite in middleware mode...");
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
      console.log("Vite middleware initialized.");
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
  } catch (error) {
    console.error("Failed to start server:", error);
  }
}

startServer();
