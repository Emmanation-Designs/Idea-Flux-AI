import OpenAI from "openai";

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { type, prompt, messages = [], voice_option = "alloy", ready_to_copy = false } = req.body;

  if (!process.env.OPENAI_API_KEY) {
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

    if (type === "tts" || type === "voice_tts") {
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

    const stream = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemInstruction },
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
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    let isClientConnected = true;
    req.on("close", () => {
      isClientConnected = false;
    });

    for await (const chunk of stream) {
      if (!isClientConnected) break;
      const content = chunk.choices[0]?.delta?.content || "";
      res.write(content);
    }

    if (isClientConnected) {
      res.end();
    }
  } catch (error: any) {
    console.error("Error generating content:", error);
    res.status(500).json({ error: error.message || "Failed to generate content" });
  }
}
