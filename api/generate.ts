import OpenAI from 'openai';

export const config = {
  maxDuration: 300, // Extend duration if possible on Vercel
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { type, prompt, messages = [], voice_option = "alloy", personality = "professional", model = "trelvix-mini" } = req.body;

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
    
    const financialForce = /\b(usd|ngn|eur|gbp|btc|eth|sol)\b/i.test(lower) && 
                          (lower.includes("rate") || lower.includes("price") || lower.includes("worth") || lower.includes("value") || lower.includes("to") || lower.includes("convert"));

    const dateForce = lower.includes("2024") || lower.includes("2025") || lower.includes("2026") || lower.includes("today") || lower.includes("current");

    return financialForce || dateForce || searchKeywords.some(k => lower.includes(k)) || 
           (lower.includes("?") && (lower.includes("who") || lower.includes("how much") || lower.includes("is there") || lower.includes("what happened")));
  };

  console.log(`[API Generate] Start - Type: ${type}, Personality: ${personality}, Model: ${model}, Prompt length: ${prompt?.length || 0}`);

  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error("[API Generate] Missing OPENAI_API_KEY");
      return res.status(500).json({ error: "OpenAI API Key is missing" });
    }

    const openai = new OpenAI({ apiKey });

    // 0. Intelligence Controller
    const lastMessageContent = (messages[messages.length - 1]?.content || prompt || "").trim();
    
    // Stricter image intent detection: must start with or specifically request an image
    const lowerLast = lastMessageContent.toLowerCase();
    const isImageIntent = type === "image" || model === "trelvix-visual" || 
                         (lowerLast.startsWith("generate image") || 
                          lowerLast.startsWith("create image") || 
                          lowerLast.startsWith("draw") || 
                          lowerLast.startsWith("make an image") ||
                          lowerLast.startsWith("paint") ||
                          lowerLast.includes("generate a photorealistic image") ||
                          lowerLast.includes("show me an image of"));
    
    const searchRequired = needsWebSearch(lastMessageContent) && !isImageIntent;

    let realModel = "gpt-4o-mini";
    let currentBranding = "Standard Intelligence";

    if (isImageIntent || model === "trelvix-visual") {
      realModel = "gpt-4o"; 
      currentBranding = "Visual Engine";
    } else if (model === "trelvix-ultra") {
      realModel = "gpt-4o"; 
      currentBranding = "Ultra Intelligence";
    } else if (searchRequired) {
      // Search is fast but synthesis benefits from a better model, 
      // however mini is quite capable and faster. Let's stick with mini for speed unless Ultra is asked.
      realModel = "gpt-4o-mini";
      currentBranding = "Standard Intelligence";
    }

    console.log(`[API Intelligence] Intent: ${type}, Search: ${searchRequired}, Selection: ${currentBranding} (${realModel})`);

    // Helper for Tavily Search
    const searchWeb = async (query: string) => {
      const tavilyKey = process.env.TAVILY_API_KEY;
      console.log(`[API Search] Initiating for: ${query}`);
      
      if (!tavilyKey) {
        console.error(`[API Search] ERROR: No TAVILY_API_KEY found`);
        return "SEARCH_SYSTEM_OFFLINE: Live data currently unavailable.";
      }

      try {
        console.log(`[API Search] Calling Tavily API...`);
        const response = await fetch("https://api.tavily.com/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            api_key: tavilyKey,
            query,
            search_depth: "advanced",
            include_answer: true,
            max_results: 6
          })
        });
        
        if (response.ok) {
          const data = await response.json();
          console.log(`[API Search] Success. Results: ${data.results?.length || 0}`);
          if (data.results && data.results.length > 0) {
            const results = data.results.map((r: any) => ({
              title: r.title,
              url: r.url,
              snippet: r.content
            }));
            return `SOURCE_DATA:\n${JSON.stringify(results)}\nSUMMARY: ${data.answer || "Real-time data retrieved."}`;
          }
        } else {
          const errText = await response.text();
          console.error(`[API Search] Failed: ${response.status}`, errText);
        }
        return "SEARCH_SYSTEM_STATUS: LIMITED. Using fallbacks.";
      } catch (err) {
        console.error("[API Search] Error:", err);
        return "SEARCH_SYSTEM_OFFLINE. Error calculating results.";
      }
    };

    // 1. Image Generation
    if (type === "image" || isImageIntent) {
      let promptText = req.body.prompt || req.body.message || prompt || "a beautiful image";

      console.log("[Image Generation] Original prompt length:", promptText.length);

      // Append strong realism instructions
      const fullPrompt = promptText + ". photorealistic, highly detailed, realistic photography, sharp focus, natural lighting, 8k resolution, professional quality, accurate anatomy, cinematic lighting";

      let response;
      let modelUsed = "gpt-image-1";
      let base64Image = "";

      try {
        console.log("[Image Generation] Attempting generation with gpt-image-1 (quality: auto)...");
        response = await openai.images.generate({
          model: "gpt-image-1",
          prompt: fullPrompt,
          quality: "auto",
          size: "1024x1024",
          n: 1,
        });
        const imageUrl = response.data[0]?.url;
        if (!imageUrl) {
          console.warn("[Image Generation] No image URL in gpt-image-1 auto configuration response. Payload:", JSON.stringify(response));
          throw new Error("No image URL returned from gpt-image-1 with auto config");
        }
        base64Image = imageUrl;
        modelUsed = "gpt-image-1 (auto)";
      } catch (err: any) {
        console.warn(`[Image Generation] gpt-image-1 (auto) failed: ${err?.message || err}. Trying (quality: high)...`);
        try {
          response = await openai.images.generate({
            model: "gpt-image-1",
            prompt: fullPrompt,
            quality: "high",
            size: "1024x1024",
            n: 1,
          });
          const imageUrl = response.data[0]?.url;
          if (!imageUrl) {
            console.warn("[Image Generation] No image URL in gpt-image-1 high configuration response. Payload:", JSON.stringify(response));
            throw new Error("No image URL returned from gpt-image-1 with high config");
          }
          base64Image = imageUrl;
          modelUsed = "gpt-image-1 (high)";
        } catch (errHigh: any) {
          console.warn(`[Image Generation] gpt-image-1 (high) failed: ${errHigh?.message || errHigh}. Trying minimal params...`);
          try {
            response = await openai.images.generate({
              model: "gpt-image-1",
              prompt: fullPrompt,
            });
            const imageUrl = response.data[0]?.url;
            if (!imageUrl) {
              console.warn("[Image Generation] No image URL in gpt-image-1 minimal response. Payload:", JSON.stringify(response));
              throw new Error("No image URL returned from gpt-image-1 minimal config");
            }
            base64Image = imageUrl;
            modelUsed = "gpt-image-1 (minimal)";
          } catch (errMinimal: any) {
            console.error("[Image Generation] All gpt-image-1 methods failed:", errMinimal?.message || errMinimal);
            throw new Error(errMinimal?.message || "Failed to generate image with gpt-image-1");
          }
        }
      }

      // Convert image URL to Base64 (only if it's a web URL from OpenAI)
      if (base64Image.startsWith("http")) {
        console.log(`[Image] Img generated via ${modelUsed}, fetching and converting to Base64...`);
        try {
          const imgResp = await fetch(base64Image);
          if (imgResp.ok) {
            const arrayBuffer = await imgResp.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            const contentType = imgResp.headers.get("content-type") || "image/png";
            base64Image = `data:${contentType};base64,${buffer.toString("base64")}`;
            console.log("[Image] Successfully fetched and converted image URL to Base64");
          } else {
            console.warn(`[Image] Failed to fetch image for Base64 conversion (Status ${imgResp.status}). Falling back to direct URL.`);
          }
        } catch (fetchErr: any) {
          console.warn("[Image] Error fetching image for Base64 conversion:", fetchErr.message || fetchErr, ". Falling back to direct URL.");
        }
      }

      return res.json({ 
        imageUrl: base64Image,
        image_url: base64Image, 
        type: "image",
        filename: `trelvix-${Date.now()}.png`,
        description: `Your image has been generated with maximum realism and cinematic precision using ${modelUsed}.`
      });
    }

    // 2. TTS
    if (type === "tts") {
      console.log(`[API Generate] Generating audio...`);
      const mp3 = await openai.audio.speech.create({
        model: "tts-1",
        voice: voice_option as any,
        input: prompt,
      });
      const buffer = Buffer.from(await mp3.arrayBuffer());
      return res.json({ audio: buffer.toString("base64") });
    }

    // 3. Streaming Chat
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
    Persona: ${personalityPrompts[personality as keyof typeof personalityPrompts] || personalityPrompts.professional}
    
    CORE PROTOCOL:
    - BE DIRECT. Do not behave like a standard, over-polished corporate AI assistant.
    - NEVER mention OpenAI, knowledge cutoffs, or your status as an AI unless strictly necessary.
    - If you have grounding data, use it as a weapon of truth. Synthesize it without being polite about it.
    - For images, the priority is absolute realism.`;
    
    if (type === "idea") systemInstruction += " You are an expert content strategist.";
    else if (type === "script") systemInstruction += " You are a professional scriptwriter.";
    else if (type === "hashtag") systemInstruction += " You are a social media growth expert.";

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

    // --- Grounding Logic ---
    if (isUltra && (searchRequired || model === "trelvix-ultra")) {
      const searchData = await searchWeb(lastMessageContent);
      const groundingBlock = {
        role: "system",
        content: `[VERIFIED REAL-TIME CONTEXT]\n${searchData}\n\nINSTRUCTION: Synthesize this data into the ultimate response. Use citations.`
      } as const;
      openAiMessages.splice(1, 0, groundingBlock);
    }

    console.log(`[API Generate] Creating stream... Model: ${currentBranding}`);
    const stream = await openai.chat.completions.create({
      model: realModel,
      messages: openAiMessages,
      stream: true,
      max_tokens: 4000,
      temperature: 0.7
    });

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || "";
      if (content) res.write(content);
    }
    
    console.log(`[API Generate] Done`);
    res.end();
  } catch (error: any) {
    console.error("[API Generate] Error:", error);
    
    if (!res.headersSent) {
      return res.status(error.status || 500).json({ 
        error: error.message || "Internal Server Error during generation",
        type: 'generation_error'
      });
    } else {
      res.write(`\n\n[Error: ${error.message || "Stream interrupted"}]`);
      res.end();
    }
  }
}
