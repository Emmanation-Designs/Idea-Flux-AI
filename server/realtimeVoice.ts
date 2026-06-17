import { Request, Response } from "express";

/**
 * Handles generating an ephemeral session token for OpenAI Realtime API (WebRTC).
 * Ensures permanent API keys are kept safe on the server.
 */
export async function handleRealtimeSession(req: Request, res: Response) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("[Realtime Backend] OPENAI_API_KEY is not defined in environment variables.");
    return res.status(500).json({ error: "OpenAI API Key is not configured on the server." });
  }

  try {
    const requestedVoice = req.body.voice || "alloy";
    const validVoices = ["alloy", "echo", "shimmer", "ash", "ballad", "coral", "sage", "verse"];
    const voice = validVoices.includes(requestedVoice.toLowerCase()) ? requestedVoice.toLowerCase() : "alloy";

    const systemInstruction = `You are Trelvix AI, a highly intelligent, direct, and conversational AI companion.
You are powered by a custom high-intelligence engine designed by Ingenium Virtual Assistant Limited.
CORE PROTOCOLS for Voice Mode:
1. Speak in a very conversational, friendly, and authentic tone. Keep responses brief, engaging, and clear.
2. Avoid markdown or bullet lists in your answers, as your output is spoken directly as audio. Use normal sentences with natural punctuation.
3. Be helpful, concise, and encourage two-way dialogue.
4. If the user interrupts you (barge-in), stay responsive and adjust your state.`;

    console.log(`[Realtime Backend] Creating ephemeral session with voice [${voice}]...`);

    const response = await fetch("https://api.openai.com/v1/realtime/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-realtime-preview-2024-12-17",
        voice: voice,
        instructions: systemInstruction,
        modalities: ["audio", "text"],
        input_audio_format: "g711_ulaw",
        output_audio_format: "g711_ulaw",
        input_audio_transcription: {
          model: "whisper-1"
        },
        turn_detection: {
          type: "server_vad",
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 500
        }
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[Realtime Backend] OpenAI response error: ${response.status} - ${errText}`);
      return res.status(response.status).json({ error: `Failed to fetch session from OpenAI: ${errText}` });
    }

    const sessionData = await response.json();
    console.log("[Realtime Backend] Ephemeral session created successfully.", sessionData.id);
    return res.json(sessionData);
  } catch (err: any) {
    console.error("[Realtime Backend] Unexpected exception in session generator:", err);
    return res.status(500).json({ error: err?.message || "Internal server error generation" });
  }
}
