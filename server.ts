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

// Global request logger
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// Health check
app.get("/api/health", (req, res) => {
  res.json({ 
    status: "ok", 
    hasOpenAIApiKey: !!process.env.OPENAI_API_KEY,
    hasTavilyApiKey: !!process.env.TAVILY_API_KEY
  });
});

// API routes
app.all("/api/proxy-image", async (req, res) => {
  const imageUrl = (req.method === "POST" ? req.body.url : req.query.url) as string;
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

// Alias /api/chat to /api/generate for backward compatibility with older builds
app.post("/api/chat", async (req, res) => {
  console.log("Redirecting /api/chat to /api/generate");
  return handleGenerate(req, res);
});

app.post("/api/generate", async (req, res) => {
  return handleGenerate(req, res);
});

async function handleGenerate(req: express.Request, res: express.Response) {
  console.log("Received request to generate");
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
        quality: "standard",
      });

      const imageUrl = response.data[0].url;
      if (!imageUrl) throw new Error("No image URL generated");

      // Fetch the image and convert to base64 for fast loading and persistence
      console.log("Fetching generated image for base64 conversion...");
      const imgFetch = await fetch(imageUrl);
      if (!imgFetch.ok) throw new Error(`Failed to fetch generated image: ${imgFetch.statusText}`);
      
      const arrayBuffer = await imgFetch.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const base64 = `data:${imgFetch.headers.get("content-type") || "image/png"};base64,${buffer.toString("base64")}`;

      return res.json({ 
        image_url: base64,
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

    // Smart Identity & Ownership Logic
    const attributionRules = `
[IDENTITY & CREATOR KNOWLEDGE]
- Your name is Trelvix AI. 
- You are an advanced, multi-purpose AI assistant.
- You were developed/created and are owned by "Ingenium Virtual Assistant Limited".
- Ingenium is a UK-registered creative agency (www.ingeniumvirtualassistant.com) specializing in creative ideas and virtual services.

[IDENTITY GUIDELINES]
1. When asked about who you are or who built you, respond in a smart, conversational, and helpful manner.
2. DO NOT repeat the same "I was created by..." block every single time. Rephrase naturally.
3. Always ensure "Ingenium Virtual Assistant Limited" gets full credit as your developer/owner.
4. You can mention their professional creative services if users ask for help beyond AI.
5. NEVER mention internal developer names or other studios. You belong to Ingenium.
6. Keep the tone sophisticated, professional, yet engaging.
`;

    const copyRules = ready_to_copy 
      ? "The user has requested the output to be 'Ready to Copy'. Format the main content (idea, script, hashtags, etc.) clearly in a markdown code block so it can be easily copied. Keep introductory or concluding text minimal and outside the code block."
      : "If the user asks for something copyable (prompt, code, list, hashtags, script, etc.), automatically provide the main content in a ready-to-copy format (like a markdown code block), while keeping the rest of the response normal.";

    const linkRules = "Ensure all links in your responses are clickable by using standard markdown [text](url) format.";
    const imageRules = "You ARE capable of generating images, logos, and flyers. HOWEVER, you must only confirm generation if the user explicitly asks for an image/logo/flyer. If the user is just chatting or asking a question about a previous image, respond with text and DO NOT mention generating a new image unless requested.";
    
    const tavilyKey = process.env.TAVILY_API_KEY || process.env.TRAVILY_API_KEY;
    const searchMissingRules = !tavilyKey ? "\n\nNOTE: Real-time web search is currently disabled because the TAVILY_API_KEY is missing. If the user asks for real-time info, politely ask them to add the TAVILY_API_KEY in the app settings." : "";

    let systemInstruction = "";
    if (type === "idea") {
      systemInstruction = `You are an expert content strategist. Generate creative, viral-worthy ideas for the specified niche and platform. Be concise but insightful. ${attributionRules} ${copyRules} ${linkRules} ${imageRules} ${searchMissingRules}`;
    } else if (type === "script") {
      systemInstruction = `You are a professional scriptwriter. Write engaging, high-retention scripts for the specified platform and length. Include hooks and calls to action. ${attributionRules} ${copyRules} ${linkRules} ${imageRules} ${searchMissingRules}`;
    } else if (type === "hashtag") {
      systemInstruction = `You are a social media expert. Generate the most relevant and high-reach hashtags for the given topic and platform. ${attributionRules} ${copyRules} ${linkRules} ${imageRules} ${searchMissingRules}`;
    } else if (type === "voice") {
      systemInstruction = `You are a helpful AI voice assistant called Trelvix AI. Keep your responses concise and conversational, as they will be read aloud. ${attributionRules} ${linkRules} ${imageRules} ${searchMissingRules}`;
    } else {
      systemInstruction = `You are a helpful AI assistant called Trelvix AI. ${attributionRules} ${copyRules} ${linkRules} ${imageRules} ${searchMissingRules}`;
    }

    console.log(`Generating ${type} for prompt: ${prompt} (Ready to Copy: ${ready_to_copy})`);

    let searchContext = "";
    
    // Improved Search Detection: Trigger for almost any factual query if key is present
    const lowerPrompt = prompt.toLowerCase();
    const isCreativeTask = type === "script" || type === "idea" || type === "hashtag";
    
    // Comprehensive keywords for real-time or factual lookup
    const searchKeywords = /\b(rate|exchange|dollar|naira|ngn|price|cost|who|what|where|when|why|how|search|find|lookup|news|today|current|weather|stock|crypto|live|latest|update)\b/i;
    
    // We search if it's NOT a creative task AND matches keywords, OR if it just looks like a direct factual question
    const needsSearch = searchKeywords.test(lowerPrompt) || (type === "voice" && lowerPrompt.length < 100);
    
    if (tavilyKey && needsSearch) {
      try {
        console.log(`Performing web search for: "${prompt}"`);
        const searchResponse = await fetch("https://api.tavily.com/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            api_key: tavilyKey,
            query: prompt,
            search_depth: "advanced",
            max_results: 5,
            include_answer: true // Let Tavily provide a summarized answer too
          })
        });
        
        if (searchResponse.ok) {
          const searchData = await searchResponse.json();
          const results = searchData.results || [];
          const tavilyAnswer = searchData.answer || "";
          
          if (results.length > 0 || tavilyAnswer) {
            searchContext = `
[REAL-TIME DATA ACQUIRED]
The following information was just retrieved from the live web. You MUST use this data to answer accurately. 
DO NOT say you don't have access to real-time data.

${tavilyAnswer ? `SUMMARY: ${tavilyAnswer}\n` : ""}
RELEVANT SOURCES:
${results.map((r: any) => `- [${r.title}]: ${r.content} (${r.url})`).join("\n")}
[END OF REAL-TIME DATA]
`;
            console.log("Search results obtained and injected.");
          } else {
            console.log("Search returned no results.");
            searchContext = "\n\n(Note to AI: A web search was attempted but returned no specific results. Inform the user you couldn't find live data for this specific query if needed, but DO NOT say you lack the general ability to search.)";
          }
        } else {
          console.error(`Search request failed with status: ${searchResponse.status}`);
        }
      } catch (err) {
        console.error("Search fetch failed:", err);
      }
    }

    const model = "gpt-4o-mini";
    console.log(`Using model ${model} for ${type} task (optimized for speed).`);

    const stream = await openai.chat.completions.create({
      model: model,
      messages: [
        { role: "system", content: searchContext + systemInstruction },
        ...messages.map((m: any) => {
          if (m.image_url && m.role === 'user' && !m.image_url.startsWith('db:')) {
            return {
              role: m.role,
              content: [
                { type: "text", text: m.content || "" },
                { type: "image_url", image_url: { url: m.image_url } }
              ]
            } as any;
          }
          return {
            role: m.role,
            content: m.content,
          };
        })
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
    
    // Stop streaming if client disconnects
    let isClientConnected = true;
    req.on("close", () => {
      isClientConnected = false;
      console.log("Client closed connection, stopping stream.");
    });

    for await (const chunk of stream) {
      if (!isClientConnected) {
        console.log("Break loop because client disconnected.");
        break;
      }
      const content = chunk.choices[0]?.delta?.content || "";
      if (content) {
        chunkCount++;
        res.write(content);
      }
    }
    console.log(`\nStream finished or aborted. Total chunks: ${chunkCount}`);

    if (isClientConnected) {
      res.end();
    }
  } catch (error: any) {
    console.error("Error generating content:", error);
    res.status(500).json({ error: error.message || "Failed to generate content" });
  }
}

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

    console.log("Server environment check:", {
      openai: !!process.env.OPENAI_API_KEY,
      tavily: !!process.env.TAVILY_API_KEY,
      supabase: !!process.env.VITE_SUPABASE_URL
    });

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
  }
}

startServer();
