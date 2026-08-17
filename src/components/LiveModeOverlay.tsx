import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mic, MicOff, SlidersHorizontal, X, Plus, Send, Globe, Sparkles } from 'lucide-react';
import { LiveVoiceOrb } from './LiveVoiceOrb';
import { LiveVoiceSelector } from './LiveVoiceSelector';
import { LiveMicPermissionModal } from './LiveMicPermissionModal';
import { LiveSessionState } from '../types/live';
import { Message } from '../types';
import { toast } from 'sonner';
import { playLiveOpenSound, playLiveCloseSound } from '../utils/liveAudioSounds';

interface LiveModeOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  onNewMessages: (messages: Message[]) => void;
  getAuthToken: () => Promise<string | null>;
  userPlan?: string;
}

export const LiveModeOverlay: React.FC<LiveModeOverlayProps> = ({
  isOpen,
  onClose,
  onNewMessages,
  getAuthToken,
}) => {
  const [sessionState, setSessionState] = useState<LiveSessionState>(() => ({
    status: 'idle',
    sessionId: null,
    liveSessionId: null,
    error: null,
    isMuted: false,
    selectedVoice: (typeof window !== 'undefined' ? localStorage.getItem('trelvix_live_selected_voice') : null) || 'marin',
    selectedLanguage: (typeof window !== 'undefined' ? localStorage.getItem('trelvix_live_selected_language') : null) || 'auto',
    userVolume: 0,
    aiVolume: 0,
    activeSeconds: 0,
  }));

  const [showSettings, setShowSettings] = useState(false);
  const [showMicPermission, setShowMicPermission] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [isTypingExpanded, setIsTypingExpanded] = useState(false);

  // Transcripts recorded during the session
  const [liveTranscript, setLiveTranscript] = useState<{ role: 'user' | 'assistant'; text: string }[]>([]);
  const transcriptItemsRef = useRef<{ role: 'user' | 'assistant'; text: string }[]>([]);

  // WebRTC & Audio Refs
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const remoteAudioElRef = useRef<HTMLAudioElement | null>(null);
  const heartbeatTimerRef = useRef<NodeJS.Timeout | null>(null);
  const secondsTimerRef = useRef<NodeJS.Timeout | null>(null);
  const handledCallIdsRef = useRef<Set<string>>(new Set());

  // Helper to reliably append transcript records
  const appendTranscript = (role: 'user' | 'assistant', text: string) => {
    const clean = text?.trim();
    if (!clean) return;
    const items = transcriptItemsRef.current;
    if (items.length > 0 && items[items.length - 1].role === role && items[items.length - 1].text === clean) {
      return;
    }
    const updated = [...items, { role, text: clean }];
    transcriptItemsRef.current = updated;
    setLiveTranscript(updated);
  };

  // Handle voice selection with persistence and immediate live session reconnect
  const handleSelectVoice = (voiceId: string) => {
    setSessionState((prev) => ({ ...prev, selectedVoice: voiceId }));
    try {
      localStorage.setItem('trelvix_live_selected_voice', voiceId);
    } catch (e) {
      // ignore localstorage errors
    }

    // If session is active, seamlessly reconnect with the chosen voice
    if (pcRef.current && sessionState.status !== 'idle' && sessionState.status !== 'error') {
      console.log(`[Live Voice] Seamlessly switching active Live voice to: ${voiceId}`);
      cleanupRealtimeSession();
      setTimeout(() => {
        initRealtimeSession(voiceId);
      }, 120);
    }
  };

  const handleSelectLanguage = (lang: string) => {
    setSessionState((prev) => ({ ...prev, selectedLanguage: lang }));
    try {
      localStorage.setItem('trelvix_live_selected_language', lang);
    } catch (e) {
      // ignore
    }
  };

  // Check microphone consent and play chime on open
  useEffect(() => {
    if (!isOpen) return;

    playLiveOpenSound();

    const hasConsented = localStorage.getItem('trelvix_live_mic_consent_v1');
    if (!hasConsented) {
      setShowMicPermission(true);
    } else {
      initRealtimeSession();
    }

    return () => {
      cleanupRealtimeSession();
    };
  }, [isOpen]);

  // Duration timer for background heartbeat accounting
  useEffect(() => {
    if (sessionState.status !== 'idle' && sessionState.status !== 'connecting' && sessionState.status !== 'error') {
      secondsTimerRef.current = setInterval(() => {
        setSessionState((prev) => ({ ...prev, activeSeconds: prev.activeSeconds + 1 }));
      }, 1000);
    } else {
      if (secondsTimerRef.current) clearInterval(secondsTimerRef.current);
    }
    return () => {
      if (secondsTimerRef.current) clearInterval(secondsTimerRef.current);
    };
  }, [sessionState.status]);

  const handleAgreeMic = () => {
    localStorage.setItem('trelvix_live_mic_consent_v1', 'true');
    setShowMicPermission(false);
    initRealtimeSession();
  };

  const handleDeclineMic = () => {
    setShowMicPermission(false);
    onClose();
  };

  // Start Realtime Session via WebRTC with robust audio constraints
  const initRealtimeSession = async (overrideVoice?: string) => {
    try {
      setSessionState((prev) => ({ ...prev, status: 'connecting', error: null }));

      const token = await getAuthToken();
      if (!token) {
        throw new Error('Authentication required to start Live Mode.');
      }

      const activeVoice = overrideVoice || sessionState.selectedVoice || (typeof window !== 'undefined' ? localStorage.getItem('trelvix_live_selected_voice') : null) || 'marin';
      const activeLanguage = sessionState.selectedLanguage || (typeof window !== 'undefined' ? localStorage.getItem('trelvix_live_selected_language') : null) || 'auto';

      console.log(`[Live Mode] Initializing Realtime Session with voice: ${activeVoice}, language: ${activeLanguage}`);

      // 1. Fetch ephemeral session key from backend (server determines authoritative model)
      const res = await fetch('/api/realtime/session', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          voice: activeVoice,
          language: activeLanguage,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Failed to initialize realtime session with server.');
      }

      const sessionData = await res.json();
      const ephemeralKey = sessionData.client_secret?.value;
      const liveSessionId = sessionData.live_session_id;

      if (!ephemeralKey) {
        throw new Error('Server returned invalid session token.');
      }

      setSessionState((prev) => ({
        ...prev,
        sessionId: sessionData.session_id,
        liveSessionId,
        selectedVoice: activeVoice,
      }));

      // 2. Request local microphone access with hardware acoustic echo cancellation & noise suppression
      const micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: { ideal: true },
          noiseSuppression: { ideal: true },
          autoGainControl: { ideal: true },
          channelCount: 1,
        }
      });
      micStreamRef.current = micStream;

      // 3. Setup RTCPeerConnection
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });
      pcRef.current = pc;

      // Add mic audio track
      const audioTrack = micStream.getAudioTracks()[0];
      pc.addTrack(audioTrack);

      // Setup remote audio element
      let remoteAudio = remoteAudioElRef.current;
      if (!remoteAudio) {
        remoteAudio = document.createElement('audio');
        remoteAudio.autoplay = true;
        remoteAudio.setAttribute('playsinline', 'true');
        remoteAudioElRef.current = remoteAudio;
      }

      pc.ontrack = (e) => {
        if (remoteAudio) {
          remoteAudio.srcObject = e.streams[0];
          remoteAudio.play().catch((err) => console.warn('[Live Audio] Remote audio play notice:', err));
        }
        setSessionState((prev) => ({ ...prev, status: 'ai_speaking' }));
      };

      // 4. Create DataChannel for realtime event handling and barge-in
      const dc = pc.createDataChannel('oai-events');
      dcRef.current = dc;

      dc.onopen = () => {
        setSessionState((prev) => ({ ...prev, status: 'listening' }));
        // Enable input audio transcription over DataChannel session.update
        try {
          dc.send(JSON.stringify({
            type: 'session.update',
            session: {
              input_audio_transcription: {
                model: 'whisper-1'
              }
            }
          }));
        } catch (e) {
          console.warn('[Live Mode] session.update transcription error:', e);
        }
      };

      dc.onmessage = (e) => {
        try {
          const event = JSON.parse(e.data);
          handleRealtimeEvent(event);
        } catch (err) {
          console.warn('[Live Mode] Message parse error:', err);
        }
      };

      // 5. Audio Analyzer for reactive Orb visualization
      setupAudioAnalyzers(micStream);

      // 6. SDP Offer Exchange with official OpenAI Realtime Calls API (POST /v1/realtime/calls)
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const sdpRes = await fetch('https://api.openai.com/v1/realtime/calls', {
        method: 'POST',
        body: offer.sdp,
        headers: {
          'Authorization': `Bearer ${ephemeralKey}`,
          'Content-Type': 'application/sdp',
        },
      });

      if (!sdpRes.ok) {
        const sdpErrText = await sdpRes.text().catch(() => '');
        console.error('[Live Mode] Realtime Calls SDP negotiation failed:', sdpRes.status, sdpErrText);
        throw new Error('WebRTC audio connection could not be established with AI provider.');
      }

      const answerSdp = await sdpRes.text();
      await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });

      // 7. Start periodic heartbeat for capacity accounting
      startHeartbeatTimer(liveSessionId, token);

    } catch (err: any) {
      console.error('[Live Mode Error]:', err);
      setSessionState((prev) => ({
        ...prev,
        status: 'error',
        error: err.message || 'Failed to establish Live Mode connection.',
      }));
      toast.error(err.message || 'Live Mode connection failed.');
    }
  };

  // Setup Web Audio AnalyserNodes for mic & AI volume
  const setupAudioAnalyzers = (micStream: MediaStream) => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioCtx;

      const micSource = audioCtx.createMediaStreamSource(micStream);
      const micAnalyser = audioCtx.createAnalyser();
      micAnalyser.fftSize = 128;
      micSource.connect(micAnalyser);

      const dataArray = new Uint8Array(micAnalyser.frequencyBinCount);

      const checkVolume = () => {
        if (!audioContextRef.current) return;
        micAnalyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length / 255;
        setSessionState((prev) => ({ ...prev, userVolume: avg }));

        if (avg > 0.15 && sessionState.status !== 'user_speaking') {
          setSessionState((prev) => ({ ...prev, status: 'user_speaking' }));
        }

        requestAnimationFrame(checkVolume);
      };

      checkVolume();
    } catch (e) {
      console.warn('[Live Mode] Audio analyzer notice:', e);
    }
  };

  // Handle tool and function calls from OpenAI Realtime API
  const handleFunctionCall = async (callId: string, functionName: string, argumentsString: string) => {
    if (!callId || handledCallIdsRef.current.has(callId)) return;
    handledCallIdsRef.current.add(callId);

    console.log(`[Live Mode Tool] Received tool call "${functionName}" (call_id: ${callId}) args:`, argumentsString);

    if (functionName === 'search_web') {
      try {
        setSessionState((prev) => ({ ...prev, status: 'searching' }));
        let query = '';
        try {
          const parsed = JSON.parse(argumentsString);
          query = parsed.query || '';
        } catch {
          query = argumentsString;
        }

        console.log(`[Live Web Search] Querying live Tavily search: "${query}"`);
        const token = await getAuthToken();
        const searchRes = await fetch('/api/realtime/search', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ query }),
        });

        let searchOutput = "No search results found.";
        if (searchRes.ok) {
          const searchData = await searchRes.json();
          searchOutput = searchData.formatted || searchData.answer || JSON.stringify(searchData.results);
        } else {
          const errData = await searchRes.json().catch(() => ({}));
          console.warn('[Live Web Search] Search request failed:', errData);
          searchOutput = `Search failed or unavailable. Proceed using best internal knowledge.`;
        }

        console.log(`[Live Web Search] Returning search results to WebRTC DataChannel (call_id: ${callId})`);

        if (dcRef.current && dcRef.current.readyState === 'open') {
          // Send function call output to OpenAI Realtime DataChannel
          dcRef.current.send(JSON.stringify({
            type: 'conversation.item.create',
            item: {
              type: 'function_call_output',
              call_id: callId,
              output: searchOutput,
            },
          }));

          // Instruct model to generate spoken response using the fresh search data
          dcRef.current.send(JSON.stringify({
            type: 'response.create',
          }));
        }

        setSessionState((prev) => ({ ...prev, status: 'thinking' }));
      } catch (err) {
        console.error('[Live Tool Error]:', err);
        if (dcRef.current && dcRef.current.readyState === 'open') {
          dcRef.current.send(JSON.stringify({
            type: 'conversation.item.create',
            item: {
              type: 'function_call_output',
              call_id: callId,
              output: 'Error executing live search.',
            },
          }));
          dcRef.current.send(JSON.stringify({
            type: 'response.create',
          }));
        }
        setSessionState((prev) => ({ ...prev, status: 'listening' }));
      }
    }
  };

  // Handle incoming OpenAI Realtime DataChannel events
  const handleRealtimeEvent = (event: any) => {
    switch (event.type) {
      case 'input_audio_buffer.speech_started':
        // Only cancel in-flight response if AI was actively speaking/generating
        if (sessionState.status === 'ai_speaking' && dcRef.current && dcRef.current.readyState === 'open') {
          try {
            dcRef.current.send(JSON.stringify({ type: 'response.cancel' }));
          } catch (e) {
            // ignore if no active response
          }
        }
        setSessionState((prev) => ({ ...prev, status: 'user_speaking' }));
        break;

      case 'input_audio_buffer.speech_stopped':
        setSessionState((prev) => ({ ...prev, status: 'thinking' }));
        break;

      case 'response.audio.delta':
        setSessionState((prev) => ({ ...prev, status: 'ai_speaking', aiVolume: 0.7 }));
        break;

      case 'response.audio.done':
        setSessionState((prev) => ({ ...prev, status: 'listening', aiVolume: 0 }));
        break;

      case 'response.audio_transcript.done':
        if (event.transcript) {
          appendTranscript('assistant', event.transcript);
        }
        break;

      case 'conversation.item.input_audio_transcription.completed':
        if (event.transcript) {
          appendTranscript('user', event.transcript);
        }
        break;

      // Handle function calling / tool execution events from OpenAI Realtime
      case 'response.function_call_arguments.done':
        if (event.call_id && event.name) {
          handleFunctionCall(event.call_id, event.name, event.arguments || '{}');
        }
        break;

      case 'response.output_item.done':
        if (event.item?.type === 'function_call') {
          handleFunctionCall(event.item.call_id, event.item.name, event.item.arguments || '{}');
        } else if (event.item?.type === 'message' && event.item?.role === 'assistant') {
          const textPart = event.item.content?.find((c: any) => c.type === 'text')?.text || event.item.content?.find((c: any) => c.type === 'audio')?.transcript;
          if (textPart) {
            appendTranscript('assistant', textPart);
          }
        }
        break;

      case 'response.done':
        if (event.response?.output) {
          for (const item of event.response.output) {
            if (item.type === 'function_call') {
              handleFunctionCall(item.call_id, item.name, item.arguments || '{}');
            }
          }
        }
        break;

      default:
        break;
    }
  };

  // Periodic Heartbeat to settle active minutes
  const startHeartbeatTimer = (liveSessionId: string, token: string) => {
    if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);

    heartbeatTimerRef.current = setInterval(async () => {
      try {
        await fetch('/api/realtime/heartbeat', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            live_session_id: liveSessionId,
            duration_seconds: sessionState.activeSeconds,
          }),
        });
      } catch (e) {
        console.warn('[Live Heartbeat Error]:', e);
      }
    }, 25000);
  };

  // Toggle Mute / Unmute
  const toggleMute = () => {
    if (micStreamRef.current) {
      const audioTrack = micStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = sessionState.isMuted;
        setSessionState((prev) => ({
          ...prev,
          isMuted: !prev.isMuted,
          status: !prev.isMuted ? 'muted' : 'listening',
        }));
      }
    }
  };

  // Text message submission during Live Mode
  const handleSendText = () => {
    if (!textInput.trim() || !dcRef.current || dcRef.current.readyState !== 'open') return;

    const messageText = textInput.trim();
    setTextInput('');
    setIsTypingExpanded(false);

    appendTranscript('user', messageText);

    dcRef.current.send(
      JSON.stringify({
        type: 'conversation.item.create',
        item: {
          type: 'message',
          role: 'user',
          content: [{ type: 'input_text', text: messageText }],
        },
      })
    );

    dcRef.current.send(
      JSON.stringify({
        type: 'response.create',
      })
    );

    setSessionState((prev) => ({ ...prev, status: 'thinking' }));
  };

  // Safely cleanup Realtime session and settle usage
  const cleanupRealtimeSession = async () => {
    if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);
    if (secondsTimerRef.current) clearInterval(secondsTimerRef.current);

    if (dcRef.current) {
      dcRef.current.close();
      dcRef.current = null;
    }

    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }

    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    if (sessionState.liveSessionId) {
      try {
        const token = await getAuthToken();
        if (token) {
          await fetch('/api/realtime/end', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              live_session_id: sessionState.liveSessionId,
              duration_seconds: sessionState.activeSeconds,
            }),
          });
        }
      } catch (e) {
        console.warn('[Live Mode End Error]:', e);
      }
    }

    const recordedItems = transcriptItemsRef.current;
    if (recordedItems.length > 0) {
      const formattedMessages: Message[] = recordedItems.map((item, idx) => ({
        id: `live_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
        role: item.role,
        content: item.text,
        created_at: new Date().toISOString(),
        model: 'trelvix-live',
      }));
      onNewMessages(formattedMessages);
      transcriptItemsRef.current = [];
      setLiveTranscript([]);
    }
  };

  const handleExit = () => {
    playLiveCloseSound();
    cleanupRealtimeSession();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex flex-col justify-between bg-black dark:bg-black text-white overflow-hidden select-none"
      >
        {/* Permission Modal */}
        <LiveMicPermissionModal
          isOpen={showMicPermission}
          onAgree={handleAgreeMic}
          onDecline={handleDeclineMic}
        />

        {/* Voice & Settings Selector Modal (Matches Image 3) */}
        <LiveVoiceSelector
          isOpen={showSettings}
          onClose={() => setShowSettings(false)}
          selectedVoice={sessionState.selectedVoice}
          onSelectVoice={handleSelectVoice}
          selectedLanguage={sessionState.selectedLanguage}
          onSelectLanguage={handleSelectLanguage}
        />

        {/* Top Right Sliders / Settings Icon Button (Matches Image 2 & 3) */}
        <div className="absolute top-6 right-6 z-20">
          <button
            onClick={() => setShowSettings(true)}
            className="p-2.5 text-zinc-400 hover:text-white transition-colors"
            title="Voice & Language"
          >
            <SlidersHorizontal className="w-5 h-5 stroke-[2.2]" />
          </button>
        </div>

        {/* Central Fluid Voice Orb (Matches Image 2) */}
        <main className="relative flex-1 flex flex-col items-center justify-center p-6 gap-3">
          <LiveVoiceOrb
            status={sessionState.status}
            userVolume={sessionState.userVolume}
            aiVolume={sessionState.aiVolume}
            size={270}
          />

          {/* Clean Spacing below Orb */}
          <div className="h-4" />
        </main>

        {/* Bottom Bar Pill (Matches Image 2 & 3) */}
        <footer className="w-full pb-8 px-6 z-20">
          <div className="max-w-2xl mx-auto w-full">
            <div className="bg-[#212121] dark:bg-[#1e1f22] border border-zinc-800/80 rounded-full px-3 sm:px-4 py-2 flex items-center justify-between shadow-2xl backdrop-blur-xl transition-all">
              
              {/* Left Side: Type input / button */}
              <div className="flex-1 flex items-center gap-2 pr-2">
                <button
                  onClick={() => setIsTypingExpanded((prev) => !prev)}
                  className="flex items-center gap-1.5 text-zinc-400 hover:text-white transition text-sm font-normal py-1"
                >
                  <Plus className="w-4 h-4 font-bold text-zinc-400" />
                  <span className="text-zinc-400 text-sm">Type</span>
                </button>

                {isTypingExpanded && (
                  <div className="flex-1 flex items-center gap-1 ml-2">
                    <input
                      type="text"
                      autoFocus
                      value={textInput}
                      onChange={(e) => setTextInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSendText()}
                      placeholder="Type a message..."
                      className="w-full bg-transparent border-none outline-none text-xs sm:text-sm text-white placeholder-zinc-500 py-1"
                    />
                    <button
                      onClick={handleSendText}
                      disabled={!textInput.trim()}
                      className="p-1.5 text-zinc-400 hover:text-white disabled:opacity-30 transition"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* Right Side: Microphone Toggle & Close Button */}
              <div className="flex items-center gap-2 shrink-0">
                {/* Mic Mute / Unmute Button */}
                <button
                  onClick={toggleMute}
                  className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-all ${
                    sessionState.isMuted
                      ? 'bg-[#ef4444] text-white shadow-md'
                      : 'bg-transparent text-zinc-400 hover:text-white hover:bg-white/5'
                  }`}
                  title={sessionState.isMuted ? 'Unmute microphone' : 'Mute microphone'}
                >
                  {sessionState.isMuted ? (
                    <MicOff className="w-4 h-4 sm:w-5 sm:h-5" />
                  ) : (
                    <Mic className="w-4 h-4 sm:w-5 sm:h-5" />
                  )}
                </button>

                {/* Close 'X' Button (Solid White Circle with Dark X, Matches Image 2 & 3) */}
                <button
                  onClick={handleExit}
                  className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white text-zinc-900 hover:bg-zinc-200 flex items-center justify-center transition-all shadow-md active:scale-95"
                  title="Exit Live Mode"
                >
                  <X className="w-4 h-4 sm:w-4.5 sm:h-4.5 stroke-[2.5]" />
                </button>
              </div>
            </div>
          </div>
        </footer>
      </motion.div>
    </AnimatePresence>
  );
};
