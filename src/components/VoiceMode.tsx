import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Mic, 
  MicOff, 
  Volume2, 
  VolumeX, 
  PhoneOff,
  ChevronRight,
  PlayCircle,
  Zap,
  Globe
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
  const [isStarted, setIsStarted] = useState(false);
  const [previewingVoice, setPreviewingVoice] = useState<string | null>(null);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

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

  // Derived state for the UI
  const state = isLoading ? 'thinking' : isPlaying ? 'speaking' : isListening ? 'listening' : 'idle';
  const volume = isPlaying || isListening ? 0.6 : 0.05; 

  const handlePreviewVoice = (id: string) => {
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
    }
    
    // Stop any existing speech
    window.speechSynthesis.cancel();
    
    setPreviewingVoice(id);
    
    const message = "Hey Welcome to Trelvix Live mode, what do you want to talk about.";
    const utterance = new SpeechSynthesisUtterance(message);
    
    // Attempt to find a suitable voice based on the name/ID
    const voices = availableVoices.length > 0 ? availableVoices : window.speechSynthesis.getVoices();
    const voiceData = VOICES.find(v => v.id === id);
    
    let selectedVoice = voices.find(v => v.name.toLowerCase().includes(id.toLowerCase()));
    
    if (!selectedVoice) {
      // Priority search for male/female voices if the exact name isn't found
      const targetGender = voiceData?.gender || (id === 'onyx' || id === 'echo' || id === 'atlas' ? 'male' : 'female');
      
      const maleKeywords = ['male', 'david', 'mark', 'guy', 'daniel', 'alex', 'james', 'thomas', 'stefan', 'george', 'paul', 'danny', 'steve'];
      const femaleKeywords = ['female', 'zira', 'samantha', 'victoria', 'susan', 'amy', 'linda', 'mary', 'karen', 'olivia', 'emma', 'sara', 'anna'];
      const keywords = targetGender === 'male' ? maleKeywords : femaleKeywords;

      selectedVoice = voices.find(v => {
        const name = v.name.toLowerCase();
        return keywords.some(k => name.includes(k));
      });
      
      // Secondary fallback for common system voices
      if (!selectedVoice) {
        if (targetGender === 'male') {
          selectedVoice = voices.find(v => v.name.toLowerCase().includes('en-us') && v.name.toLowerCase().includes('male')) || 
                          voices.find(v => v.name.toLowerCase().includes('david')) ||
                          voices.find(v => v.name.toLowerCase().includes('mark'));
        } else {
          selectedVoice = voices.find(v => v.name.toLowerCase().includes('en-us') && v.name.toLowerCase().includes('female')) ||
                          voices.find(v => v.name.toLowerCase().includes('zira')) ||
                          voices.find(v => v.name.toLowerCase().includes('samantha'));
        }
      }
    }
    
    // Final fallback
    if (!selectedVoice) {
      selectedVoice = voices[0];
    }
    
    if (selectedVoice) utterance.voice = selectedVoice;
    
    // Adjust pitch/rate based on voice type
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
      setIsStarted(false);
      setPreviewingVoice(null);
      if (previewAudioRef.current) previewAudioRef.current.pause();
      window.speechSynthesis.cancel();
    }
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] bg-[#020202] text-white flex flex-col items-center overflow-hidden font-sans"
        >
          {/* 1. Atmospheric Glows (Green theme as requested) */}
          <div className="absolute inset-0 z-0 pointer-events-none">
             {/* Bottom Radiance */}
             <motion.div 
              animate={{
                scale: state === 'speaking' ? [1, 1.1, 1] : 1,
                opacity: isStarted ? (state === 'speaking' ? 0.4 : 0.2) : 0.05,
              }}
              transition={{ duration: 4, repeat: Infinity }}
              className="absolute bottom-[-10%] left-1/2 -translate-x-1/2 w-full max-w-4xl h-[60%] bg-emerald-500/15 blur-[120px] rounded-full transition-all duration-1000"
            />
            {/* Fine Dust/Static */}
            <div className="absolute inset-0 opacity-[0.03] bg-[url('https://grainy-gradients.vercel.app/noise.svg')] pointer-events-none" />
          </div>

          {!isStarted ? (
            /* --- STEP 1: VOICE SELECTION --- */
            <motion.div 
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="relative z-10 w-full max-w-md flex-1 flex flex-col items-center justify-center p-6 space-y-8 overflow-hidden"
            >
              <div className="text-center space-y-3 shrink-0">
                <div className="flex items-center justify-center gap-2 mb-4">
                  <div className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-400">Live Config</span>
                  </div>
                </div>
                <h2 className="text-3xl font-bold tracking-tight">Select a Voice</h2>
                <p className="text-zinc-500 text-sm font-medium">Choose who you'll be speaking with today.</p>
              </div>

              <div className="w-full space-y-2 overflow-y-auto pr-2 max-h-[50vh] scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                {VOICES.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => {
                      if (voiceOption === v.id) {
                        setIsStarted(true);
                      } else {
                        onVoiceOptionChange(v.id);
                      }
                    }}
                    className={cn(
                      "w-full flex items-center justify-between p-4 rounded-[2rem] transition-all duration-500 border",
                      voiceOption === v.id 
                        ? "bg-white text-black border-white shadow-2xl scale-[1.02]" 
                        : "bg-white/[0.03] border-white/5 hover:bg-white/[0.06] text-zinc-400"
                    )}
                  >
                    <div className="flex items-center gap-4">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePreviewVoice(v.id);
                        }}
                        className={cn(
                          "w-11 h-11 rounded-2xl flex items-center justify-center transition-all",
                          previewingVoice === v.id ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30" : "bg-white/5"
                        )}
                      >
                        <PlayCircle className={cn("w-5 h-5", previewingVoice === v.id && "animate-pulse")} />
                      </button>
                      <div className="text-left">
                        <div className="flex items-center gap-2">
                          <div className="text-[14px] font-bold tracking-tight">{v.name}</div>
                          <div className={cn(
                            "px-1.5 py-0.5 rounded-md text-[8px] font-black uppercase tracking-wider border",
                            v.gender === 'male' 
                              ? "bg-blue-500/10 border-blue-500/20 text-blue-500" 
                              : "bg-pink-500/10 border-pink-500/20 text-pink-500"
                          )}>
                            {v.gender}
                          </div>
                        </div>
                        <div className="text-[11px] opacity-60 font-medium">{v.desc}</div>
                      </div>
                    </div>
                    {voiceOption === v.id && (
                      <div className="bg-emerald-500/10 p-2 rounded-xl">
                        <ChevronRight className="w-4 h-4 text-emerald-600" />
                      </div>
                    )}
                  </button>
                ))}
              </div>

              <div className="w-full pt-4 space-y-3 shrink-0">
                <button 
                  onClick={() => setIsStarted(true)}
                  className="w-full py-5 rounded-[2rem] bg-emerald-500 text-black font-black text-xs uppercase tracking-[0.25em] shadow-2xl shadow-emerald-500/20 hover:bg-emerald-400 transition-all active:scale-95"
                >
                  Start Discussion
                </button>
                <button 
                  onClick={onClose}
                  className="w-full py-4 text-[11px] font-bold uppercase tracking-widest text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          ) : (
            /* --- STEP 2: LIVE MODE (Green Aesthetic) --- */
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="relative z-10 w-full h-full flex flex-col items-center justify-between p-6 md:p-12"
            >
              <div className="w-full flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2.5 px-4 py-2 bg-white/[0.03] backdrop-blur-3xl rounded-full border border-white/5">
                    <div className={cn(
                      "w-1.5 h-1.5 rounded-full transition-all duration-1000",
                      state === 'speaking' ? "bg-emerald-400 shadow-[0_0_12px_#34d399]" : 
                      state === 'listening' ? "bg-white" : "bg-zinc-800"
                    )} />
                    <span className="text-[10px] font-black tracking-[0.4em] uppercase text-zinc-500">Live</span>
                  </div>
                  <div className="hidden md:flex items-center gap-2 group cursor-pointer" onClick={() => setIsStarted(false)}>
                    <Globe className="w-3.5 h-3.5 text-zinc-600 group-hover:text-emerald-500 transition-colors" />
                    <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest group-hover:text-emerald-500 transition-colors">{voiceOption}</span>
                  </div>
                </div>
                <button 
                  onClick={onClose} 
                  className="p-3 text-zinc-500 hover:text-white transition-all bg-white/[0.02] hover:bg-white/10 rounded-2xl border border-white/5"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Central Visualization Stage */}
              <div className="flex-1 flex flex-col items-center justify-center w-full max-w-2xl relative">
                <div className="relative w-full h-72 flex items-center justify-center">
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    {/* Energy Rings / Waves */}
                    {[...Array(3)].map((_, i) => (
                      <motion.div
                        key={`wave-${i}`}
                        animate={{
                          scaleY: state === 'speaking' || state === 'listening' ? [1, 2.5 + (Math.random() * 2), 1] : 1,
                          opacity: state === 'speaking' ? [0.1, 0.4, 0.1] : 0.05,
                          translateY: state === 'speaking' ? [0, (i % 2 === 0 ? 10 : -10), 0] : 0,
                        }}
                        transition={{ duration: 1 + (i * 0.3), repeat: Infinity, ease: "easeInOut" }}
                        className={cn(
                          "absolute w-full rounded-full blur-[40px] mix-blend-screen transition-colors duration-2000",
                          i === 0 ? "bg-emerald-400 h-[2px]" : 
                          i === 1 ? "bg-emerald-600 h-[1.5px]" : "bg-white/5 h-[30px]"
                        )}
                      />
                    ))}

                    {/* Grok-style pulse lines */}
                    <div className="absolute w-full flex items-center justify-between gap-[2px]">
                      {[...Array(140)].map((_, i) => (
                        <motion.div
                          key={`pulse-${i}`}
                          animate={{
                            height: state === 'speaking' || state === 'listening' 
                              ? [4, 4 + (Math.sin(i * 0.1 + Date.now() / 200) * 80 * volume) + (Math.random() * 15), 4]
                              : 2,
                            opacity: state === 'idle' ? 0.05 : [0.2, 0.6, 0.2]
                          }}
                          transition={{ duration: 0.5, repeat: Infinity, ease: "linear" }}
                          className={cn(
                            "w-[1px] md:w-[2px] rounded-full transition-colors duration-500",
                            state === 'speaking' ? "bg-emerald-400" : "bg-zinc-800"
                          )}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-20 text-center space-y-5">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={state}
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -15 }}
                      className="flex flex-col items-center gap-3"
                    >
                      <h2 className="text-4xl md:text-5xl font-light tracking-tight text-white/95">
                        {state === 'thinking' ? "Thinking..." : 
                         state === 'speaking' ? "Speaking..." : 
                         state === 'listening' ? "Listening..." : "Connected"}
                      </h2>
                      <div className="flex items-center gap-4">
                        <div className="h-[1px] w-6 bg-emerald-500/20" />
                        <span className="text-[10px] font-black text-emerald-500/40 uppercase tracking-[0.5em]">
                          {voiceOption} Engine Active
                        </span>
                        <div className="h-[1px] w-6 bg-emerald-500/20" />
                      </div>
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>

              {/* Bottom Responsive Controls (Matching screenshot vibe) */}
              <div className="w-full max-w-lg grid grid-cols-4 gap-4 items-center pb-10">
                <button 
                  onClick={onToggleSpeaker}
                  className={cn(
                    "w-full aspect-square md:w-16 md:h-16 mx-auto rounded-[2.5rem] flex items-center justify-center transition-all bg-white/[0.03] border border-white/5",
                    !isSpeakerOn ? "text-red-500 bg-red-500/5" : "text-zinc-500 hover:text-white"
                  )}
                >
                  {!isSpeakerOn ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
                </button>

                <div className="col-span-2 flex justify-center">
                  <button 
                    onClick={onToggleListening}
                    className={cn(
                      "w-20 h-20 md:w-24 md:h-24 rounded-[3rem] flex items-center justify-center transition-all duration-500 relative group",
                      isListening ? "bg-emerald-500 text-black shadow-[0_0_50px_rgba(16,185,129,0.3)]" : "bg-white/[0.05] text-zinc-500 border border-white/10"
                    )}
                  >
                    <div className="absolute inset-0 bg-emerald-400 blur-xl opacity-0 group-hover:opacity-20 transition-opacity rounded-full" />
                    {isListening ? <Mic className="w-8 h-8 relative z-10" /> : <MicOff className="w-8 h-8 relative z-10" />}
                  </button>
                </div>

                <button 
                  onClick={onClose}
                  className="w-full aspect-square md:w-16 md:h-16 mx-auto rounded-[2.5rem] bg-red-500 text-white flex items-center justify-center hover:scale-110 active:scale-95 transition-all shadow-2xl shadow-red-500/20"
                >
                  <PhoneOff className="w-6 h-6" />
                </button>
              </div>
            </motion.div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};
