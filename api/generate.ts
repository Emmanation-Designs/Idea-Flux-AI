import OpenAI from "openai";

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { type, prompt, messages = [], voice_option = "alloy" } = req.body;

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

    const stream = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemInstruction },
        ...messages.map((m: any) => ({
          role: m.role,
          content: m.content,
        })),
        { role: "user", content: prompt },
      ],
      stream: true,
    });

    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Transfer-Encoding", "chunked");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || "";
      res.write(content);
    }

    res.end();
  } catch (error: any) {
    console.error("Error generating content:", error);
    res.status(500).json({ error: error.message || "Failed to generate content" });
  }
}
