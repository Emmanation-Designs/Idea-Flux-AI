import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Mic, 
  MicOff, 
  Volume2, 
  VolumeX, 
  PhoneOff,
  Zap,
  Globe,
  Sliders,
  Check,
  Sparkles,
  PlayCircle,
  HelpCircle,
  Activity
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
  onVoiceOptionChange
}: { 
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
}) => {
  const [showVoiceDrawer, setShowVoiceDrawer] = useState(false);
  const [previewingVoice, setPreviewingVoice] = useState<string | null>(null);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  
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
      
      if (!selectedVoice) {
        if (targetGender === 'male') {
          selectedVoice = voices.find(v => v.name.toLowerCase().includes('en-us') && v.name.toLowerCase().includes('male'));
        } else {
          selectedVoice = voices.find(v => v.name.toLowerCase().includes('en-us') && v.name.toLowerCase().includes('female'));
        }
      }
    }
    
    if (!selectedVoice) {
      selectedVoice = voices[0];
    }
    
    if (selectedVoice) utterance.voice = selectedVoice;
    
    if (id === 'onyx' || id === 'echo' || id === 'atlas') {
      utterance.pitch = id === 'onyx' ? 0.8 : id === 'echo' ? 0.85 : 0.95;
      utterance.rate = 0.95;
    } else if (id === 'fable') {
      utterance.pitch = 1.05;
      utterance.rate = 1.0;
    } else if (id === 'shimmer') {
      utterance.pitch = 1.25;
      utterance.rate = 1.1;
    } else if (id === 'nova') {
      utterance.pitch = 1.15;
      utterance.rate = 1.05;
    }

    utterance.onend = () => setPreviewingVoice(null);
    utterance.onerror = () => setPreviewingVoice(null);

    window.speechSynthesis.speak(utterance);
  };

  useEffect(() => {
    if (!isOpen) {
      setShowVoiceDrawer(false);
      setPreviewingVoice(null);
      window.speechSynthesis.cancel();
    }
  }, [isOpen]);

  // Derive active voice state
  const state = isLoading ? 'thinking' : isPlaying ? 'speaking' : isListening ? 'listening' : 'idle';
  const volume = isPlaying ? 1.0 : isListening ? 0.45 : 0.1;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] bg-black text-white flex flex-col items-center justify-between overflow-hidden font-sans select-none"
        >
          {/* Hardware-Accelerated Ambient Glowing Backdrops (Emerald green glow at bottom, soft space core) */}
          <div className="absolute inset-0 z-0 pointer-events-none">
            {/* Soft Ambient Green Rising Glow from the bottom edge */}
            <motion.div
              animate={{
                opacity: state === 'speaking' ? 0.65 : state === 'listening' ? 0.5 : state === 'thinking' ? 0.55 : 0.4,
              }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              className="absolute bottom-0 inset-x-0 h-[60%] bg-[radial-gradient(ellipse_at_bottom,rgba(16,185,129,0.22)_0%,rgba(4,120,87,0.06)_50%,transparent_85%)] pointer-events-none filter blur-[35px]"
            />
            
            {/* Center Core Ambient soft green light */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] max-w-2xl h-[50vw] bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.06)_0%,transparent_70%)] pointer-events-none filter blur-[50px]" />

            {/* Subtle starry background texture */}
            <div className="absolute inset-0 opacity-[0.015] bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:20px_20px] pointer-events-none" />
          </div>

          {/* Top Bar Navigation (Logo & Actions) */}
          <header className="relative z-10 w-full flex items-center justify-between px-6 py-5 md:px-12 md:py-8 shrink-0">
            {/* Top Left: Icon & Text Logo matching current app's identity */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500/10 to-teal-500/10 flex items-center justify-center border border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.1)]">
                <Zap className="w-5 h-5 text-emerald-400 fill-emerald-500/20" strokeWidth={1.8} />
              </div>
              <div className="flex flex-col text-left">
                <span className="text-xs uppercase font-black tracking-[0.25em] bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent block">
                  TRELVIX AI
                </span>
                <span className="text-[8px] font-bold text-zinc-500 tracking-wider block">
                  SECURE VOICE CORE
                </span>
              </div>
            </div>

            {/* Top Right Controls */}
            <div className="flex items-center gap-3">
              {/* Voice select slider trigger */}
              <button
                onClick={() => setShowVoiceDrawer(true)}
                className="flex items-center gap-2 px-4 py-2 bg-zinc-900/60 hover:bg-zinc-800 text-zinc-300 hover:text-white transition-all rounded-full border border-zinc-850 hover:border-zinc-700 font-bold text-xs cursor-pointer shadow-md"
              >
                <Sliders className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden sm:inline font-black uppercase tracking-wider text-[10px]">Voices</span>
                <span className="px-1.5 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[8px] rounded font-black uppercase tracking-widest">{voiceOption}</span>
              </button>

              <button 
                onClick={onClose} 
                className="p-2.5 text-zinc-450 hover:text-white transition-all bg-zinc-900/60 hover:bg-zinc-800 rounded-xl border border-zinc-850 cursor-pointer shadow-md"
                title="Minimize Voice Mode"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </header>

          {/* Central Immersive Stage */}
          <main className="relative z-10 flex-1 flex flex-col items-center justify-center w-full max-w-2xl px-6">
            <div className="relative w-full flex flex-col items-center justify-center gap-8">
              
              {/* Single Elegant 4-Point Sparkle Star Centerpiece */}
              <div className="relative flex items-center justify-center min-h-[160px]">
                {/* Ambient Soft Halo behind the star - themed using the brand green */}
                <motion.div
                  animate={{
                    scale: state === 'speaking' ? [1, 1.25, 0.95, 1.15, 1] : state === 'listening' ? [1, 1.08, 0.96, 1.04, 1] : [1, 1.02, 1],
                    opacity: state === 'speaking' ? 0.7 : state === 'listening' ? 0.45 : state === 'thinking' ? 0.55 : 0.35,
                  }}
                  transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute w-44 h-44 rounded-full bg-emerald-500/20 blur-[50px]"
                />

                {/* Sparkling Astroid Star with beautiful linear gradient */}
                <motion.div
                  animate={
                    state === 'speaking' ? {
                      scale: [1, 1.1, 0.94, 1.06, 1],
                      filter: [
                        'drop-shadow(0 0 20px rgba(16,185,129,0.3))',
                        'drop-shadow(0 0 35px rgba(16,185,129,0.5))',
                        'drop-shadow(0 0 20px rgba(16,185,129,0.3))'
                      ]
                    } : state === 'thinking' ? {
                      scale: [0.94, 1.06, 0.94],
                      rotate: [0, 180, 360],
                    } : state === 'listening' ? {
                      scale: [1, 1.05, 1],
                      filter: 'drop-shadow(0 0 15px rgba(255,255,255,0.15))'
                    } : {
                      scale: 0.9,
                      filter: 'drop-shadow(0 0 8px rgba(255,255,255,0.05))'
                    }
                  }
                  transition={{
                    scale: { duration: 2.4, repeat: Infinity, ease: "easeInOut" },
                    rotate: { duration: 4.5, repeat: Infinity, ease: "linear" },
                    filter: { duration: 1.8, repeat: Infinity, ease: "easeInOut" }
                  }}
                  className="relative z-10 select-none pointer-events-none"
                >
                  <svg 
                    viewBox="0 0 100 100" 
                    className="w-24 h-24 md:w-28 md:h-28"
                  >
                    <defs>
                      <linearGradient id="sparkle-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#FFFCC4" />       {/* Golden Yellow */}
                        <stop offset="35%" stopColor="#FF9BE5" />      {/* Radiant Pink */}
                        <stop offset="65%" stopColor="#A5B4FC" />      {/* Lavender Soft Blue */}
                        <stop offset="100%" stopColor="#34D399" />     {/* Brand Green (Emerald-400) */}
                      </linearGradient>
                    </defs>
                    <path
                      d="M 50 0 Q 50 50 100 50 Q 50 50 50 100 Q 50 50 0 50 Q 50 50 50 0 Z"
                      fill="url(#sparkle-grad)"
                    />
                  </svg>
                </motion.div>
              </div>

              {/* Text Area */}
              <div className="text-center space-y-4">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={state}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    transition={{ duration: 0.35 }}
                    className="flex flex-col items-center gap-3.5"
                  >
                    {/* Caption matched exactly to the video layout */}
                    <h1 className="text-3xl md:text-4xl font-light tracking-wide bg-gradient-to-b from-white via-white to-zinc-400 bg-clip-text text-transparent px-4 select-none">
                      {state === 'listening' ? "Ready when you are" : 
                       state === 'thinking' ? "Synthesizing answer..." : 
                       state === 'speaking' ? "Trelvix responding..." : "Voice Stream Off"}
                    </h1>
                    
                    {/* Compact pill matching the high standard design */}
                    <div className="inline-flex items-center gap-2.5 px-4 py-1.5 bg-zinc-900/50 backdrop-blur-md rounded-full border border-zinc-800/80">
                      <span className="relative flex h-1.5 w-1.5">
                        <span className={cn(
                          "absolute inline-flex h-full w-full rounded-full opacity-75",
                          state === 'speaking' ? "animate-ping bg-emerald-400" : 
                          state === 'listening' ? "animate-ping bg-emerald-400" : 
                          state === 'thinking' ? "animate-ping bg-yellow-400" : "bg-zinc-650"
                        )} />
                        <span className={cn(
                          "relative inline-flex rounded-full h-1.5 w-1.5",
                          state === 'speaking' ? "bg-emerald-500" : 
                          state === 'listening' ? "bg-emerald-500" : 
                          state === 'thinking' ? "bg-yellow-500" : "bg-zinc-500"
                        )} />
                      </span>
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 selection:bg-transparent">
                        {state === 'listening' ? "Listening" : 
                         state === 'thinking' ? "Thinking" : 
                         state === 'speaking' ? "Speaking" : "Idle"}
                      </span>
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>

            </div>
          </main>

          {/* Premium Bottom Bar Controls (Glow Emerald Accent matching app design) */}
          <footer className="relative z-10 w-full max-w-lg flex flex-col items-center pb-12 px-6 shrink-0 gap-6">
            
            {/* Quick Informational Tip */}
            <p className="text-[10px] text-zinc-500 tracking-wider flex items-center gap-1 opacity-70">
              <Sparkles className="w-3 h-3 text-emerald-400" />
              Continuous listening model active. Speak naturally.
            </p>

            <div className="w-full grid grid-cols-4 gap-4 items-center">
              {/* Speaker On/Off Button */}
              <button 
                onClick={onToggleSpeaker}
                className={cn(
                  "w-14 h-14 md:w-16 md:h-16 mx-auto rounded-[1.5rem] flex items-center justify-center transition-all bg-zinc-900/60 hover:bg-zinc-805 border cursor-pointer",
                  !isSpeakerOn 
                    ? "text-red-400 bg-red-950/20 border-red-900/30 ring-2 ring-red-500/10" 
                    : "text-zinc-400 hover:text-white border-zinc-800/80 hover:border-zinc-700"
                )}
                title={isSpeakerOn ? "Mute Speaker" : "Unmute Speaker"}
              >
                {!isSpeakerOn ? <VolumeX className="w-5.5 h-5.5" /> : <Volume2 className="w-5.5 h-5.5" />}
              </button>

              {/* Master Push-to-Talk / Toggle Listening Mic in Center (Grid span 2) */}
              <div className="col-span-2 flex justify-center">
                <button 
                  onClick={onToggleListening}
                  className={cn(
                    "w-20 h-20 md:w-22 md:h-22 rounded-full flex items-center justify-center transition-all duration-500 relative group cursor-pointer",
                    isListening 
                      ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-black shadow-[0_0_40px_rgba(16,185,129,0.35)] hover:scale-105 active:scale-95" 
                      : "bg-zinc-900 text-zinc-400 border border-zinc-800 hover:border-zinc-700 hover:text-white"
                  )}
                  title={isListening ? "Pause Listening" : "Resume Listening"}
                >
                  <div className="absolute inset-0 bg-transparent group-hover:bg-emerald-400/5 transition-colors rounded-full" />
                  {isListening ? (
                    <Mic className="w-8 h-8 relative z-10 animate-pulse text-zinc-950" strokeWidth={2} />
                  ) : (
                    <MicOff className="w-8 h-8 relative z-10 text-zinc-400" strokeWidth={1.8} />
                  )}
                </button>
              </div>

              {/* Secure Phone Off / Close Call Button */}
              <button 
                onClick={onClose}
                className="w-14 h-14 md:w-16 md:h-16 mx-auto rounded-[1.5rem] bg-gradient-to-br from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white flex items-center justify-center hover:scale-110 active:scale-95 transition-all shadow-xl shadow-red-500/15 cursor-pointer border border-red-500/20"
                title="End Call Session"
              >
                <PhoneOff className="w-5.5 h-5.5" />
              </button>
            </div>
          </footer>

          {/* Slide-Up Right-Hand Panel / Voice Selection Overlay (Interactive Config) */}
          <AnimatePresence>
            {showVoiceDrawer && (
              <>
                {/* Backdrop Filter Glass clickout */}
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.6 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setShowVoiceDrawer(false)}
                  className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm cursor-pointer"
                />

                {/* Left/Right Swipe Drawer */}
                <motion.div
                  initial={{ y: "100%" }}
                  animate={{ y: 0 }}
                  exit={{ y: "100%" }}
                  transition={{ type: "spring", damping: 25, stiffness: 220 }}
                  className="fixed bottom-0 inset-x-0 md:inset-x-auto md:right-0 md:top-0 md:bottom-0 md:w-96 z-50 bg-[#0c0c0e] border-t md:border-t-0 md:border-l border-zinc-850 p-6 flex flex-col justify-between"
                >
                  <div className="flex flex-col flex-1 overflow-hidden">
                    <div className="flex items-center justify-between pb-6 border-b border-zinc-900">
                      <div className="flex items-center gap-2">
                        <Globe className="w-4 h-4 text-emerald-400" />
                        <h2 className="text-sm font-black uppercase tracking-widest text-white">Voice Settings</h2>
                      </div>
                      <button 
                        onClick={() => setShowVoiceDrawer(false)}
                        className="p-1 px-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white text-xs cursor-pointer"
                      >
                        Done
                      </button>
                    </div>

                    <p className="text-xs text-zinc-500 mt-4 mb-3 leading-relaxed">
                      Select a premium generative text-to-speech voice option below.
                    </p>

                    <div className="flex-1 overflow-y-auto space-y-2 pr-1 h-[40vh] md:h-auto scrollbar-thin scrollbar-thumb-zinc-800">
                      {VOICES.map((voice) => {
                        const isSelected = voiceOption === voice.id;
                        return (
                          <div
                            key={voice.id}
                            onClick={() => onVoiceOptionChange(voice.id)}
                            className={cn(
                              "w-full flex items-center justify-between p-3 rounded-2xl transition-all border cursor-pointer select-none",
                              isSelected 
                                ? "bg-zinc-900 border-emerald-500/60 shadow-[0_4px_20px_rgba(16,185,129,0.1)]" 
                                : "bg-zinc-950/20 border-zinc-900 hover:bg-zinc-900/40 hover:border-zinc-850"
                            )}
                          >
                            <div className="flex items-center gap-3">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handlePreviewVoice(voice.id);
                                }}
                                className={cn(
                                  "w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer border",
                                  previewingVoice === voice.id 
                                    ? "bg-emerald-500 border-emerald-400 text-white shadow-lg shadow-emerald-500/30" 
                                    : "bg-zinc-950/60 border-zinc-800 text-zinc-300 hover:text-white"
                                )}
                                title="Preview Voice"
                              >
                                <PlayCircle className={cn("w-5 h-5", previewingVoice === voice.id && "animate-pulse")} />
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
                              <div className="w-6 h-6 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
                                <Check className="w-3.5 h-3.5 text-emerald-400" strokeWidth={2.5} />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="pt-4 border-t border-zinc-900 flex flex-col gap-2 shrink-0">
                    <div className="bg-zinc-900/40 border border-zinc-850 p-3 rounded-xl flex items-start gap-2.5">
                      <HelpCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <p className="text-[10px] text-zinc-500 leading-normal">
                        Cannot hear any voice output? Make sure your device volumetric control is high, and the Speaker toggle on the main voice dashboard is green.
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
