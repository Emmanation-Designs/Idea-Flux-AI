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
      // Optimize and clean prompt
      let basePrompt = (prompt || lastMessageContent || "").trim();
      
      // Limit prompt length for image generation (max 400 characters) for maximum stability
      if (basePrompt.length > 400) {
        basePrompt = basePrompt.substring(0, 400);
      }

      const lowerPrompt = basePrompt.toLowerCase();
      
      const isLogo = lowerPrompt.includes("logo") || lowerPrompt.includes("icon");
      const isPoster = lowerPrompt.includes("flyer") || lowerPrompt.includes("poster") || lowerPrompt.includes("design");
      const isPeople = lowerPrompt.includes("man") || lowerPrompt.includes("woman") || lowerPrompt.includes("person") || lowerPrompt.includes("human") || lowerPrompt.includes("face");
      const isArtisticRequested = lowerPrompt.includes("artistic") || lowerPrompt.includes("illustration") || lowerPrompt.includes("3d") || lowerPrompt.includes("cartoon") || lowerPrompt.includes("painting");

      const coreRealism = "photorealistic, highly detailed, realistic photography, sharp focus, natural lighting, 8k resolution, professional quality, accurate anatomy, cinematic lighting, detailed skin texture";
      const designBoost = "professional design, custom typography, clean lines, high contrast";

      let finalPrompt = basePrompt;

      if (isLogo) {
        finalPrompt = `Professional minimalist logo, high-end graphic design, vector style, white background. ${designBoost}. Subject: ${basePrompt}`;
      } else if (isPoster) {
        finalPrompt = `Highly detailed professional graphic design, poster aesthetic, ${coreRealism}. ${designBoost}. Subject: ${basePrompt}`;
      } else if (isPeople) {
        finalPrompt = `${coreRealism}, natural features, shot on 85mm lens. Subject: ${basePrompt}`;
      } else if (isArtisticRequested) {
        finalPrompt = `Masterpiece, fine art rendering, highly detailed, ${coreRealism}. Subject: ${basePrompt}`;
      } else {
        finalPrompt = `${coreRealism}, professional photography, lifelike. Subject: ${basePrompt}`;
      }

      console.log(`[API Generate] Image generation initiated. Final optimized prompt: "${finalPrompt}"`);

      let generatedBase64: string | null = null;
      let engineUsed = "dall-e-3";

      // Sequentially try different model names to handle proxy casing constraints and api permissions
      const modelCandidates = [
        "dall-e-3", "DALL-E-3", "DALL-E 3", "dall-e3", "DALL-E3",
        "dall-e-2", "DALL-E-2", "DALL-E 2", "dall-e2", "DALL-E2"
      ];

      for (const candidate of modelCandidates) {
        try {
          console.log(`[API Generate] Attempting image generation with model: "${candidate}"...`);
          const response = await openai.images.generate({
            model: candidate,
            prompt: finalPrompt,
            n: 1,
            size: "1024x1024"
          });

          if (response?.data?.[0]?.b64_json) {
            generatedBase64 = `data:image/png;base64,${response.data[0].b64_json}`;
            engineUsed = candidate;
            console.log(`[API Generate] Image generated successfully using ${candidate} (b64_json)`);
            break;
          } else if (response?.data?.[0]?.url) {
            const imgUrl = response.data[0].url;
            console.log(`[API Generate] Image URL returned from ${candidate}, fetching and converting to Base64...`);
            const imgResp = await fetch(imgUrl);
            if (imgResp.ok) {
              const arrayBuffer = await imgResp.arrayBuffer();
              const buffer = Buffer.from(arrayBuffer);
              const contentType = imgResp.headers.get("content-type") || "image/png";
              generatedBase64 = `data:${contentType};base64,${buffer.toString("base64")}`;
              engineUsed = candidate;
              console.log(`[API Generate] Successfully fetched and converted ${candidate} image URL to Base64`);
              break;
            } else {
              console.warn(`[API Generate] Failed to fetch image from URL for model ${candidate} (Status ${imgResp.status})`);
            }
          } else {
            console.warn(`[API Generate] Empty representation from model ${candidate}`);
          }
        } catch (err: any) {
          console.warn(`[API Generate] Model "${candidate}" failed: ${err?.message || err}`);
        }
      }

      if (!generatedBase64) {
        return res.status(200).json({ 
          error: "Failed to generate image. The service is currently busy or rate-limited. Please try again with a simpler description.", 
          type: 'generation_failed' 
        });
      }

      return res.json({ 
        image_url: generatedBase64, 
        filename: `trelvix-${Date.now()}.png`,
        description: `Your image has been generated with maximum realism and cinematic precision using ${engineUsed}.`
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
