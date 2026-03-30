import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

app.use(express.json());

// API routes
app.post("/api/generate", async (req, res) => {
  const { type, prompt, messages = [] } = req.body;

  try {
    let systemInstruction = "";
    if (type === "idea") {
      systemInstruction = "You are an expert content strategist. Generate creative, viral-worthy ideas for the specified niche and platform. Be concise but insightful.";
    } else if (type === "script") {
      systemInstruction = "You are a professional scriptwriter. Write engaging, high-retention scripts for the specified platform and length. Include hooks and calls to action.";
    } else if (type === "hashtag") {
      systemInstruction = "You are a social media expert. Generate the most relevant and high-reach hashtags for the given topic and platform.";
    } else {
      systemInstruction = "You are a helpful AI assistant called Ideaflux AI.";
    }

    const contents = messages.map((m: any) => ({
      role: m.role === "user" ? "user" : "model",
      parts: [{ text: m.content }],
    }));

    // Add the current prompt to the contents
    contents.push({
      role: "user",
      parts: [{ text: prompt }],
    });

    const responseStream = await ai.models.generateContentStream({
      model: "gemini-1.5-flash",
      contents,
      config: {
        systemInstruction,
      },
    });

    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Transfer-Encoding", "chunked");

    for await (const chunk of responseStream) {
      if (chunk.text) {
        res.write(chunk.text);
      }
    }

    res.end();
  } catch (error) {
    console.error("Error generating content:", error);
    res.status(500).json({ error: "Failed to generate content" });
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
