import { Request, Response } from "express";
import fs from "fs";
import path from "path";

/**
 * Handles generating an ephemeral session token for OpenAI Realtime API (WebRTC) using a clean, native fetch request
 * to the general availability endpoints of OpenAI.
 * Ensures permanent API keys are kept safe on the server and utilizes lazy initialization.
 */
export async function handleRealtimeSession(req: Request, res: Response) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("[Realtime Backend] OPENAI_API_KEY is not defined in environment variables.");
    return res.status(500).json({ error: "OpenAI API Key is not configured on the server." });
  }

  try {
    const requestedVoice = req.body.voice || "alloy";
    const validVoices = ["alloy", "ash", "ballad", "coral", "echo", "sage", "shimmer", "verse"];
    const voice = validVoices.includes(requestedVoice.toLowerCase())
      ? (requestedVoice.toLowerCase() as "alloy" | "ash" | "ballad" | "coral" | "echo" | "sage" | "shimmer" | "verse")
      : "alloy";

    const systemInstruction = `You are Trelvix AI, a highly intelligent, direct, and conversational AI companion.
You are powered by a custom high-intelligence engine designed by Ingenium Virtual Assistant Limited.
CORE PROTOCOLS for Voice Mode:
1. Speak in a very conversational, friendly, and authentic tone. Keep responses brief, engaging, and clear.
2. Avoid markdown or bullet lists in your answers, as your output is spoken directly as audio. Use normal sentences with natural punctuation.
3. Be helpful, concise, and encourage two-way dialogue.
4. If the user interrupts you (barge-in), stay responsive and adjust your state.`;

    const requestBody = {
      session: {
        type: "realtime",
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
      }
    };

    console.log(`[Realtime Backend] Creating official OpenAI ephemeral session with voice [${voice}]...`);
    console.log("[Realtime Backend] Target endpoint: https://api.openai.com/v1/realtime/client_secrets");
    console.log("[Realtime Backend] Payload sent down to OpenAI:\n", JSON.stringify(requestBody, null, 2));

    const apiResponse = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(requestBody)
    });

    if (!apiResponse.ok) {
      const errorText = await apiResponse.text();
      console.error("[Realtime Backend] OpenAI response failed with status:", apiResponse.status, errorText);
      try {
        const errorJson = JSON.parse(errorText);
        return res.status(apiResponse.status).json(errorJson);
      } catch {
        return res.status(apiResponse.status).json({ error: errorText || "Failed to create ephemeral session from OpenAI." });
      }
    }

    const sessionData = await apiResponse.json();
    console.log("[Realtime Backend] Ephemeral session created successfully via OpenAI REST client_secrets API.");
    return res.json(sessionData);
  } catch (err: any) {
    console.error("Realtime error:", err);

    if (err instanceof Error) {
      console.error(err.stack);
    }

    return res.status(500).json({
      error: err?.message || "Internal server error during ephemeral session generation via OpenAI REST API."
    });
  }
}
