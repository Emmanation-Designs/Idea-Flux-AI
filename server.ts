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
app.get("/api/proxy-image", async (req, res) => {
  const imageUrl = req.query.url as string;
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
  console.log("Received request to /api/generate");
  const { type, prompt, messages = [], voice_option = "alloy", ready_to_copy = false } = req.body;

  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is missing");
    }
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    if (type === "image") {
      let enhancedPrompt = prompt;
      let filename = "generated-image.png";

      // Detect if it's a logo or flyer
      const isLogo = prompt.toLowerCase().includes("logo");
      const isFlyer = prompt.toLowerCase().includes("flyer") || prompt.toLowerCase().includes("poster");

      if (isLogo) {
        enhancedPrompt = `${prompt}, clean vector logo, professional, minimalist, high resolution, white background`;
        filename = `${prompt.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30)}-logo.png`;
      } else if (isFlyer) {
        enhancedPrompt = `${prompt}, professional graphic design, modern layout, vibrant colors, high resolution, sharp focus`;
        filename = `${prompt.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30)}-flyer.png`;
      } else {
        enhancedPrompt = `${prompt}, highly realistic, photorealistic, detailed, sharp focus, natural lighting, 8k resolution, cinematic lighting, masterpiece`;
        filename = `${prompt.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30)}.png`;
      }

      const response = await openai.images.generate({
        model: "dall-e-3",
        prompt: enhancedPrompt,
        n: 1,
        size: "1024x1024",
        quality: "hd",
      });
      return res.json({ 
        image_url: response.data[0].url,
        filename: filename
      });
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
    const imageRules = "You ARE capable of generating images, logos, and flyers. If the user asks for one, do not say you are unable to. Simply confirm you are generating it and the system will handle the rest.";

    let systemInstruction = "";
    if (type === "idea") {
      systemInstruction = `You are an expert content strategist. Generate creative, viral-worthy ideas for the specified niche and platform. Be concise but insightful. ${attributionRules} ${copyRules} ${linkRules} ${imageRules}`;
    } else if (type === "script") {
      systemInstruction = `You are a professional scriptwriter. Write engaging, high-retention scripts for the specified platform and length. Include hooks and calls to action. ${attributionRules} ${copyRules} ${linkRules} ${imageRules}`;
    } else if (type === "hashtag") {
      systemInstruction = `You are a social media expert. Generate the most relevant and high-reach hashtags for the given topic and platform. ${attributionRules} ${copyRules} ${linkRules} ${imageRules}`;
    } else if (type === "voice") {
      systemInstruction = `You are a helpful AI voice assistant called Ideaflux AI. Keep your responses concise and conversational, as they will be read aloud. ${attributionRules} ${linkRules} ${imageRules}`;
    } else {
      systemInstruction = `You are a helpful AI assistant called Ideaflux AI. ${attributionRules} ${copyRules} ${linkRules} ${imageRules}`;
    }

    console.log(`Generating ${type} for prompt: ${prompt} (Ready to Copy: ${ready_to_copy})`);

    let searchContext = "";
    const tavilyKey = process.env.TAVILY_API_KEY;
    
    // Smart Search Detection: If it's a general question and we have a search key
    const needsSearch = type === "general" || type === "voice" || /price|news|today|current|weather|who is|what is the/i.test(prompt);
    
    if (tavilyKey && needsSearch) {
      try {
        console.log("Performing web search via Tavily...");
        const searchResponse = await fetch("https://api.tavily.com/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            api_key: tavilyKey,
            query: prompt,
            search_depth: "basic",
            max_results: 3
          })
        });
        
        if (searchResponse.ok) {
          const searchData = await searchResponse.json();
          searchContext = "\n\nCURRENT WEB SEARCH RESULTS:\n" + 
            searchData.results.map((r: any) => `- ${r.title}: ${r.content} (Source: ${r.url})`).join("\n");
          console.log("Search results obtained.");
        }
      } catch (err) {
        console.error("Search failed:", err);
      }
    }

    const stream = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemInstruction + searchContext },
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
