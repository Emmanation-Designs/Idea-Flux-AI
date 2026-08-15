import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mic, MicOff, SlidersHorizontal, X, Plus, Send } from 'lucide-react';
import { LiveVoiceOrb } from './LiveVoiceOrb';
import { LiveVoiceSelector } from './LiveVoiceSelector';
import { LiveMicPermissionModal } from './LiveMicPermissionModal';
import { LiveSessionState } from '../types/live';
import { Message } from '../types';
import { toast } from 'sonner';

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

  // WebRTC & Audio Refs
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const remoteAudioElRef = useRef<HTMLAudioElement | null>(null);
  const heartbeatTimerRef = useRef<NodeJS.Timeout | null>(null);
  const secondsTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Handle voice selection with persistence and dynamic WebRTC session update
  const handleSelectVoice = (voiceId: string) => {
    setSessionState((prev) => ({ ...prev, selectedVoice: voiceId }));
    try {
      localStorage.setItem('trelvix_live_selected_voice', voiceId);
    } catch (e) {
      // ignore localstorage errors
    }

    // If WebRTC DataChannel is open, immediately update live session voice
    if (dcRef.current && dcRef.current.readyState === 'open') {
      console.log(`[Live Voice] Dynamic session.update sent to WebRTC: ${voiceId}`);
      try {
        dcRef.current.send(JSON.stringify({
          type: 'session.update',
          session: {
            voice: voiceId,
            audio: {
              output: {
                voice: voiceId,
              },
            },
          },
        }));
      } catch (err) {
        console.warn('[Live Voice] Failed to send session.update to DataChannel:', err);
      }
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

  // Check microphone consent on open
  useEffect(() => {
    if (!isOpen) return;

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

  // Start Realtime Session via WebRTC
  const initRealtimeSession = async () => {
    try {
      setSessionState((prev) => ({ ...prev, status: 'connecting', error: null }));

      const token = await getAuthToken();
      if (!token) {
        throw new Error('Authentication required to start Live Mode.');
      }

      const activeVoice = sessionState.selectedVoice || (typeof window !== 'undefined' ? localStorage.getItem('trelvix_live_selected_voice') : null) || 'marin';
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
      }));

      // 2. Request local microphone access
      const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = micStream;

      // 3. Setup RTCPeerConnection
      const pc = new RTCPeerConnection();
      pcRef.current = pc;

      // Add mic audio track
      const audioTrack = micStream.getAudioTracks()[0];
      pc.addTrack(audioTrack);

      // Setup remote audio element
      const remoteAudio = document.createElement('audio');
      remoteAudio.autoplay = true;
      remoteAudioElRef.current = remoteAudio;

      pc.ontrack = (e) => {
        remoteAudio.srcObject = e.streams[0];
        setSessionState((prev) => ({ ...prev, status: 'ai_speaking' }));
      };

      // 4. Create DataChannel for realtime event handling and barge-in
      const dc = pc.createDataChannel('oai-events');
      dcRef.current = dc;

      dc.onopen = () => {
        setSessionState((prev) => ({ ...prev, status: 'listening' }));
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

  // Handle incoming OpenAI Realtime DataChannel events
  const handleRealtimeEvent = (event: any) => {
    switch (event.type) {
      case 'input_audio_buffer.speech_started':
        if (dcRef.current && dcRef.current.readyState === 'open') {
          dcRef.current.send(JSON.stringify({ type: 'response.cancel' }));
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
          setLiveTranscript((prev) => [...prev, { role: 'assistant', text: event.transcript }]);
        }
        break;

      case 'conversation.item.input_audio_transcription.completed':
        if (event.transcript) {
          setLiveTranscript((prev) => [...prev, { role: 'user', text: event.transcript }]);
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

    setLiveTranscript((prev) => [...prev, { role: 'user', text: messageText }]);

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

    if (liveTranscript.length > 0) {
      const formattedMessages: Message[] = liveTranscript.map((item, idx) => ({
        id: `live_${Date.now()}_${idx}`,
        role: item.role,
        content: item.text,
        created_at: new Date().toISOString(),
        model: 'trelvix-live',
      }));
      onNewMessages(formattedMessages);
    }
  };

  const handleExit = () => {
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
        <main className="relative flex-1 flex items-center justify-center p-6">
          <LiveVoiceOrb
            status={sessionState.status}
            userVolume={sessionState.userVolume}
            aiVolume={sessionState.aiVolume}
            size={270}
          />
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
