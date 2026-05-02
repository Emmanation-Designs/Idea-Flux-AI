import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Mic, 
  MicOff, 
  Volume2, 
  VolumeX, 
  PhoneOff,
  Settings as SettingsIcon,
  Sparkles
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
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
  const [showVoiceSettings, setShowVoiceSettings] = useState(false);

  // Derived state for the UI
  const state = isLoading ? 'thinking' : isPlaying ? 'speaking' : isListening ? 'listening' : 'idle';
  const volume = isPlaying || isListening ? 0.6 : 0; 

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-[#020202] text-white flex flex-col items-center justify-between p-6 md:p-12 overflow-hidden font-sans"
        >
          {/* 1. Cinematic Aura Background */}
          <div className="absolute inset-0 z-0 pointer-events-none">
            {/* Floating Particles */}
            {[...Array(25)].map((_, i) => (
              <motion.div
                key={`particle-${i}`}
                initial={{ 
                  x: Math.random() * window.innerWidth, 
                  y: Math.random() * window.innerHeight,
                  opacity: Math.random() * 0.2
                }}
                animate={{ 
                  y: [null, Math.random() * (state === 'speaking' ? -300 : -100)],
                  opacity: [null, 0]
                }}
                transition={{ 
                  duration: (state === 'speaking' ? 3 : 8) + Math.random() * 10, 
                  repeat: Infinity, 
                  delay: Math.random() * 5 
                }}
                className="absolute w-[1.5px] h-[1.5px] bg-white rounded-full"
              />
            ))}
            
            {/* Primary Glow */}
            <motion.div 
              animate={{
                scale: state === 'speaking' ? [1, 1.2, 1] : [1, 1.05, 1],
                opacity: state === 'idle' ? 0.03 : 0.1,
                x: state === 'speaking' ? [0, 20, -20, 0] : 0,
                y: state === 'speaking' ? [0, -20, 20, 0] : 0,
              }}
              transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
              className={cn(
                "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] h-[90%] rounded-full blur-[160px] transition-colors duration-[2000ms]",
                state === 'speaking' ? "bg-blue-500/30" : 
                state === 'listening' ? "bg-white/5" : 
                state === 'thinking' ? "bg-purple-500/10" : "bg-blue-500/5"
              )}
            />
            {/* Master horizontal line - cinematic style */}
            <div className="absolute top-1/2 left-0 w-full h-[1px] bg-white/[0.03]" />
          </div>

          {/* 2. Professional Header */}
          <div className="w-full flex items-center justify-between z-20">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2.5">
                <Sparkles className="w-3.5 h-3.5 text-zinc-500" />
                <span className="text-[10px] font-black tracking-[0.4em] uppercase text-zinc-600">
                  Adaptive Intelligence
                </span>
              </div>
              <div className="flex items-center gap-2 mt-1 px-3 py-1.5 bg-white/[0.02] rounded-full border border-white/[0.03]">
                <div className={cn(
                  "w-1 h-1 rounded-full transition-all duration-500",
                  state === 'speaking' ? "bg-blue-400 shadow-[0_0_10px_#60a5fa]" : 
                  state === 'listening' ? "bg-white shadow-[0_0_10px_#fff]" :
                  state === 'thinking' ? "bg-amber-400 animate-pulse" : "bg-zinc-800"
                )} />
                <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">
                  {state === 'thinking' ? "Synthesizing" : state === 'speaking' ? "Transmitting" : state === 'listening' ? "Active Listening" : "Sync Ready"}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button 
                onClick={() => setShowVoiceSettings(!showVoiceSettings)}
                className={cn(
                  "p-3 rounded-2xl transition-all duration-300 backdrop-blur-3xl border border-white/[0.03]",
                  showVoiceSettings ? "bg-white text-black" : "bg-white/[0.02] text-zinc-500 hover:text-white"
                )}
              >
                <SettingsIcon className="w-5 h-5" />
              </button>
              <button 
                onClick={onClose}
                className="p-3 bg-white/[0.02] hover:bg-white/[0.05] rounded-2xl transition-all text-zinc-500 hover:text-white backdrop-blur-3xl border border-white/[0.03]"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>

          {/* 3. Settings Overlay */}
          <AnimatePresence>
            {showVoiceSettings && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -10 }}
                className="absolute top-28 right-6 md:right-12 z-50 bg-zinc-900/95 backdrop-blur-[40px] border border-white/[0.05] rounded-[2rem] p-6 w-80 shadow-3xl"
              >
                <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-6 px-1">Audio Profile</h3>
                <div className="space-y-1.5">
                  {([
                    { id: 'alloy', name: 'Alloy', desc: 'Balanced / Professional' },
                    { id: 'echo', name: 'Echo', desc: 'Warm / Authoritative' }
                  ] as const).map((v) => (
                    <button
                      key={`voice-${v.id}`}
                      onClick={() => {
                        onVoiceOptionChange(v.id);
                        setShowVoiceSettings(false);
                      }}
                      className={cn(
                        "w-full flex items-center justify-between px-5 py-4 rounded-2xl text-left transition-all",
                        voiceOption === v.id ? "bg-white text-black shadow-xl" : "hover:bg-white/5 border border-transparent text-zinc-400"
                      )}
                    >
                      <div className="flex flex-col">
                        <span className="text-sm font-bold">{v.name}</span>
                        <span className={cn("text-[10px] font-medium opacity-60")}>{v.desc}</span>
                      </div>
                      {voiceOption === v.id && <div className="w-1.5 h-1.5 rounded-full bg-black/80" />}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* 4. The Energy Core */}
          <div className="flex-1 flex flex-col items-center justify-center w-full max-w-2xl relative">
            
            {/* The Ethereal Waveform */}
            <div className="relative w-full h-40 flex items-center justify-center">
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                
                {/* Grok-inspired Energy Strings (Refined) */}
                {[...Array(5)].map((_, i) => (
                  <motion.div
                    key={`ethereal-string-${i}`}
                    animate={{
                      scaleY: state === 'speaking' || state === 'listening' ? [1, 2 + (Math.random() * 2), 1] : 1,
                      opacity: state === 'speaking' ? [0.1, 0.4, 0.1] : 0.05,
                      translateY: state === 'speaking' ? [0, (i % 2 === 0 ? 10 : -10), 0] : 0,
                    }}
                    transition={{
                      duration: 0.8 + (i * 0.2),
                      repeat: Infinity,
                      ease: "easeInOut"
                    }}
                    className={cn(
                      "absolute w-[95%] rounded-full blur-[30px] mix-blend-screen transition-colors duration-1000",
                      i === 0 ? "bg-white h-[2px]" : 
                      i === 1 ? "bg-blue-400 h-[1.5px]" : 
                      i === 2 ? "bg-indigo-600 h-[1px]" : 
                      "bg-zinc-800 h-[12px]"
                    )}
                  />
                ))}

                {/* High-Resolution Signal Core */}
                <div className="absolute w-[95%] flex items-center justify-between pointer-events-none">
                  {[...Array(180)].map((_, i) => (
                    <motion.div
                      key={`micro-pulse-${i}`}
                      animate={{
                        height: state === 'speaking' || state === 'listening' 
                          ? [
                              1.5,
                              1.5 + (Math.sin(i * 0.05 + Date.now() / 100) * 45 * volume) + (Math.random() * 6),
                              1.5
                            ]
                          : 1,
                        opacity: state === 'idle' ? 0.02 : [0.3, 0.6, 0.3]
                      }}
                      transition={{
                        duration: 0.35,
                        repeat: Infinity,
                        ease: "linear"
                      }}
                      className={cn(
                        "w-[0.5px] rounded-full transition-colors duration-300",
                        state === 'speaking' ? "bg-white/90 shadow-[0_0_8px_white/20]" : "bg-zinc-800"
                      )}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Cinematic Typography & Status */}
            <div className="mt-24 text-center space-y-6">
              <AnimatePresence mode="wait">
                <motion.div
                  key={state}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="flex flex-col items-center gap-3"
                >
                   <h2 className="text-3xl md:text-4xl font-light tracking-tight text-white/95">
                    {state === 'speaking' ? "Assistant" : 
                     state === 'listening' ? "Listening" : 
                     state === 'thinking' ? "Processing" : "Connected"}
                  </h2>
                  <div className="flex items-center gap-4">
                    <div className="h-[1px] w-8 bg-white/5" />
                    <span className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.5em]">
                      Neural Audio Stream
                    </span>
                    <div className="h-[1px] w-8 bg-white/5" />
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          {/* 5. Minimal High-End Controls */}
          <div className="w-full max-w-lg flex items-center justify-between z-20 pb-12">
            <button 
              onClick={onToggleSpeaker}
              className={cn(
                "w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300 backdrop-blur-2xl border",
                !isSpeakerOn 
                  ? "bg-red-500/10 text-red-500 border-red-500/20" 
                  : "bg-white/[0.02] text-zinc-500 hover:text-white border-white/[0.05]"
              )}
            >
              {!isSpeakerOn ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
            </button>

            <div className="relative group">
              <div className="absolute inset-0 bg-white/10 blur-2xl rounded-full scale-0 group-hover:scale-100 transition-transform duration-500 opacity-20" />
              <button 
                onClick={onClose}
                className="w-20 h-20 rounded-full bg-white text-black flex items-center justify-center hover:scale-110 active:scale-95 transition-all shadow-3xl shadow-white/10 border-8 border-[#020202] relative z-10"
              >
                <PhoneOff className="w-8 h-8" />
              </button>
            </div>

            <button 
              onClick={onToggleListening}
              className={cn(
                "w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300 backdrop-blur-2xl border",
                !isListening 
                  ? "bg-white/[0.01] text-zinc-600 border-white/[0.03]" 
                  : "bg-blue-600 text-white border-blue-500 shadow-[0_0_30px_rgba(37,99,235,0.3)]"
              )}
            >
              {isListening ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
