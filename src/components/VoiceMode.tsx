import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Mic, 
  MicOff, 
  Volume2, 
  VolumeX, 
  Check, 
  Sparkles, 
  Copy, 
  ThumbsUp, 
  ThumbsDown, 
  Sliders,
  PlayCircle,
  HelpCircle,
  Keyboard,
  ArrowLeft
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { toast } from 'sonner';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const VOICES = [
  { id: 'onyx', name: 'Onyx', desc: 'Deep & Resonant', gender: 'male' },
  { id: 'echo', name: 'Echo', desc: 'Warm & Authoritative', gender: 'male' },
  { id: 'atlas', name: 'Atlas', desc: 'Confident & Crisp', gender: 'male' },
  { id: 'fable', name: 'Fable', desc: 'British & Eloquent', gender: 'female' },
  { id: 'nova', name: 'Nova', desc: 'Energetic & Bright', gender: 'female' },
  { id: 'shimmer', name: 'Shimmer', desc: 'Soft & Ethereal', gender: 'female' },
];

const SPEEDS = [
  { value: 0.8, label: '0.8x' },
  { value: 1.0, label: '1.0x (Normal)' },
  { value: 1.2, label: '1.2x' },
  { value: 1.5, label: '1.5x' }
];

interface VoiceModeProps {
  isOpen: boolean;
  onClose: () => void;
  isListening: boolean;
  isPlaying: boolean;
  isLoading: boolean;
  onToggleListening: () => void;
  isSpeakerOn: boolean;
  onToggleSpeaker: () => void;
  voiceOption: string;
  onVoiceOptionChange: (voice: string) => void;
  profile?: any;
  currentTranscript?: string;
  currentResponse?: string;
  onInterruptPlayback?: () => void;
  isDarkMode?: boolean;
}

export const VoiceMode = ({ 
  isOpen, 
  onClose, 
  isListening,
  isPlaying,
  isLoading,
  onToggleListening,
  isSpeakerOn,
  onToggleSpeaker,
  voiceOption,
  onVoiceOptionChange,
  profile,
  currentTranscript = "",
  currentResponse = "",
  onInterruptPlayback,
  isDarkMode = true
}: VoiceModeProps) => {
  const [showVoiceDrawer, setShowVoiceDrawer] = useState(false);
  const [previewingVoice, setPreviewingVoice] = useState<string | null>(null);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  
  // Custom states
  const [showTextResponse, setShowTextResponse] = useState<boolean>(() => {
    const saved = localStorage.getItem('trelvix_show_text_response');
    return saved !== null ? saved === 'true' : true;
  });
  
  const [voiceSpeed, setVoiceSpeed] = useState<number>(() => {
    return Number(localStorage.getItem('trelvix_voice_speed') || '1.0');
  });

  const [hasSpeechOccurred, setHasSpeechOccurred] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [liked, setLiked] = useState<boolean | null>(null);

  // OpenAI Realtime WebRTC states
  const [localIsListening, setLocalIsListening] = useState(false);
  const [localIsPlaying, setLocalIsPlaying] = useState(false);
  const [localIsLoading, setLocalIsLoading] = useState(false);
  const [localCurrentTranscript, setLocalCurrentTranscript] = useState("");
  const [localCurrentResponseText, setLocalCurrentResponseText] = useState("");
  const [localIsSpeakerOn, setLocalIsSpeakerOn] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<"idle" | "connecting" | "connected" | "error">("idle");

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const lastUserTextRef = useRef("");

  // Dialogue synchronization callback from window bridge
  const onAddMessagePair = (isOpen && (window as any).__addVoiceMessagePair) || undefined;

  const startWebRTC = async () => {
    try {
      console.log("[WebRTC] Establishing peer connection channel...");
      setConnectionStatus("connecting");
      setLocalIsLoading(true);
      setLocalCurrentTranscript("");
      setLocalCurrentResponseText("");

      // 1. Obtain ephemeral session token from backend Express secure proxy
      const response = await fetch("/api/realtime/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          voice_option: voiceOption,
          instructions: `Your name is Trelvix AI. Developed by Ingenium Virtual Assistant Limited. You are powered by a custom, high-intelligence engine. Personas/Tone: Crisp, direct, professional and engaging. Warm when needed, but never robotic. Avoid sounding overly corporate. Keep dialogue very brief and highly conversational.`
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to initialize credentials handshake: Secure backend returned status ${response.status}`);
      }

      const data = await response.json();
      const ephemeralToken = data.client_secret?.value;
      if (!ephemeralToken) {
        throw new Error("Client token was missing in session credential allocation object");
      }

      // 2. Initialize vanilla RTCPeerConnection over standard ICE candidates
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
      });
      peerConnectionRef.current = pc;

      // 3. Audio output player configuration
      const audioEl = document.createElement("audio");
      audioEl.autoplay = true;
      audioElRef.current = audioEl;

      pc.ontrack = (event) => {
        console.log("[WebRTC] Audio track linked from OpenAI system");
        audioEl.srcObject = event.streams[0];
        setLocalIsPlaying(true);
      };

      // 4. Connect Microphone Track locally
      const mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = mediaStream;
      const micTrack = mediaStream.getTracks()[0];
      pc.addTrack(micTrack);

      // 5. Establish control Data Channel
      const dc = pc.createDataChannel("oai-events");
      dataChannelRef.current = dc;

      dc.onopen = () => {
        console.log("[WebRTC] Handshake completed successfully, channel active");
        setConnectionStatus("connected");
        setLocalIsListening(true);
        setLocalIsLoading(false);

        // Instruct OpenAI to enable automatic transcribing of our spoken voices
        const sessionUpdate = {
          type: "session.update",
          session: {
            modalities: ["audio", "text"],
            instructions: `Your name is Trelvix AI. Developed by Ingenium Virtual Assistant Limited. You are powered by a custom, high-intelligence engine. Your persona is: direct, authoritative, engaging, concise. Keep statements extremely conversational and brief for spoken speech. NEVER mention OpenAI or your status as an AI unless strictly necessary.`,
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
        dc.send(JSON.stringify(sessionUpdate));
      };

      dc.onmessage = (event) => {
        try {
          const ev = JSON.parse(event.data);
          
          if (ev.type === "response.created") {
            setLocalIsLoading(true);
            setLocalIsPlaying(false);
          }

          if (ev.type === "response.output_item.added") {
            setLocalIsPlaying(true);
            setLocalIsLoading(false);
          }

          if (ev.type === "response.audio_transcript.delta") {
            setLocalIsPlaying(true);
            setLocalIsLoading(false);
            setLocalCurrentResponseText(prev => prev + ev.delta);
          }

          if (ev.type === "conversation.item.input_audio_transcription.completed") {
            const userSpeechText = ev.transcript?.trim();
            if (userSpeechText) {
              setLocalCurrentTranscript(userSpeechText);
              lastUserTextRef.current = userSpeechText;
            }
          }

          if (ev.type === "input_audio_buffer.speech_started") {
            console.log("[WebRTC Barge-in] User speech overlay detected. Silencing stream...");
            setLocalIsPlaying(false);
            setLocalIsLoading(false);
            
            if (dataChannelRef.current && dataChannelRef.current.readyState === "open") {
              dataChannelRef.current.send(JSON.stringify({ type: "response.cancel" }));
            }
            
            setLocalCurrentResponseText("");
          }

          if (ev.type === "response.done") {
            setLocalIsLoading(false);
            setLocalIsPlaying(false);

            const userVal = lastUserTextRef.current;
            const assistantVal = ev.response?.output?.[0]?.content?.[0]?.transcript || "";
            if (userVal) {
              console.log(`[WebRTC Exchange] Syncing User: "${userVal}", Assistant: "${assistantVal}"`);
              if (onAddMessagePair) {
                onAddMessagePair(userVal, assistantVal);
              }
              lastUserTextRef.current = ""; // Reset turn
            }
          }

        } catch (err) {
          console.error("WebRTC message parsing error:", err);
        }
      };

      // 6. SDP negotiation handshake
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const sdpResponse = await fetch("https://api.openai.com/v1/realtime?model=gpt-4o-mini-realtime-preview-2024-12-17", {
        method: "POST",
        body: offer.sdp,
        headers: {
          "Authorization": `Bearer ${ephemeralToken}`,
          "Content-Type": "application/sdp"
        }
      });

      if (!sdpResponse.ok) {
        const errDetails = await sdpResponse.text();
        throw new Error(`SDP Exchange handshake failed with status ${sdpResponse.status}: ${errDetails}`);
      }

      const answerSdp = await sdpResponse.text();
      await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });
      console.log("[WebRTC] Session established successfully");

    } catch (err: any) {
      console.error("[WebRTC] Initialization error observed:", err);
      setConnectionStatus("error");
      setLocalIsLoading(false);
      toast.error(err.message || "Failed to start real-time communications session.");
    }
  };

  const shutdownWebRTC = () => {
    console.log("[WebRTC] Dismantling communications peer link...");
    
    if (dataChannelRef.current) {
      try { dataChannelRef.current.close(); } catch (e) {}
      dataChannelRef.current = null;
    }
    if (peerConnectionRef.current) {
      try { peerConnectionRef.current.close(); } catch (e) {}
      peerConnectionRef.current = null;
    }
    if (localStreamRef.current) {
      try { localStreamRef.current.getTracks().forEach(track => track.stop()); } catch (e) {}
      localStreamRef.current = null;
    }
    if (audioElRef.current) {
      try {
        audioElRef.current.srcObject = null;
        audioElRef.current.pause();
      } catch (e) {}
      audioElRef.current = null;
    }

    setConnectionStatus("idle");
    setLocalIsListening(false);
    setLocalIsPlaying(false);
    setLocalIsLoading(false);
    setLocalCurrentTranscript("");
    setLocalCurrentResponseText("");
    lastUserTextRef.current = "";
  };

  useEffect(() => {
    if (isOpen) {
      startWebRTC();
    } else {
      shutdownWebRTC();
    }
    return () => {
      shutdownWebRTC();
    };
  }, [isOpen, voiceOption]);

  const handleToggleListening = () => {
    if (connectionStatus === "connected") {
      if (localStreamRef.current) {
        const audioTrack = localStreamRef.current.getAudioTracks()[0];
        if (audioTrack) {
          audioTrack.enabled = !audioTrack.enabled;
          setLocalIsListening(audioTrack.enabled);
        }
      }
    } else {
      onToggleListening();
    }
  };

  const handleToggleSpeaker = () => {
    if (connectionStatus === "connected") {
      if (audioElRef.current) {
        audioElRef.current.muted = !audioElRef.current.muted;
        setLocalIsSpeakerOn(!audioElRef.current.muted);
      }
    } else {
      onToggleSpeaker();
    }
  };

  useEffect(() => {
    localStorage.setItem('trelvix_show_text_response', showTextResponse.toString());
  }, [showTextResponse]);

  useEffect(() => {
    localStorage.setItem('trelvix_voice_speed', voiceSpeed.toString());
  }, [voiceSpeed]);

  useEffect(() => {
    const updateVoices = () => {
      setAvailableVoices(window.speechSynthesis.getVoices());
    };
    updateVoices();
    window.speechSynthesis.onvoiceschanged = updateVoices;
    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  // Map WebRTC transcripts & states to local variables
  const activeTranscript = connectionStatus === "connected" ? localCurrentTranscript : currentTranscript;
  const activeResponse = connectionStatus === "connected" ? localCurrentResponseText : currentResponse;
  const activeIsListening = connectionStatus === "connected" ? localIsListening : isListening;
  const activeIsSpeakerOn = connectionStatus === "connected" ? localIsSpeakerOn : isSpeakerOn;

  const state = (connectionStatus === "connecting" || (connectionStatus === "connected" ? localIsLoading : isLoading))
    ? 'thinking'
    : (connectionStatus === "connected" ? localIsPlaying : isPlaying)
    ? 'speaking'
    : activeIsListening
    ? 'listening'
    : 'idle';

  // Monitor transcripts to transition to active dialogue layout gracefully
  useEffect(() => {
    if (activeTranscript.trim().length > 0 || activeResponse.trim().length > 0) {
      setHasSpeechOccurred(true);
    }
  }, [activeTranscript, activeResponse]);

  // Reset dialogue markers on mount/unmount
  useEffect(() => {
    if (isOpen) {
      setHasSpeechOccurred(false);
      setLiked(null);
      setCopied(false);
    } else {
      setShowVoiceDrawer(false);
      setPreviewingVoice(null);
      window.speechSynthesis.cancel();
    }
  }, [isOpen]);

  const handlePreviewVoice = (id: string) => {
    window.speechSynthesis.cancel();
    setPreviewingVoice(id);
    
    const message = "Hi, I am your Trelvix voice assistant. Ready to help.";
    const utterance = new SpeechSynthesisUtterance(message);
    
    const voices = availableVoices.length > 0 ? availableVoices : window.speechSynthesis.getVoices();
    const voiceData = VOICES.find(v => v.id === id);
    
    let selectedVoice = voices.find(v => v.name.toLowerCase().includes(id.toLowerCase()));
    
    if (!selectedVoice) {
      const targetGender = voiceData?.gender || 'male';
      const maleKeywords = ['male', 'david', 'mark', 'guy', 'daniel', 'alex', 'james', 'thomas', 'george', 'paul'];
      const femaleKeywords = ['female', 'zira', 'samantha', 'victoria', 'susan', 'amy', 'linda', 'mary', 'emma'];
      const keywords = targetGender === 'male' ? maleKeywords : femaleKeywords;

      selectedVoice = voices.find(v => {
        const name = v.name.toLowerCase();
        return keywords.some(k => name.includes(k));
      });
    }
    
    if (!selectedVoice) {
      selectedVoice = voices[0];
    }
    
    if (selectedVoice) utterance.voice = selectedVoice;
    utterance.rate = voiceSpeed;

    utterance.onend = () => setPreviewingVoice(null);
    utterance.onerror = () => setPreviewingVoice(null);

    window.speechSynthesis.speak(utterance);
  };

  const copyToClipboard = () => {
    if (!activeResponse) return;
    navigator.clipboard.writeText(activeResponse);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const displayUserName = profile?.name ? profile.name.trim().split(' ')[0] : 'Emmanuel';

  const isDisplayingTextLayout = showTextResponse && hasSpeechOccurred && (activeTranscript || activeResponse);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35, ease: 'easeInOut' }}
          className={cn(
            "fixed inset-0 z-[100] flex flex-col items-center justify-between overflow-hidden font-sans select-none pb-safe",
            isDarkMode 
              ? "bg-[#0b0b0e] text-zinc-100" 
              : "bg-zinc-50/95 text-zinc-900"
          )}
        >
          {/* Ambient Glowing Background Orb Filter Module */}
          <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
            {/* Dynamic Ambient Fluid Colors */}
            <motion.div
              animate={{
                scale: state === 'speaking' ? [1, 1.15, 1] : state === 'listening' ? [1, 1.08, 1] : 0.95,
                opacity: state === 'speaking' ? 0.35 : state === 'listening' ? 0.28 : state === 'thinking' ? 0.32 : 0.15,
                x: state === 'speaking' ? [-10, 10, -10] : 0,
                y: state === 'speaking' ? [5, -10, 5] : 0,
              }}
              transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
              className={cn(
                "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full blur-[110px] pointer-events-none mix-blend-screen",
                isDarkMode 
                  ? "bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.18)_0%,rgba(147,51,234,0.1)_40%,rgba(0,0,0,0)_70%)]"
                  : "bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.09)_0%,rgba(147,51,234,0.05)_50%,rgba(0,0,0,0)_75%)]"
              )}
            />
            {/* Fine Tech Noise / Grid Mesh Overlay */}
            <div className={cn(
              "absolute inset-0 opacity-[0.012] pointer-events-none",
              isDarkMode 
                ? "bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:20px_20px]"
                : "bg-[radial-gradient(#000000_1px,transparent_1px)] [background-size:20px_20px]"
            )} />
          </div>

          {/* Liquid Fluid Mask Filter Definition for high-performance organic blob */}
          <svg className="hidden">
            <defs>
              <filter id="goo">
                <feGaussianBlur in="SourceGraphic" stdDeviation="12" result="blur" />
                <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -8" result="goo" />
                <feBlend in="SourceGraphic" in2="goo" />
              </filter>
            </defs>
          </svg>

          {/* Premium Header Nav Bar */}
          <header className="relative z-10 w-full flex items-center justify-between px-6 py-5 md:px-8 shrink-0 select-none">
            {/* Minimal Back Chevron Handle */}
            <button 
              onClick={onClose}
              className={cn(
                "p-2.5 rounded-full transition-all cursor-pointer flex items-center justify-center border",
                isDarkMode 
                  ? "bg-zinc-950/20 border-zinc-900/60 hover:bg-zinc-900/60 hover:border-zinc-800 text-zinc-400 hover:text-white" 
                  : "bg-white border-zinc-200/80 hover:bg-zinc-100 hover:border-zinc-300 text-zinc-500 hover:text-zinc-900"
              )}
              title="Exit Voice Mode"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>

            {/* Smart Branding Capsule */}
            <div className={cn(
              "flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-[10px] font-bold tracking-[0.18em] uppercase shadow-xs",
              isDarkMode 
                ? "bg-zinc-950/40 border-zinc-900 text-zinc-400" 
                : "bg-white border-zinc-200/60 text-zinc-500"
            )}>
              <span className={cn(
                "inline-block w-1.5 h-1.5 rounded-full",
                state === 'listening' ? "bg-emerald-500 animate-pulse" :
                state === 'speaking' ? "bg-blue-500 animate-pulse" :
                state === 'thinking' ? "bg-amber-500" : "bg-zinc-400"
              )} />
              TRELVIX VOICE
            </div>

            {/* Config Button */}
            <button 
              onClick={() => setShowVoiceDrawer(true)}
              className={cn(
                "p-2.5 rounded-full border transition-all cursor-pointer shadow-xs flex items-center justify-center",
                isDarkMode 
                  ? "bg-zinc-950/40 border-zinc-900 hover:bg-zinc-900/60 hover:border-zinc-800 text-zinc-400 hover:text-white" 
                  : "bg-white border-zinc-200/80 hover:bg-zinc-100 hover:border-zinc-300 text-zinc-500 hover:text-zinc-900"
              )}
              title="Voice Configurations"
            >
              <Sliders className="w-4 h-4" />
            </button>
          </header>

          {/* Main Visualizer Content Core */}
          <main className="relative z-10 flex-1 flex flex-col justify-center items-center w-full max-w-xl px-6 py-2 overflow-y-auto no-scrollbar">
            
            <AnimatePresence mode="wait">
              {!isDisplayingTextLayout ? (
                /* SCREEN 1: THE LIQUID MORPHING BULB INTERACTIVE VIEW (MASTERPIECE OF UI) */
                <motion.div
                  key="fluid-visualizer"
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.35, ease: "easeOut" }}
                  className="flex flex-col items-center justify-center py-6 gap-12 w-full"
                >
                  
                  {/* Organic Liquid Fluid Waveform Orb with Gooey effect */}
                  <div className="relative flex items-center justify-center w-64 h-64 select-none">
                    
                    {/* Background Fluid Core Glow */}
                    <div className="absolute w-[180px] h-[180px] rounded-full filter blur-[40px] opacity-25 mix-blend-screen bg-gradient-to-tr from-cyan-400 via-blue-500 to-purple-600 animate-pulse" />

                    {/* Gooey Blob Mesh Container */}
                    <div 
                      className="absolute inset-0 flex items-center justify-center"
                      style={{ filter: 'url(#goo)' }}
                    >
                      {/* Blob 1 */}
                      <motion.div
                        animate={{
                          x: state === 'speaking' ? [-25, 20, -15, 10, -25] : state === 'listening' ? [-8, 6, -4, 8, -8] : 0,
                          y: state === 'speaking' ? [15, -25, 10, -15, 15] : state === 'listening' ? [4, -6, 5, -8, 4] : 0,
                          scale: state === 'speaking' ? [1, 1.25, 0.9, 1.15, 1] : state === 'listening' ? [1, 1.08, 0.95, 1.05, 1] : 1,
                        }}
                        transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
                        className={cn(
                          "absolute w-28 h-28 rounded-full",
                          isDarkMode 
                            ? "bg-gradient-to-tr from-blue-600 to-indigo-500 opacity-80" 
                            : "bg-gradient-to-tr from-blue-400 to-indigo-300 opacity-85"
                        )}
                      />

                      {/* Blob 2 */}
                      <motion.div
                        animate={{
                          x: state === 'speaking' ? [20, -20, 25, -15, 20] : state === 'listening' ? [6, -8, 5, -4, 6] : 0,
                          y: state === 'speaking' ? [-15, 20, -15, 22, -15] : state === 'listening' ? [-5, 6, -8, 4, -5] : 0,
                          scale: state === 'speaking' ? [0.95, 1.2, 1.02, 0.88, 0.95] : state === 'listening' ? [0.98, 1.05, 1.0, 0.95, 0.98] : 0.95,
                        }}
                        transition={{ duration: 3.8, repeat: Infinity, ease: "easeInOut" }}
                        className={cn(
                          "absolute w-24 h-24 rounded-full",
                          isDarkMode 
                            ? "bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 opacity-75" 
                            : "bg-gradient-to-br from-indigo-350 via-purple-300 to-pink-350 opacity-80"
                        )}
                      />

                      {/* Blob 3 (Evershifting Cyan accent) */}
                      <motion.div
                        animate={{
                          x: state === 'speaking' ? [-10, 25, -20, 15, -10] : state === 'listening' ? [-4, 6, -5, 5, -4] : 0,
                          y: state === 'speaking' ? [-25, 15, -10, -20, -25] : state === 'listening' ? [-6, 5, -4, -6, -6] : 0,
                          scale: state === 'speaking' ? [1.1, 0.85, 1.2, 0.95, 1.1] : state === 'listening' ? [1.02, 0.96, 1.05, 0.98, 1.02] : 1,
                        }}
                        transition={{ duration: 5.2, repeat: Infinity, ease: "easeInOut" }}
                        className={cn(
                          "absolute w-26 h-26 rounded-full",
                          isDarkMode 
                            ? "bg-gradient-to-r from-cyan-500 to-blue-400 opacity-85" 
                            : "bg-gradient-to-r from-cyan-300 to-blue-300 opacity-90"
                        )}
                      />

                      {/* Center Static Solid Core */}
                      <div className={cn(
                        "absolute w-20 h-20 rounded-full flex items-center justify-center border shadow-lg z-20 transition-all",
                        isDarkMode 
                          ? "bg-zinc-950/90 border-white/10" 
                          : "bg-white border-zinc-200/80"
                      )}>
                        <AnimatePresence mode="wait">
                          <motion.div
                            key={state}
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 0.9, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            transition={{ duration: 0.2 }}
                          >
                            {state === 'thinking' ? (
                              <Sparkles className="w-6 h-6 text-indigo-400 animate-pulse" />
                            ) : state === 'speaking' ? (
                              <Volume2 className="w-6 h-6 text-blue-500" />
                            ) : (
                              <Mic className={cn("w-6 h-6", state === 'listening' ? "text-emerald-500" : (isDarkMode ? "text-zinc-500" : "text-zinc-400"))} />
                            )}
                          </motion.div>
                        </AnimatePresence>
                      </div>
                    </div>
                  </div>

                  {/* Elegant typography details matching ChatGPT simple display */}
                  <div className="text-center px-4 max-w-sm">
                    <h1 className={cn(
                      "text-2xl md:text-2.5xl font-semibold tracking-tight leading-snug",
                      isDarkMode ? "color-white text-zinc-100" : "text-zinc-800"
                    )}>
                      {state === 'listening' ? "Listening..." : 
                       state === 'thinking' ? "Thinking..." : 
                       state === 'speaking' ? "Speaking..." : `Let's talk, ${displayUserName}`}
                    </h1>
                    <p className={cn(
                      "text-[10px] tracking-[0.2em] font-semibold mt-3.5 leading-relaxed uppercase opacity-60",
                      isDarkMode ? "text-zinc-500" : "text-zinc-400"
                    )}>
                      {state === 'listening' ? "continuous microphone active" : 
                       state === 'thinking' ? "processing response stream" : 
                       state === 'speaking' ? "real-time audio synthesis active" : "tap visualizer to wake stream"}
                    </p>
                  </div>
                </motion.div>
              ) : (
                /* SCREEN 2: ACTIVE DIALOGUE CONTENT SCREEN */
                <motion.div
                  key="chat-dialogue"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                  className="flex flex-col justify-start items-stretch gap-8 py-4 w-full select-text"
                >
                  {/* User Question */}
                  <div className="flex justify-end w-full">
                    <motion.div 
                      className={cn(
                        "max-w-[85%] rounded-2xl px-4.5 py-3 font-medium text-sm md:text-base text-right tracking-tight shadow-xs border",
                        isDarkMode 
                          ? "bg-zinc-900 border-zinc-850 text-zinc-100" 
                          : "bg-white border-zinc-200 text-zinc-800"
                      )}
                    >
                      {currentTranscript}
                    </motion.div>
                  </div>

                  {/* Assistant response text - matches Grok/Gpt simplicity */}
                  <div className="flex flex-col gap-4.5 items-start w-full">
                    <motion.div 
                      key={currentResponse}
                      initial={{ opacity: 0.95 }}
                      animate={{ opacity: 1 }}
                      className={cn(
                        "text-lg md:text-xl.5 font-medium tracking-tight leading-relaxed text-left max-w-full select-text",
                        isDarkMode ? "text-zinc-200" : "text-zinc-800"
                      )}
                    >
                      {currentResponse}
                    </motion.div>

                    {/* Compact reactions overlay */}
                    <div className="flex items-center gap-4 pt-1 text-zinc-400 select-none">
                      <button 
                        onClick={() => setLiked(true)}
                        className={cn(
                          "p-2 rounded-full transition-all cursor-pointer hover:bg-zinc-900",
                          liked === true && "text-blue-500 bg-blue-500/10"
                        )}
                      >
                        <ThumbsUp className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        onClick={() => setLiked(false)}
                        className={cn(
                          "p-2 rounded-full transition-all cursor-pointer hover:bg-zinc-900",
                          liked === false && "text-rose-500 bg-rose-500/10"
                        )}
                      >
                        <ThumbsDown className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        onClick={copyToClipboard}
                        className={cn(
                          "p-2 rounded-full transition-all cursor-pointer hover:bg-zinc-900 relative",
                          copied && "text-emerald-500 bg-emerald-500/10"
                        )}
                        title="Copy text response"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            
          </main>

          {/* Symmetrical Controls Bar - Floating Clean Capsule Design */}
          <footer className="relative z-10 w-full max-w-md flex flex-col items-center pb-10 px-6 shrink-0 gap-6 select-none">
            
            {/* Integrated Symmetrical Central Capsule Toolbar Container */}
            <div className={cn(
              "p-2 w-full rounded-2.5xl flex items-center justify-between border gap-2 shadow-lg backdrop-blur-md",
              isDarkMode 
                ? "bg-zinc-950/70 border-zinc-900/80" 
                : "bg-white/90 border-zinc-200"
            )}>
              {/* Button 1: Keyboard Text Visibility Toggle */}
              <button 
                onClick={() => setShowTextResponse(!showTextResponse)}
                className={cn(
                  "w-11 h-11 rounded-2xl flex items-center justify-center transition-all cursor-pointer",
                  showTextResponse 
                    ? (isDarkMode 
                        ? "bg-zinc-900 text-blue-400" 
                        : "bg-zinc-100 text-blue-600 shadow-xs")
                    : (isDarkMode 
                        ? "text-zinc-500 hover:text-zinc-200" 
                        : "text-zinc-400 hover:text-zinc-700")
                )}
                title={showTextResponse ? "Hide Response Text" : "Show Response Text"}
              >
                <Keyboard className="w-4.5 h-4.5" />
              </button>

              {/* Button 2: Mute Output Speaker Speaker */}
              <button 
                onClick={handleToggleSpeaker}
                className={cn(
                  "w-11 h-11 rounded-2xl flex items-center justify-center transition-all cursor-pointer",
                  activeIsSpeakerOn 
                    ? (isDarkMode ? "text-zinc-300 hover:text-white" : "text-zinc-650 hover:text-zinc-900")
                    : "text-rose-500 bg-rose-500/10 hover:bg-rose-500/20"
                )}
                title={activeIsSpeakerOn ? "Mute Output Sound" : "Listen Output Sound"}
              >
                {activeIsSpeakerOn ? <Volume2 className="w-4.5 h-4.5" /> : <VolumeX className="w-4.5 h-4.5" />}
              </button>

              {/* Central Dual Capsule Controller representing visual listening or speaking stream (Touch to Interact) */}
              <button 
                onClick={handleToggleListening}
                className={cn(
                  "h-11 px-6 rounded-2xl flex items-center justify-center gap-2 border flex-1 transition-all duration-300 relative cursor-pointer font-semibold text-xs tracking-wide shadow-xs",
                  state === 'speaking' 
                    ? (isDarkMode 
                        ? "border-blue-500/40 bg-zinc-900/60 text-blue-400" 
                        : "border-blue-500/35 bg-blue-50 text-blue-600") 
                    : state === 'listening' 
                    ? (isDarkMode 
                        ? "border-emerald-500/40 bg-zinc-900/60 text-emerald-400" 
                        : "border-emerald-500/35 bg-emerald-50 text-emerald-600")
                    : (isDarkMode 
                        ? "border-zinc-800 bg-zinc-900 text-zinc-300 hover:bg-zinc-850 hover:border-zinc-700" 
                        : "border-zinc-200 bg-zinc-50 text-zinc-600 hover:bg-zinc-100")
                )}
                title={activeIsListening ? "Hold/Pause Session" : "Start Conversation stream"}
              >
                <span className="relative z-10 flex items-center gap-2">
                  <span className={cn(
                    "w-2 h-2 rounded-full",
                    state === 'speaking' ? "bg-blue-500 animate-ping" : 
                    state === 'listening' ? "bg-emerald-500 animate-ping" : "bg-transparent border border-current"
                  )} />
                  {state === 'speaking' ? "TAP CORES" : state === 'listening' ? "LISTENING" : "START"}
                </span>

                {/* Internal audio wave visual animation inside capsule button */}
                <div className="absolute right-3.5 flex items-center gap-[2.5px] opacity-40">
                  {[1, 2, 3].map((v) => (
                    <motion.div
                      key={v}
                      animate={state === 'speaking' || state === 'listening' ? {
                        height: [6, 14, 8][v - 1] + Math.random() * 4
                      } : {
                        height: 4
                      }}
                      transition={{ duration: 0.45, repeat: Infinity, repeatType: "reverse" }}
                      className={cn("w-[2px] rounded-full", state === 'speaking' ? "bg-blue-500" : state === 'listening' ? "bg-emerald-500" : "bg-zinc-500")}
                    />
                  ))}
                </div>
              </button>

              {/* Button 4: Standard mic toggle */}
              <button 
                onClick={handleToggleListening}
                className={cn(
                  "w-11 h-11 rounded-2xl flex items-center justify-center transition-all cursor-pointer",
                  activeIsListening 
                    ? (isDarkMode ? "bg-emerald-500/10 text-emerald-400" : "bg-emerald-500/5 text-emerald-600") 
                    : (isDarkMode ? "text-zinc-500 hover:text-zinc-200" : "text-zinc-400 hover:text-zinc-700")
                )}
                title={activeIsListening ? "Mute Mic" : "Unmute Mic"}
              >
                {activeIsListening ? <Mic className="w-4.5 h-4.5 animate-pulse" /> : <MicOff className="w-4.5 h-4.5" />}
              </button>

              {/* Button 5: Symmetrical Call Hangup Red Action Button */}
              <button 
                onClick={onClose}
                className={cn(
                  "w-11 h-11 rounded-2xl flex items-center justify-center transition-all cursor-pointer text-white shadow-xs",
                  isDarkMode ? "bg-rose-600 hover:bg-rose-500" : "bg-red-500 hover:bg-red-400"
                )}
                title="End Voice call session"
              >
                <X className="w-4.5 h-4.5" strokeWidth={2.5} />
              </button>

            </div>
          </footer>

          {/* Core Configuration slide drawer */}
          <AnimatePresence>
            {showVoiceDrawer && (
              <>
                {/* Backdrop overlay */}
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.5 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setShowVoiceDrawer(false)}
                  className="fixed inset-0 z-45 bg-black/60 backdrop-blur-xs cursor-pointer"
                />

                {/* Right Side Control Drawer */}
                <motion.div
                  initial={{ x: "100%", opacity: 0.95 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: "100%", opacity: 0.95 }}
                  transition={{ type: "spring", damping: 28, stiffness: 220 }}
                  className={cn(
                    "fixed right-0 top-0 bottom-0 w-full sm:w-[360px] z-50 p-6 flex flex-col justify-between border-l shadow-2xl",
                    isDarkMode 
                      ? "bg-[#0b0b0d] border-zinc-850 text-zinc-100" 
                      : "bg-white border-zinc-200 text-zinc-900"
                  )}
                >
                  <div className="flex flex-col flex-1">
                    {/* Drawer Header Toolbar */}
                    <div className={cn("flex items-center justify-between pb-4 border-b", isDarkMode ? "border-zinc-900" : "border-zinc-100")}>
                      <div className="flex items-center gap-2">
                        <Sliders className="w-4 h-4 text-blue-500" />
                        <h2 className="text-[11px] font-bold uppercase tracking-widest leading-none">Voice Settings</h2>
                      </div>
                      <button 
                        onClick={() => setShowVoiceDrawer(false)}
                        className={cn(
                          "px-2.5 py-1 rounded-md text-[10px] font-bold cursor-pointer border transition-colors",
                          isDarkMode 
                            ? "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white" 
                            : "bg-zinc-100 border-zinc-200 text-zinc-650 hover:text-zinc-900"
                        )}
                      >
                        Done
                      </button>
                    </div>

                    {/* Speed Selector */}
                    <div className="mt-6 space-y-2.5">
                      <label className={cn("text-[9px] font-bold uppercase tracking-wider block", isDarkMode ? "text-zinc-500" : "text-zinc-400")}>Speech Speed</label>
                      <div className="grid grid-cols-4 gap-1.5">
                        {SPEEDS.map((sp) => {
                          const isSpSelected = voiceSpeed === sp.value;
                          return (
                            <button
                              key={sp.value}
                              onClick={() => setVoiceSpeed(sp.value)}
                              className={cn(
                                "py-1.5 rounded-xl text-[10px] font-bold border transition-all cursor-pointer",
                                isSpSelected 
                                  ? (isDarkMode 
                                      ? "bg-blue-500/10 border-blue-500/60 text-blue-400" 
                                      : "bg-blue-50 border-blue-400 text-blue-600")
                                  : (isDarkMode 
                                      ? "bg-zinc-900/40 border-zinc-850 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900" 
                                      : "bg-zinc-50 border-zinc-200 text-zinc-550 hover:text-zinc-800 hover:bg-zinc-100")
                              )}
                            >
                              {sp.value}x
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Assistant speaker options */}
                    <p className={cn("text-xs mt-6 mb-3 leading-relaxed", isDarkMode ? "text-zinc-500" : "text-zinc-400")}>
                      Select a premium generative speaker avatar of choice:
                    </p>

                    <div className="flex-1 overflow-y-auto space-y-1.5 pr-0.5 max-h-[40vh] md:max-h-none scrollbar-none">
                      {VOICES.map((voice) => {
                        const isSelected = voiceOption === voice.id;
                        return (
                          <div
                            key={voice.id}
                            onClick={() => onVoiceOptionChange(voice.id)}
                            className={cn(
                              "w-full flex items-center justify-between p-2.5 rounded-xl transition-all border cursor-pointer select-none",
                              isSelected 
                                ? (isDarkMode 
                                    ? "bg-zinc-900/80 border-blue-500/50" 
                                    : "bg-blue-500/5 border-blue-500/35")
                                : (isDarkMode 
                                    ? "bg-transparent border-zinc-900 hover:bg-zinc-900/40 hover:border-zinc-800" 
                                    : "bg-transparent border-zinc-100 hover:bg-zinc-50 hover:border-zinc-200")
                            )}
                          >
                            <div className="flex items-center gap-2.5">
                              {/* Preview Play Circle */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handlePreviewVoice(voice.id);
                                }}
                                className={cn(
                                  "w-8 h-8 rounded-lg flex items-center justify-center transition-all cursor-pointer border",
                                  previewingVoice === voice.id 
                                    ? "bg-blue-500 border-blue-400 text-white" 
                                    : (isDarkMode 
                                        ? "bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-white" 
                                        : "bg-white border-zinc-200 text-zinc-500 hover:text-zinc-800")
                                )}
                                title="Preview Voice"
                              >
                                <PlayCircle className={cn("w-4 h-4", previewingVoice === voice.id && "animate-pulse")} />
                              </button>
                              
                              <div className="text-left">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs font-bold leading-none">{voice.name}</span>
                                  <span className={cn(
                                    "px-1 py-0.2 rounded text-[6.5px] font-bold uppercase tracking-wider border",
                                    voice.gender === 'male' 
                                      ? "bg-cyan-500/10 border-cyan-500/20 text-cyan-500" 
                                      : "bg-pink-500/10 border-pink-500/20 text-pink-500"
                                  )}>
                                    {voice.gender}
                                  </span>
                                </div>
                                <span className={cn("text-[9.5px] leading-relaxed block mt-0.5", isDarkMode ? "text-zinc-500" : "text-zinc-400")}>{voice.desc}</span>
                              </div>
                            </div>

                            {isSelected && (
                              <div className={cn(
                                "w-4.5 h-4.5 rounded-full flex items-center justify-center border",
                                isDarkMode ? "bg-blue-500/10 border-blue-500/40" : "bg-blue-500/15 border-blue-500/40"
                              )}>
                                <Check className="w-2.5 text-blue-500" strokeWidth={3} />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Info Footer popup inside drawer */}
                  <div className={cn("pt-4 border-t shrink-0 flex flex-col gap-2", isDarkMode ? "border-zinc-900" : "border-zinc-100")}>
                    <div className={cn(
                      "p-3 rounded-lg flex items-start gap-2.5 border",
                      isDarkMode ? "bg-zinc-900/30 border-zinc-850" : "bg-zinc-50 border-zinc-200/60"
                    )}>
                      <HelpCircle className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                      <p className={cn("text-[9.5px] leading-normal", isDarkMode ? "text-zinc-550" : "text-zinc-500")}>
                        To interrupt spoken response, speak clearly or tap the central START/TAP CORES button.
                      </p>
                    </div>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>

        </motion.div>
      )}
    </AnimatePresence>
  );
};
