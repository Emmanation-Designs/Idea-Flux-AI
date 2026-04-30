import OpenAI from 'openai';

export const config = {
  maxDuration: 300, // Extend duration if possible on Vercel
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { type, prompt, messages = [], voice_option = "alloy" } = req.body;

  console.log(`[API Generate] Start - Type: ${type}, Prompt length: ${prompt?.length || 0}`);

  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error("[API Generate] Missing OPENAI_API_KEY");
      return res.status(500).json({ error: "OpenAI API Key is missing in server environment" });
    }

    const openai = new OpenAI({ apiKey });

    // 1. Image Generation
    if (type === "image") {
      let enhancedPrompt = prompt;
      const isLogo = prompt.toLowerCase().includes("logo");
      const isFlyer = prompt.toLowerCase().includes("flyer") || prompt.toLowerCase().includes("poster");

      if (isLogo) {
        enhancedPrompt = `${prompt}, clean vector logo, professional, minimalist, high resolution, white background, masterpiece, 4k`;
      } else if (isFlyer) {
        enhancedPrompt = `${prompt}, professional graphic design, modern layout, vibrant colors, high resolution, sharp focus, marketing material`;
      } else {
        enhancedPrompt = `${prompt}, highly realistic, photorealistic, detailed, sharp focus, natural lighting, 8k resolution, cinematic lighting`;
      }

      console.log(`[API Generate] Generating image...`);
      const response = await openai.images.generate({
        model: "dall-e-3",
        prompt: enhancedPrompt,
        n: 1,
        size: "1024x1024",
        quality: "hd",
        response_format: "b64_json" // Faster and more reliable than returning URL which might expire
      });

      const base64 = `data:image/png;base64,${response.data[0].b64_json}`;
      console.log(`[API Generate] Image generated successfully`);
      return res.json({ image_url: base64, filename: `trelvix-${Date.now()}.png` });
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
    const attributionRules = `Your name is Trelvix AI. Developed by Ingenium Virtual Assistant Limited (www.ingeniumvirtualassistant.com).`;
    let systemInstruction = `You are Trelvix AI, a high-performance AI toolkit. ${attributionRules} 
    Always prioritize professionalism, creativity, and accuracy.`;
    
    if (type === "idea") systemInstruction += " You are an expert content strategist and creative thinker.";
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

    console.log(`[API Generate] Creating stream...`);
    const stream = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: openAiMessages,
      stream: true,
      max_tokens: 4000,
    });

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || "";
      if (content) {
        res.write(content);
      }
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
