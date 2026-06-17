import { useEffect, useRef, useState, useCallback } from "react";
import { fetchEphemeralToken } from "../services/realtimeVoice";

export type VoiceModeStatus =
  | "disconnected"
  | "connecting"
  | "listening"
  | "thinking"
  | "speaking"
  | "interrupted"
  | "reconnecting";

export interface VoiceMessagePair {
  userText: string;
  assistantText: string;
}

interface UseVoiceModeProps {
  voiceOption: string;
  onSaveMessagePair?: (userText: string, assistantText: string) => void;
}

export function useVoiceMode({ voiceOption, onSaveMessagePair }: UseVoiceModeProps) {
  const [status, setStatus] = useState<VoiceModeStatus>("disconnected");
  const [error, setError] = useState<string | null>(null);
  
  // Accumulated transcripts
  const [userTranscript, setUserTranscript] = useState<string>("");
  const [assistantTranscript, setAssistantTranscript] = useState<string>("");

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);

  // References to keep track of current text for session completion saving
  const currentUserTextRef = useRef<string>("");
  const currentAssistantTextRef = useRef<string>("");
  const isAssistantActiveRef = useRef<boolean>(false);

  // Set up remote audio element
  const initAudioEl = useCallback(() => {
    if (!remoteAudioRef.current) {
      console.log("[useVoiceMode] Pre-configuring remote audio player...");
      const audio = document.createElement("audio");
      audio.autoplay = true;
      audio.setAttribute("referrerpolicy", "no-referrer");
      remoteAudioRef.current = audio;
    }
    return remoteAudioRef.current;
  }, []);

  // Gracefully disconnect everything
  const disconnect = useCallback(() => {
    console.log("[useVoiceMode] Cleaning up active WebRTC session...");
    setStatus("disconnected");

    // Close data channel
    if (dcRef.current) {
      try {
        dcRef.current.close();
      } catch (e) {
        // Safe ignore
      }
      dcRef.current = null;
    }

    // Close peer connection
    if (pcRef.current) {
      try {
        pcRef.current.close();
      } catch (e) {
        // Safe ignore
      }
      pcRef.current = null;
    }

    // Stop mic stream tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (e) {
          // Safe ignore
        }
      });
      localStreamRef.current = null;
    }

    // Handle remote audio stop
    if (remoteAudioRef.current) {
      try {
        remoteAudioRef.current.srcObject = null;
        remoteAudioRef.current.pause();
      } catch (e) {
        // Safe ignore
      }
    }

    // Emit final transcript updates to conversation
    const finalUser = currentUserTextRef.current.trim();
    const finalAsst = currentAssistantTextRef.current.trim();
    if (finalUser && finalAsst && onSaveMessagePair) {
      onSaveMessagePair(finalUser, finalAsst);
    }

    currentUserTextRef.current = "";
    currentAssistantTextRef.current = "";
    isAssistantActiveRef.current = false;
  }, [onSaveMessagePair]);

  // Connect to OpenAI WebRTC Realtime
  const connect = useCallback(async () => {
    try {
      setError(null);
      setStatus("connecting");
      setUserTranscript("");
      setAssistantTranscript("");
      currentUserTextRef.current = "";
      currentAssistantTextRef.current = "";
      isAssistantActiveRef.current = false;

      // 1. Ensure remote audio element is initialized
      const audioEl = initAudioEl();

      // 2. Fetch secure Ephemeral token from our backend
      const ephemeralToken = await fetchEphemeralToken(voiceOption);

      // 3. Request high-quality microphone access with Echo Cancellation & Noise Suppression
      console.log("[useVoiceMode] Requesting mic access...");
      const localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      localStreamRef.current = localStream;

      // 4. Initialize RTCPeerConnection (Using default STUN server)
      console.log("[useVoiceMode] Initializing peer connection...");
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });
      pcRef.current = pc;

      // Add local microphone tracks to WebRTC connection
      localStream.getTracks().forEach((track) => {
        pc.addTrack(track, localStream);
      });

      // Handle receiving incoming remote audio track from OpenAI Realtime
      pc.ontrack = (event) => {
        console.log("[useVoiceMode] Incoming remote audio track received!");
        if (event.streams && event.streams[0]) {
          audioEl.srcObject = event.streams[0];
        }
      };

      // 5. Establish real-time data channel for OAI events
      const dc = pc.createDataChannel("oai-events");
      dcRef.current = dc;

      dc.onopen = () => {
        console.log("[useVoiceMode] Real-time DataChannel is open!");
        setStatus("listening");
      };

      dc.onclose = () => {
        console.log("[useVoiceMode] Real-time DataChannel is closed");
        disconnect();
      };

      dc.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          
          switch (payload.type) {
            case "input_audio_buffer.speech_started":
              console.log("[useVoiceMode] User speech started (VAD) - Handling Interruption/Barge-in");
              // State transition
              setStatus("interrupted");
              
              // 1. Immediately pause local playback
              if (audioEl) {
                audioEl.pause();
                // We can reset track slightly or clear src to instantly truncate audio buffer
                const stream = audioEl.srcObject;
                audioEl.srcObject = null;
                // Wait a tiny bit and restore stream to allow subsequent speaking
                setTimeout(() => {
                  if (pcRef.current && status !== "disconnected") {
                    audioEl.srcObject = stream;
                  }
                }, 50);
              }

              // 2. Cancel OpenAI assistant speech output
              if (dcRef.current && dcRef.current.readyState === "open") {
                dcRef.current.send(JSON.stringify({ type: "response.cancel" }));
              }
              isAssistantActiveRef.current = false;
              break;

            case "input_audio_buffer.speech_stopped":
              console.log("[useVoiceMode] User speech stopped");
              setStatus("thinking");
              break;

            case "conversation.item.input_audio_transcription.completed":
              // Live transcription of the user's spoken words
              const text = payload.transcript || "";
              if (text.trim()) {
                console.log("[useVoiceMode] Spoken word transcribed:", text);
                setUserTranscript(prev => {
                  const updated = prev ? `${prev} \nUser: ${text}` : `User: ${text}`;
                  currentUserTextRef.current = updated;
                  return updated;
                });
              }
              break;

            case "response.audio_transcript.delta":
              // Live delta stream of Assistant response
              const delta = payload.delta || "";
              isAssistantActiveRef.current = true;
              setStatus("speaking");
              setAssistantTranscript(prev => {
                const updated = prev + delta;
                currentAssistantTextRef.current = updated;
                return updated;
              });
              break;

            case "response.audio_transcript.done":
              console.log("[useVoiceMode] Assistant response finished");
              isAssistantActiveRef.current = false;
              setStatus("listening");
              break;

            case "response.created":
              setStatus("thinking");
              break;

            case "error":
              console.error("[useVoiceMode] OpenAI Realtime Error event:", payload.error);
              setError(payload.error?.message || "Unknown OpenAI error");
              break;

            default:
              // Generic event log or telemetry placeholder can go here if needed internally block-free
              break;
          }
        } catch (err) {
          console.error("[useVoiceMode] Datachannel json parsing exception:", err);
        }
      };

      // 6. Begin SDP Negotiation Offer with OpenAI API WebRTC End-point
      console.log("[useVoiceMode] Setting local offer SDP...");
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const oaiModel = "gpt-4o-realtime-preview-2024-12-17";
      const oaiUrl = `https://api.openai.com/v1/realtime?model=${oaiModel}`;

      console.log("[useVoiceMode] Dispatching offer SDP to OpenAI...");
      const sdpResponse = await fetch(oaiUrl, {
        method: "POST",
        body: offer.sdp,
        headers: {
          "Authorization": `Bearer ${ephemeralToken}`,
          "Content-Type": "application/sdp",
        },
      });

      if (!sdpResponse.ok) {
        const errorText = await sdpResponse.text();
        throw new Error(`OpenAI SDP handshake failed: ${errorText || sdpResponse.statusText}`);
      }

      console.log("[useVoiceMode] WebRTC offer handshaked, configuring answer SDP...");
      const answerSDP = await sdpResponse.text();
      await pc.setRemoteDescription({
        type: "answer",
        sdp: answerSDP,
      });

      console.log("[useVoiceMode] WebRTC connection established! Continuous listening is active.");
      
    } catch (err: any) {
      console.error("[useVoiceMode] Initialization exception caught:", err);
      setError(err?.message || "Failed to start Voice Mode session. Inspect your console or OpenAI settings.");
      setStatus("disconnected");
      disconnect();
    }
  }, [voiceOption, initAudioEl, disconnect, status]);

  // Clean up on component unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    status,
    error,
    userTranscript,
    assistantTranscript,
    connect,
    disconnect,
  };
}
