import OpenAI from 'openai';
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

export const config = {
  maxDuration: 300, // Extend duration if possible on Vercel
};

async function appendReplyToConversation(
  conversationId: string, 
  replyMessage: any, 
  userId?: string, 
  conversationType?: string, 
  previousMessages?: any[]
) {
  if (!conversationId) return;
  try {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "https://wxezfzhhzlauggufecmm.supabase.co";
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind4ZXpmemhoemxhdWdndWZlY21tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyNTQxMjcsImV4cCI6MjA4OTgzMDEyN30.2nsDSFhOtm1Xs3RuZNDo74jGbBwd05E7lPP-FN5cd1Q";
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    // Select the existing messages
    const { data: conv, error: fetchErr } = await supabase
      .from('conversations')
      .select('messages')
      .eq('id', conversationId)
      .single();

    if (fetchErr || !conv) {
      if (fetchErr && fetchErr.code === 'PGRST116' && userId) {
        console.log(`[API DB] Conversation ${conversationId} not found, creating from fallback...`);
        const initialMessages = previousMessages ? [...previousMessages] : [];
        if (!initialMessages.some(m => m.id === replyMessage.id)) {
          initialMessages.push(replyMessage);
        }
        let titleText = 'New Conversation';
        if (previousMessages && previousMessages.length > 0) {
          titleText = previousMessages[0].content || 'New Conversation';
        } else if (replyMessage && replyMessage.content) {
          titleText = replyMessage.content;
        }
        if (titleText.length > 50) {
          titleText = titleText.slice(0, 48) + '...';
        }

        const newConv = {
          id: conversationId,
          user_id: userId,
          title: titleText,
          type: conversationType || 'general',
          messages: initialMessages,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        const { error: insertErr } = await supabase
          .from('conversations')
          .insert(newConv);

        if (insertErr) {
          console.error(`[API DB] Error inserting conversation on fallback:`, insertErr);
        } else {
          console.log(`[API DB] Created conversation ${conversationId} during fallback flow successfully.`);
        }
        return;
      }

      console.error(`[API DB] Failed to fetch conversation ${conversationId}:`, fetchErr);
      return;
    }

    const currentMessages = conv.messages || [];
    const hasAssisReply = currentMessages.length > 0 && currentMessages[currentMessages.length - 1].role === 'assistant';
    if (!hasAssisReply) {
      const updatedMessages = [...currentMessages, replyMessage];
      const { error: updateErr } = await supabase
        .from('conversations')
        .update({
          messages: updatedMessages,
          updated_at: new Date().toISOString()
        })
        .eq('id', conversationId);

      if (updateErr) {
        console.error(`[API DB] Failed to update conversation ${conversationId}:`, updateErr);
      } else {
        console.log(`[API DB] Successfully appended reply to conversation ${conversationId} on backend`);
      }
    } else {
      console.log(`[API DB] Response already persisted in conversation ${conversationId}, skipping server append.`);
    }
  } catch (err) {
    console.error("[API DB] Error inside appendReplyToConversation:", err);
  }
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { type, prompt, messages = [], voice_option = "alloy", personality = "creative", model = "trelvix-mini" } = req.body;

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
    
    // Comprehensive document/file exclusion list to prevent false positive image generation triggers
    const docExclusionFilter = /\b(pdf|docx|xlsx|word|excel|spreadsheet|csv|document|resume|report|cv|curriculum\s*vitae|invoice|presentation|budget|letter|email|cover\s*letter|essay|article|post|text|contract|agreement|outline|syllabus|proposal|workbook|chart|table|schema|blueprint|database)\b/i;

    // Stricter image intent detection: must start with or specifically request an image
    const lowerLast = lastMessageContent.toLowerCase();
    const isImageIntent = (type === "image" || model === "trelvix-visual" || 
                         (lowerLast.startsWith("generate image") || 
                          lowerLast.startsWith("create image") || 
                          lowerLast.startsWith("draw") || 
                          lowerLast.startsWith("make an image") ||
                          lowerLast.startsWith("paint") ||
                          lowerLast.includes("generate a photorealistic image") ||
                          lowerLast.includes("show me an image of"))) &&
                          !docExclusionFilter.test(lowerLast);
    
    // Explicitly detect if the user wants to compile a document, CV, layout, text sheet or report
    const isDocRequest = docExclusionFilter.test(lastMessageContent);

    const searchRequired = needsWebSearch(lastMessageContent) && !isImageIntent;

    let realModel = "gpt-4o-mini";
    let currentBranding = "Standard Intelligence";

    if (isImageIntent || model === "trelvix-visual") {
      realModel = "gpt-4o"; 
      currentBranding = "Visual Engine";
    } else if (model === "trelvix-ultra" || isDocRequest) {
      // Force gpt-4o for all document/resume/PDF compile requests to ensure correct JSON outputs
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

      // Auto-truncate extremely long prompts safely to prevent OpenAI API size limit failures (max 2000 chars)
      if (promptText.length > 2000) {
        console.log(`[Image Generation] Truncating client prompt from ${promptText.length} to 2000 chars to prevent API failures.`);
        promptText = promptText.substring(0, 2000) + "...";
      }

      // Append strong realism instructions
      const fullPrompt = promptText + ". photorealistic, highly detailed, realistic photography, sharp focus, natural lighting, 8k resolution, professional quality, accurate anatomy, cinematic lighting";

      let response;
      let modelUsed = "gpt-image-2";
      let base64Image = "";

      const extractImage = (resObj: any) => {
        const item = resObj?.data?.[0];
        if (item?.b64_json) {
          return item.b64_json.startsWith("data:") ? item.b64_json : `data:image/png;base64,${item.b64_json}`;
        }
        if (item?.url) {
          return item.url;
        }
        return "";
      };

      const imageSpeed = req.body.image_speed || "quality";
      console.log(`[Image Generation] Requested engine speed: ${imageSpeed}`);

      if (imageSpeed === "fast") {
        try {
          console.log("[Image Generation] Fast Mode: Attempting generation with gpt-image-1 for turbo speed (typically < 3 seconds)...");
          response = await openai.images.generate({
            model: "gpt-image-1",
            prompt: promptText, // cleaner prompt to increase generation speed
            size: "1024x1024",
            n: 1,
          });
          const extracted = extractImage(response);
          if (extracted) {
            base64Image = extracted;
            modelUsed = "gpt-image-1 (turbo fast)";
          }
        } catch (fastErr: any) {
          console.warn("[Image Generation] Fast Mode gpt-image-1 bypassed, trying gpt-image-2 fast-standard...", fastErr?.message || fastErr);
          try {
            response = await openai.images.generate({
              model: "gpt-image-2",
              prompt: fullPrompt,
              quality: "standard", // 3x faster than HD/auto quality!
              size: "1024x1024",
              n: 1,
            });
            const extracted = extractImage(response);
            if (extracted) {
              base64Image = extracted;
              modelUsed = "gpt-image-2 (fast-standard)";
            }
          } catch (fastErr2: any) {
            console.error("[Image Generation] Fast modes failed, falling back to quality pipeline:", fastErr2?.message || fastErr2);
          }
        }
      }

      if (!base64Image) {
        try {
          console.log("[Image Generation] Attempting generation with primary model gpt-image-2 (quality: auto)...");
          response = await openai.images.generate({
            model: "gpt-image-2",
            prompt: fullPrompt,
            quality: "auto",
            size: "1024x1024",
            n: 1,
          });
          const extracted = extractImage(response);
          if (!extracted) {
            throw new Error("No image returned from gpt-image-2");
          }
          base64Image = extracted;
          modelUsed = "gpt-image-2 (auto)";
        } catch (err2: any) {
          console.warn(`[Image Generation] Primary model gpt-image-2 failure: ${err2?.message || err2}. Retrying with minimal params for gpt-image-2...`);
          try {
            response = await openai.images.generate({
              model: "gpt-image-2",
              prompt: fullPrompt,
            });
            const extracted = extractImage(response);
            if (!extracted) {
              throw new Error("No image returned from gpt-image-2 minimal");
            }
            base64Image = extracted;
            modelUsed = "gpt-image-2 (minimal)";
          } catch (err2Minimal: any) {
            console.warn(`[Image Generation] gpt-image-2 failed completely: ${err2Minimal?.message || err2Minimal}. Invoking fallback gpt-image-1...`);
            try {
              console.log("[Image Generation] Attempting fallback generation with gpt-image-1 (quality: auto)...");
              response = await openai.images.generate({
                model: "gpt-image-1",
                prompt: fullPrompt,
                quality: "auto",
                size: "1024x1024",
                n: 1,
              });
              const extracted = extractImage(response);
            if (!extracted) {
              throw new Error("No image returned from fallback gpt-image-1");
            }
            base64Image = extracted;
            modelUsed = "gpt-image-1 (fallback auto)";
          } catch (err1: any) {
            console.warn(`[Image Generation] Fallback gpt-image-1 auto configuration failed: ${err1?.message || err1}. Trying gpt-image-1 with minimal config...`);
            try {
              response = await openai.images.generate({
                model: "gpt-image-1",
                prompt: fullPrompt,
              });
              const extracted = extractImage(response);
              if (!extracted) {
                throw new Error("No image returned from fallback gpt-image-1 minimal");
              }
              base64Image = extracted;
              modelUsed = "gpt-image-1 (fallback minimal)";
            } catch (errAll: any) {
              console.error("[Image Generation] All image generation models failed:", errAll?.message || errAll);
              throw new Error(errAll?.message || "Failed to generate image with any model.");
            }
          }
        }
      }
    }

      // We skip heavy synchronous download and base64 parsing on the main thread.
      // Returning the direct OpenAI CDN URL allows the client to load and render the image INSTANTLY!
      // The client's background auto-migration scanner will lazily heal/migrate compile history safely.
      console.log(`[Image] Img generated via ${modelUsed} responding immediately with direct CDN URL to maximize throughput speed.`);

      if (req.body.conversationId && req.body.userId) {
        (async () => {
          try {
            const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "https://wxezfzhhzlauggufecmm.supabase.co";
            const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind4ZXpmemhoemxhdWdndWZlY21tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyNTQxMjcsImV4cCI6MjA4OTgzMDEyN30.2nsDSFhOtm1Xs3RuZNDo74jGbBwd05E7lPP-FN5cd1Q";
            
            const supabase = createClient(supabaseUrl, supabaseServiceKey);
            const { data: imageData, error: imgError } = await supabase.from('images').insert({
                user_id: req.body.userId,
                prompt: promptText,
                image_url: base64Image
              }).select().single();

              const assistantMessage = {
                id: crypto.randomUUID(),
                role: 'assistant',
                content: "Here is your generated image:",
                image_url: imageData ? `db:${imageData.id}` : base64Image,
                filename: `trelvix-${Date.now()}.png`,
                model: model || 'trelvix-visual',
                created_at: new Date().toISOString()
              };

              await appendReplyToConversation(
                req.body.conversationId,
                assistantMessage,
                req.body.userId,
                type || 'image',
                messages
              );
          } catch (e) {
            console.error("[API Image Save Error]:", e);
          }
         })().catch(console.error);
      }

      return res.json({ 
        imageUrl: base64Image,
        image_url: base64Image, 
        type: "image",
        filename: `trelvix-${Date.now()}.png`,
        description: "Here is your generated image:"
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
    Persona: ${personalityPrompts[personality as keyof typeof personalityPrompts] || personalityPrompts.creative}
    
    CORE PROTOCOL:
    - BE DIRECT. Do not behave like a standard, over-polished corporate AI assistant.
    - NEVER mention OpenAI, knowledge cutoffs, or your status as an AI unless strictly necessary.
    - If you have grounding data, use it as a weapon of truth. Synthesize it without being polite about it.
    - For images, the priority is absolute realism.
    - CRITICAL DIRECTIVE: You have a built-in Client-Side Document & Spreadsheet Compiler! You CAN create, compile, and generate physical files (PDFs, Microsoft Word documents, and Excel worksheets). NEVER claim, refuse, or apologize that you cannot "create", "generate", "export", or "write" physical files or download sheets directly. Always enthusiastically comply, write the requested text or preview, and end with the exact \`json-file-data\` code block so the frontend compiler can construct the actual download for the user. This is a crucial, native feature of your platform.
    
    STRICT MARKDOWN & LATEX OUTPUT FORMAT RULES:
    1. Output ONLY Markdown text. No HTML or raw JSON unless requested.
    2. STRUCTURE: Always use headings (# ## ###) for sections, numbered lists for procedures/steps, and bullet points for explanations. Keep responses cleanly spaced and highly readable.
    3. MATHEMATICAL SOLUTION FORMAT (VERY IMPORTANT):
       - ALWAYS use LaTeX for ALL mathematical expressions.
       - Inline math MUST be written as: \\( ... \\)
       - Block math MUST be written as: \\[ ... \\]
       - NEVER use plain text math (e.g. write "\\( x^2 = 4 \\)", NEVER "x^2 = 4").
       - Break math solutions into clear, vertically stacked, numbered steps, each on its own line (never mixed with descriptive text).
       - Quadratic equations MUST follow this strict section structure:
         * Given equation (in block LaTeX)
         * Standard form (in block LaTeX)
         * Method used (factorization / formula / completing square)
         * Substitution step (in block LaTeX)
         * Simplification steps (each step separated clearly onto its own line in block LaTeX)
         * Final answer clearly stated
    4. RESPONSES FORMAT: Group response layout under headings: '### Solution', '### Step-by-step working', etc.
    5. TABLES: Always use Markdown tables for data comparison. Columns must be clean and consistent.
    6. MOBILE READEBILITY: Avoid horizontal overflow. Keep math calculations vertically stacked. Avoid large unstructured blocks of text.
    
    7. FILE GENERATION & EXPORT PROTOCOL (PDF, WORD, EXCEL):
       - When a user asks you to create, write, design, generate, edit, or adjust a PDF document (.pdf), Microsoft Word document (.docx), or Excel spreadsheet (.xlsx) (such as reports, letters, resumes, invoices, budgets, logs, data workbooks, tables), you MUST:
         a. Write a highly detailed, professional, and visually structured conversational markdown response containing the full draft preview of the requested document or spreadsheet.
         b. At the very end of your response, write exactly one code block with the language label \`json-file-data\` (i.e. \`\`\`json-file-data ... \`\`\`) containing the complete, valid structured JSON configuration of the document or spreadsheet so that the frontend compiler can construct the download. Do NOT wrap this block in other code types or formatting. Do NOT omit it.
         
         The schema for the JSON within the \`\`\`json-file-data block MUST look exactly like this:
         {
           "fileType": "pdf" | "docx" | "xlsx",
           "fileName": "clean-snake-case-file-name",
           "title": "Main Title of the Document / Sheet",
           "subtitle": "Optional Brief Subtitle",
           "author": "Trelvix AI",
           "sections": [
             {
               "heading": "Section Heading Title",
               "type": "text" | "bullet" | "table",
               "paragraphs": ["Detailed text paragraph..."],
               "bullets": ["Bullet point list item..."],
               "headers": ["Column 1", "Column 2", "Column 3"],
               "rows": [
                 ["Row 1 Col 1", "Row 1 Col 2", "Row 1 Col 3"],
                 ["Row 2 Col 1", "Row 2 Col 2", "Row 2 Col 3"]
               ]
             }
           ],
           "spreadsheet": {
             "sheets": [
               {
                 "name": "Sheet Name (max 31 chars)",
                 "rows": [
                   ["Category", "Budgeted", "Actual", "Variance"],
                   ["Row 1 A", "Value 1", "Value 2", "Value 3"]
                 ]
               }
             }
           }
         }
         
         Instruction: Only include the "spreadsheet" key when compiling an xlsx file or sheet tables. For PDF and DOCX, use the standard sections formatting. Always provide both the human-readable markdown response and this structured JSON-data block so the user gets both an on-screen preview and a functional, professional physical file download!`;
    
    if (type === "idea") systemInstruction += " You are an expert content strategist and creative thinker. Help users brainstorm unique and impactful ideas.";
    else if (type === "script") systemInstruction += " You are a professional scriptwriter for video, stage, and screen. Write engaging and well-structured scripts.";
    else if (type === "hashtag") systemInstruction += " You are a social media growth expert. Generate trending and relevant hashtags.";

    if (isDocRequest) {
      systemInstruction += `\n\nCRITICAL DIRECTIVE: The user is explicitly asking for a CV, resume, document, spreadsheet, or physical file (such as a PDF, Word .docx, or Excel .xlsx). 
Because you are integrated with our custom client-side file compiler, YOU ABSOLUTELY CAN AND MUST GENERATE AND EMIT THIS FILE!
- NEVER refuse, say you cannot write/create/compile files, or suggest standard tools like Word/Google Docs.
- Say "Sure, I have generated the file" and display a beautiful preview formatting for it in markdown.
- At the absolute end of your response, write exactly one code block with label \`\`\`json-file-data ... \`\`\` containing the full correct JSON configuration (with fileType, fileName, title, sections, etc.) as detailed in rule #7 above. Our compiler will automatically detect this and render actual [Download PDF], [Download Word], and [Download Excel] buttons so the user can download the real physical file!`;
    }

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

    // Deep analysis of general document intent to overcome any pre-trained LLM refusal tendencies
    if (isDocRequest) {
      console.log(`[API Generate] Activating maximum document compiler reinforcement for: "${lastMessageContent.substring(0, 40)}..."`);
      openAiMessages.push({
        role: "system",
        content: `CRITICAL ACTION REQUIRED:
The user wants a CV, resume, document, spreadsheet, or physical file.
Because you are integrated with our custom frontend compiler, YOU CAN and MUST create the file!
- Do NOT apologize, claim that you cannot generate files, or tell the user to use visual processors.
- Provide a clean, elegant preview in your markdown output.
- Print a single, valid, correctly formulated \`\`\`json-file-data ... \`\`\` code block at the absolute end of your response. This block is parsed by the custom UI compiler to compile a download button for the user automatically.
- Do NOT wrap this block inside another block, and don't omit it.`
      });
    }

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

    let accumulatedText = "";
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || "";
      if (content) {
        accumulatedText += content;
        if (!res.writableEnded) {
          res.write(content);
        }
      }
    }
    
    console.log(`[API Generate] Done`);
    res.end();

    if (req.body.conversationId) {
      const assistantMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: accumulatedText,
        model: model,
        created_at: new Date().toISOString()
      };
      appendReplyToConversation(
        req.body.conversationId,
        assistantMessage,
        req.body.userId,
        type || 'chat',
        messages
      ).catch(console.error);
    }
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
