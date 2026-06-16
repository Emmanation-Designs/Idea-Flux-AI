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
  MoreHorizontal,
  ChevronRight,
  Sliders,
  PlayCircle,
  HelpCircle,
  Activity,
  Keyboard,
  Upload
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

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
  onInterruptPlayback
}: VoiceModeProps) => {
  const [showVoiceDrawer, setShowVoiceDrawer] = useState(false);
  const [previewingVoice, setPreviewingVoice] = useState<string | null>(null);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  
  // Custom states matching requested UX
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

  // Monitor transcript activity to trigger transition between starting-greeting mode and active-text mode
  useEffect(() => {
    if (currentTranscript.trim().length > 0 || currentResponse.trim().length > 0) {
      setHasSpeechOccurred(true);
    }
  }, [currentTranscript, currentResponse]);

  // Reset dialogue activity memory when opening VoiceMode fresh
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
    if (!currentResponse) return;
    navigator.clipboard.writeText(currentResponse);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const state = isLoading ? 'thinking' : isPlaying ? 'speaking' : isListening ? 'listening' : 'idle';
  const displayUserName = profile?.name ? profile.name.trim().split(' ')[0] : 'Emmanuel';

  // Determine whether to display the text screen (Screenshot 2) or the minimalist sparkle screen (Screenshot 1)
  const isDisplayingTextLayout = showTextResponse && hasSpeechOccurred && (currentTranscript || currentResponse);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] bg-black text-white flex flex-col items-center justify-between overflow-hidden font-sans select-none"
        >
          {/* Subtle bottom lighting atmosphere */}
          <div className="absolute inset-0 z-0 pointer-events-none">
            <motion.div
              animate={{
                opacity: state === 'speaking' ? 0.35 : state === 'listening' ? 0.25 : state === 'thinking' ? 0.3 : 0.15,
              }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              className="absolute bottom-0 inset-x-0 h-[50%] bg-[radial-gradient(ellipse_at_bottom,rgba(59,130,246,0.18)_0%,rgba(4,12,30,0.04)_60%,transparent_90%)] pointer-events-none filter blur-[40px]"
            />
            {/* Soft background pattern */}
            <div className="absolute inset-0 opacity-[0.012] bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none" />
          </div>

          {/* Top Row Header Nav Bar */}
          <header className="relative z-10 w-full flex items-center justify-between px-6 py-5 md:px-10 shrink-0 select-none">
            {/* Double Horizontal Strip Menu - Matches UI screenshot left-header */}
            <button 
              onClick={onClose}
              className="flex flex-col gap-1.5 p-2 focus:outline-none cursor-pointer group"
              title="Close Voice Mode"
            >
              <div className="w-5 h-0.5 bg-white rounded-full group-hover:bg-zinc-300 transition-colors"></div>
              <div className="w-5 h-0.5 bg-white rounded-full group-hover:bg-zinc-300 transition-colors"></div>
            </button>

            {/* Top Right Sidebar Control & Options Trigger */}
            <div className="flex items-center gap-3">
              {/* Rounded device style outline sidebar icon */}
              <button 
                onClick={() => setShowVoiceDrawer(true)}
                className="p-2 border border-zinc-900 rounded-xl hover:bg-zinc-900/60 hover:border-zinc-800 transition-all cursor-pointer shadow-md flex items-center justify-center bg-zinc-950/40"
              >
                <div className="w-5 h-5 border-2 border-white/90 rounded-[5px] flex items-center justify-start p-[2px]">
                  <div className="w-1.5 h-full bg-white/90 rounded-[1.5px]"></div>
                </div>
              </button>

              {/* Three dots option trigger */}
              <button 
                onClick={() => setShowVoiceDrawer(true)}
                className="p-2 border border-zinc-900 rounded-xl hover:bg-zinc-900/60 hover:border-zinc-800 transition-all cursor-pointer shadow-md bg-zinc-950/40"
                title="Voice Settings"
              >
                <MoreHorizontal className="w-5 h-5 text-white" />
              </button>
            </div>
          </header>

          {/* Core Interactive Center Canvas Stage */}
          <main className="relative z-10 flex-1 flex flex-col justify-center w-full max-w-2xl px-6 py-4 overflow-y-auto">
            
            <AnimatePresence mode="wait">
              {!isDisplayingTextLayout ? (
                /* START SCREEN - MINIMALIST VIEW WITHOUT TALK PREVIEW (Screenshot 1) */
                <motion.div
                  key="minimalist-layout"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.4 }}
                  className="flex flex-col items-center justify-center py-8 gap-8"
                >
                  {/* Central Radiant 4-Point Star Piece resembling Gemini logo */}
                  <div className="relative flex items-center justify-center min-h-[160px]">
                    <motion.div
                      animate={{
                        scale: state === 'speaking' ? [1, 1.2, 0.95, 1.1, 1] : state === 'listening' ? [1, 1.05, 0.97, 1.03, 1] : [1, 1.01, 1],
                        opacity: state === 'speaking' ? 0.65 : state === 'listening' ? 0.45 : state === 'thinking' ? 0.55 : 0.35,
                      }}
                      transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
                      className="absolute w-44 h-44 rounded-full bg-blue-500/10 blur-[50px] pointer-events-none"
                    />

                    <motion.div
                      animate={
                        state === 'speaking' ? {
                          scale: [1, 1.08, 0.95, 1.05, 1],
                          filter: [
                            'drop-shadow(0 0 15px rgba(59,130,246,0.25))',
                            'drop-shadow(0 0 28px rgba(59,130,246,0.45))',
                            'drop-shadow(0 0 15px rgba(59,130,246,0.25))'
                          ]
                        } : state === 'thinking' ? {
                          scale: [0.95, 1.05, 0.95],
                          rotate: [0, 180, 360],
                        } : state === 'listening' ? {
                          scale: [1, 1.04, 1],
                          filter: 'drop-shadow(0 0 12px rgba(255,255,255,0.1))'
                        } : {
                          scale: 0.92,
                          filter: 'drop-shadow(0 0 5px rgba(255,255,255,0.02))'
                        }
                      }
                      transition={{
                        scale: { duration: 2.5, repeat: Infinity, ease: "easeInOut" },
                        rotate: { duration: 5, repeat: Infinity, ease: "linear" },
                        filter: { duration: 2, repeat: Infinity, ease: "easeInOut" }
                      }}
                      className="relative z-10 pointer-events-none"
                    >
                      <svg viewBox="0 0 100 100" className="w-24 h-24 md:w-28 md:h-28">
                        <defs>
                          <linearGradient id="gemini-star-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#FFFCC4" />       {/* Soft Gold Yellow */}
                            <stop offset="30%" stopColor="#FF8AEB" />      {/* Warm Neon Pink */}
                            <stop offset="65%" stopColor="#818CF8" />      {/* Vivid Violet Blue */}
                            <stop offset="100%" stopColor="#67e8f9" />     {/* Radiant Cyan */}
                          </linearGradient>
                        </defs>
                        <path
                          d="M 50 0 Q 50 50 100 50 Q 50 50 50 100 Q 50 50 0 50 Q 50 50 50 0 Z"
                          fill="url(#gemini-star-gradient)"
                        />
                      </svg>
                    </motion.div>
                  </div>

                  {/* Centered User Greeting Title matches Screenshot 1 */}
                  <div className="text-center px-4 max-w-md">
                    <h1 className="text-3xl md:text-4xl font-semibold tracking-tight leading-snug text-white/95">
                      Hi {displayUserName}, let's get into it
                    </h1>
                    <p className="text-xs text-zinc-550 tracking-wide mt-3 max-w-xs mx-auto opacity-75 leading-relaxed uppercase">
                      {state === 'listening' ? "Speaking stream active" : 
                       state === 'thinking' ? "Processing dialogue..." : 
                       state === 'speaking' ? "Streaming synthesis response..." : "Voice core initialized"}
                    </p>
                  </div>
                </motion.div>
              ) : (
                /* DIALOGUE ACTIVE SCREEN - TEXT VIEW (Screenshot 2) */
                <motion.div
                  key="text-layout"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.35, ease: "easeOut" }}
                  className="flex flex-col justify-start items-stretch gap-10 py-6 min-h-[50vh] text-left"
                >
                  {/* Top Right Compact Speech Bubble for the User statement if available */}
                  {currentTranscript && (
                    <div className="flex justify-end select-text">
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="max-w-[80%] rounded-[24px] px-6 py-3 bg-[#18181b] border border-zinc-850 text-white font-medium text-base text-right tracking-tight shadow-sm"
                      >
                        {currentTranscript}
                      </motion.div>
                    </div>
                  )}

                  {/* Assistant response block: Large bold stark white left-aligned text (no bubble container) */}
                  {currentResponse && (
                    <div className="flex flex-col gap-6 items-start w-full select-text select-none">
                      <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-2xl md:text-3xl font-bold text-white tracking-tight leading-relaxed max-w-full text-left"
                      >
                        {currentResponse}
                      </motion.div>

                      {/* Small inline reaction bar matches Screenshot 2 */}
                      <div className="flex items-center gap-5 pt-2 text-zinc-500">
                        <button 
                          onClick={() => setLiked(true)}
                          className={cn("p-1.5 rounded-lg hover:text-white transition-colors cursor-pointer", liked === true && "text-blue-400")}
                        >
                          <ThumbsUp className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => setLiked(false)}
                          className={cn("p-1.5 rounded-lg hover:text-white transition-colors cursor-pointer", liked === false && "text-red-400")}
                        >
                          <ThumbsDown className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={copyToClipboard}
                          className={cn("p-1.5 rounded-lg hover:text-white transition-colors cursor-pointer relative", copied && "text-emerald-400")}
                          title="Copy text response"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => setShowVoiceDrawer(true)}
                          className="p-1.5 rounded-lg hover:text-white transition-colors cursor-pointer"
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Secondary user continuous utterance transcript badge below output */}
                  {currentTranscript && (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 0.8 }}
                      className="mt-4 self-start rounded-full px-5 py-2.5 bg-zinc-900/60 border border-zinc-805/60 text-zinc-400 italic font-medium text-sm shadow-inner"
                    >
                      {currentTranscript}
                    </motion.div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
            
          </main>

          {/* Premium Bottom Panel Toolbar (5 buttons) */}
          <footer className="relative z-10 w-full max-w-xl flex flex-col items-center pb-10 px-6 shrink-0 gap-6 select-none">
            
            {/* Minimal Help Prompt */}
            {state === 'idle' && (
              <p className="text-[10px] text-zinc-500 tracking-wider flex items-center gap-1 opacity-60">
                <Sparkles className="w-3 h-3 text-blue-400 animate-pulse" />
                Tap microphone to wake secure speech stream
              </p>
            )}

            {/* Row of 5 Circular Control Buttons */}
            <div className="w-full flex items-center justify-between px-3">
              
              {/* Button 1: Keyboard/Show-Text Toggle */}
              <button 
                onClick={() => setShowTextResponse(!showTextResponse)}
                className={cn(
                  "w-12 h-12 rounded-xl flex items-center justify-center transition-all bg-zinc-950/80 border cursor-pointer",
                  showTextResponse 
                    ? "border-blue-500/20 text-blue-400 ring-2 ring-blue-500/5 hover:bg-zinc-900" 
                    : "border-zinc-900 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900"
                )}
                title={showTextResponse ? "Disable Transcript Display" : "Enable Transcript Display"}
              >
                <Keyboard className="w-5 h-5" />
              </button>

              {/* Button 2: Share / Upload Media Arrow (matches Screenshot bottom bar format) */}
              <button 
                onClick={onToggleSpeaker}
                className={cn(
                  "w-12 h-12 rounded-xl flex items-center justify-center transition-all bg-zinc-950/80 border cursor-pointer",
                  isSpeakerOn 
                    ? "border-blue-500/10 text-white hover:bg-zinc-900" 
                    : "border-red-900/20 text-red-500/80 bg-red-950/10 hover:bg-red-950/20"
                )}
                title={isSpeakerOn ? "Mute Output Speaker" : "Unmute Output Speaker"}
              >
                {isSpeakerOn ? <Upload className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
              </button>

              {/* Button 3: CENTRAL WIDE VOICE CAPSULE VISUALIZER (Breathes and Glows Atmospheric Blue) */}
              <div 
                onClick={onToggleListening}
                className="flex justify-center flex-1 mx-4 max-w-[140px] md:max-w-[160px]"
              >
                <div 
                  className={cn(
                    "w-full h-11 rounded-[22px] bg-zinc-950 border transition-all duration-300 relative cursor-pointer flex items-center justify-center",
                    state === 'speaking' 
                      ? "border-blue-500/40 shadow-[0_0_25px_rgba(59,130,246,0.35)] scale-102" 
                      : state === 'listening' 
                      ? "border-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.15)] bg-zinc-950" 
                      : "border-zinc-900 shadow-none"
                  )}
                  title={isListening ? "Pause stream" : "Wake stream"}
                >
                  {/* Glowing core bar representing speech presence */}
                  <div className="absolute inset-0 rounded-[22px] overflow-hidden">
                    <motion.div 
                      animate={
                        state === 'speaking' ? {
                          opacity: [0.15, 0.45, 0.15],
                          background: 'linear-gradient(90deg, transparent, rgba(59,130,246,0.5), transparent)'
                        } : state === 'listening' ? {
                          opacity: [0.08, 0.22, 0.08],
                          background: 'linear-gradient(90deg, transparent, rgba(59,130,246,0.2), transparent)'
                        } : {
                          opacity: 0,
                        }
                      }
                      transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
                      className="absolute inset-0"
                    />
                  </div>

                  {/* Micro lines inside visualizer capsule indicating state */}
                  <div className="flex items-center gap-[3px] z-10">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <motion.div
                        key={i}
                        animate={
                          state === 'speaking' ? {
                            height: [6, 22, 8, 18, 6][i - 1] * 0.8 + Math.random() * 5
                          } : state === 'listening' ? {
                            height: [8, 12, 6, 14, 8][i - 1] * 0.5 + Math.random() * 2
                          } : {
                            height: 4
                          }
                        }
                        transition={{
                          duration: 0.6 + i * 0.1,
                          repeat: Infinity,
                          ease: "easeInOut",
                          repeatType: "reverse"
                        }}
                        className="w-[3px] bg-blue-400 rounded-full"
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Button 4: Standard Microphone input Toggle */}
              <button 
                onClick={onToggleListening}
                className={cn(
                  "w-12 h-12 rounded-xl flex items-center justify-center transition-all bg-zinc-950/80 border cursor-pointer",
                  isListening 
                    ? "border-blue-500/20 text-blue-400 font-bold bg-zinc-900" 
                    : "border-zinc-900 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900"
                )}
                title={isListening ? "Mute Mic" : "Unmute Mic"}
              >
                {isListening ? <Mic className="w-5 h-5 animate-pulse" /> : <MicOff className="w-5 h-5" />}
              </button>

              {/* Button 5: Secure Phone Close / Exit Call */}
              <button 
                onClick={onClose}
                className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-650 to-red-600 hover:from-red-600 hover:to-red-500 text-white flex items-center justify-center cursor-pointer shadow-lg border border-red-500/10 hover:scale-105 active:scale-95 transition-all"
                title="Exit Voice Mode"
              >
                <X className="w-5 h-5" />
              </button>

            </div>
          </footer>

          {/* Slide-Up Voice & Rate Settings Settings Drawer popup Overlay (Screenshot 3-dots target) */}
          <AnimatePresence>
            {showVoiceDrawer && (
              <>
                {/* Backdrop Glasses Overlay */}
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.7 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setShowVoiceDrawer(false)}
                  className="fixed inset-0 z-40 bg-black/85 backdrop-blur-md cursor-pointer"
                />

                {/* Right Side Control Drawer */}
                <motion.div
                  initial={{ y: "100%" }}
                  animate={{ y: 0 }}
                  exit={{ y: "100%" }}
                  transition={{ type: "spring", damping: 26, stiffness: 220 }}
                  className="fixed bottom-0 inset-x-0 md:inset-x-auto md:right-0 md:top-0 md:bottom-0 md:w-96 z-50 bg-[#0c0c0e] border-t md:border-t-0 md:border-l border-zinc-850 p-6 flex flex-col justify-between overflow-y-auto"
                >
                  <div className="flex flex-col flex-1">
                    <div className="flex items-center justify-between pb-5 border-b border-zinc-900">
                      <div className="flex items-center gap-2">
                        <Sliders className="w-4.5 h-4.5 text-blue-400" />
                        <h2 className="text-xs font-bold uppercase tracking-widest text-white">Voice Core Config</h2>
                      </div>
                      <button 
                        onClick={() => setShowVoiceDrawer(false)}
                        className="p-1 px-3 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white text-xs cursor-pointer font-bold"
                      >
                        Done
                      </button>
                    </div>

                    {/* Standard speech speed preference option */}
                    <div className="mt-5 space-y-3">
                      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-450 block">Voice Speed / Tempo</label>
                      <div className="grid grid-cols-4 gap-2">
                        {SPEEDS.map((sp) => {
                          const isSpSelected = voiceSpeed === sp.value;
                          return (
                            <button
                              key={sp.value}
                              onClick={() => setVoiceSpeed(sp.value)}
                              className={cn(
                                "py-1.5 rounded-lg text-[10px] font-bold border transition-all cursor-pointer",
                                isSpSelected 
                                  ? "bg-blue-500/10 border-blue-500 text-blue-400 shadow-[0_2px_8px_rgba(59,130,246,0.15)]" 
                                  : "bg-zinc-950 border-zinc-900 text-zinc-450 hover:text-zinc-200"
                              )}
                            >
                              {sp.value}x
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <p className="text-xs text-zinc-500 mt-6 mb-3 leading-relaxed">
                      Select a premium generative text-to-speech option. The selected option is stored automatically.
                    </p>

                    <div className="flex-1 overflow-y-auto space-y-2 pr-1 h-[30vh] md:h-auto scrollbar-thin scrollbar-thumb-zinc-800">
                      {VOICES.map((voice) => {
                        const isSelected = voiceOption === voice.id;
                        return (
                          <div
                            key={voice.id}
                            onClick={() => onVoiceOptionChange(voice.id)}
                            className={cn(
                              "w-full flex items-center justify-between p-3 rounded-2xl transition-all border cursor-pointer select-none",
                              isSelected 
                                ? "bg-zinc-900 border-blue-500/50 shadow-[0_4px_20px_rgba(59,130,246,0.1)]" 
                                : "bg-zinc-950/20 border-zinc-900 hover:bg-zinc-900/40 hover:border-zinc-805"
                            )}
                          >
                            <div className="flex items-center gap-3">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handlePreviewVoice(voice.id);
                                }}
                                className={cn(
                                  "w-9 h-9 rounded-xl flex items-center justify-center transition-all cursor-pointer border",
                                  previewingVoice === voice.id 
                                    ? "bg-blue-500 border-blue-400 text-white shadow-md shadow-blue-500/20" 
                                    : "bg-zinc-950 border-zinc-850 text-zinc-400 hover:text-white"
                                )}
                                title="Preview Voice"
                              >
                                <PlayCircle className={cn("w-4.5 h-4.5", previewingVoice === voice.id && "animate-pulse")} />
                              </button>
                              
                              <div className="text-left">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs font-bold text-white leading-none">{voice.name}</span>
                                  <span className={cn(
                                    "px-1 py-0.2 rounded text-[7px] font-black uppercase tracking-wider border",
                                    voice.gender === 'male' 
                                      ? "bg-cyan-500/10 border-cyan-500/20 text-cyan-400" 
                                      : "bg-pink-500/10 border-pink-500/20 text-pink-400"
                                  )}>
                                    {voice.gender}
                                  </span>
                                </div>
                                <span className="text-[10px] text-zinc-500 leading-relaxed block mt-0.5">{voice.desc}</span>
                              </div>
                            </div>

                            {isSelected && (
                              <div className="w-5 h-5 rounded-full bg-blue-500/10 border border-blue-500/30 flex items-center justify-center">
                                <Check className="w-3 text-blue-400" strokeWidth={3} />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="pt-4 border-t border-zinc-900 flex flex-col gap-2 shrink-0">
                    <div className="bg-zinc-900/40 border border-zinc-850 p-3 rounded-xl flex items-start gap-2.5">
                      <HelpCircle className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                      <p className="text-[10px] text-zinc-500 leading-normal">
                        To stop playback at any time during active streams, speak normally or tap the visualizer capsule.
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
