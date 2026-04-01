import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Mic, 
  MicOff, 
  Volume2, 
  VolumeX, 
  PhoneOff,
  Waves,
  Settings as SettingsIcon,
  Zap
} from 'lucide-react';
import { useState, useEffect } from 'react';
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
  transcript,
  response,
  isMuted,
  onToggleMute,
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
  transcript: string;
  response: string;
  isMuted: boolean;
  onToggleMute: () => void;
  isSpeakerOn: boolean;
  onToggleSpeaker: () => void;
  voiceOption: 'alloy' | 'echo';
  onVoiceOptionChange: (voice: 'alloy' | 'echo') => void;
}) => {
  const [pulseScale, setPulseScale] = useState(1);
  const [showVoiceSettings, setShowVoiceSettings] = useState(false);

  useEffect(() => {
    let interval: any;
    if (isListening || isPlaying || isLoading) {
      interval = setInterval(() => {
        setPulseScale(1 + Math.random() * 0.4);
      }, 150);
    } else {
      setPulseScale(1);
    }
    return () => clearInterval(interval);
  }, [isListening, isPlaying, isLoading]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: '100%' }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="fixed inset-0 z-50 bg-black text-white flex flex-col items-center justify-between p-6 md:p-12 overflow-hidden"
        >
          {/* Header */}
          <div className="w-full flex items-center justify-between z-20">
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-2 h-2 rounded-full",
                isListening ? "bg-red-500 animate-pulse" : 
                isPlaying ? "bg-blue-500 animate-pulse" : 
                isLoading ? "bg-amber-500 animate-pulse" : "bg-zinc-500"
              )} />
              <span className="text-xs font-bold tracking-[0.2em] uppercase opacity-60">
                {isListening ? "Listening" : isPlaying ? "Speaking" : isLoading ? "Thinking" : "Voice Chat"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setShowVoiceSettings(!showVoiceSettings)}
                className={cn(
                  "p-2 rounded-full transition-colors",
                  showVoiceSettings ? "bg-white text-black" : "hover:bg-white/10"
                )}
              >
                <SettingsIcon className="w-5 h-5" />
              </button>
              <button 
                onClick={onClose}
                className="p-2 hover:bg-white/10 rounded-full transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>

          {/* Voice Settings Overlay */}
          <AnimatePresence>
            {showVoiceSettings && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="absolute top-20 right-6 md:right-12 z-30 bg-zinc-900/90 backdrop-blur-xl border border-white/10 rounded-2xl p-4 w-64 shadow-2xl"
              >
                <h3 className="text-xs font-bold uppercase tracking-wider opacity-50 mb-3">Select Voice</h3>
                <div className="space-y-2">
                  {(['alloy', 'echo'] as const).map((v) => (
                    <button
                      key={v}
                      onClick={() => {
                        onVoiceOptionChange(v);
                        setShowVoiceSettings(false);
                      }}
                      className={cn(
                        "w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all",
                        voiceOption === v ? "bg-white text-black" : "hover:bg-white/5 text-white/70"
                      )}
                    >
                      <span>{v === 'alloy' ? 'Female (Alloy)' : 'Male (Echo)'}</span>
                      {voiceOption === v && <div className="w-1.5 h-1.5 rounded-full bg-current" />}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Visualizer Area */}
          <div className="flex-1 flex flex-col items-center justify-center gap-12 w-full max-w-2xl text-center relative">
            <div className="relative flex items-center justify-center scale-110 md:scale-125">
              {/* Outer Glows */}
              <AnimatePresence>
                {(isListening || isPlaying || isLoading) && (
                  <>
                    <motion.div 
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ 
                        scale: pulseScale * 1.8, 
                        opacity: 0.1,
                        backgroundColor: isListening ? "#ef4444" : isPlaying ? "#3b82f6" : "#f59e0b"
                      }}
                      exit={{ scale: 0.8, opacity: 0 }}
                      className="absolute w-64 h-64 rounded-full blur-[80px] transition-colors duration-1000"
                    />
                    <motion.div 
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ 
                        scale: pulseScale * 1.4, 
                        opacity: 0.2,
                        backgroundColor: isListening ? "#f87171" : isPlaying ? "#60a5fa" : "#fbbf24"
                      }}
                      exit={{ scale: 0.8, opacity: 0 }}
                      className="absolute w-48 h-48 rounded-full blur-[40px] transition-colors duration-1000"
                    />
                  </>
                )}
              </AnimatePresence>

              {/* Central Orb */}
              <motion.div 
                animate={{ 
                  scale: (isListening || isPlaying || isLoading) ? [1, 1.1, 1] : 1,
                  rotate: (isListening || isPlaying || isLoading) ? [0, 90, 180, 270, 360] : 0,
                  borderRadius: (isListening || isPlaying || isLoading) ? ["40% 60% 70% 30% / 40% 50% 60% 50%", "60% 40% 30% 70% / 50% 60% 40% 50%", "40% 60% 70% 30% / 40% 50% 60% 50%"] : "50%",
                  boxShadow: (isListening || isPlaying || isLoading) 
                    ? `0 0 60px ${isListening ? "rgba(239, 68, 68, 0.4)" : isPlaying ? "rgba(59, 130, 246, 0.4)" : "rgba(245, 158, 11, 0.4)"}, inset 0 0 20px rgba(255, 255, 255, 0.5)` 
                    : "0 0 20px rgba(255, 255, 255, 0.1)"
                }}
                transition={{
                  duration: (isListening || isPlaying || isLoading) ? 4 : 0.5,
                  repeat: Infinity,
                  ease: "linear"
                }}
                className={cn(
                  "w-40 h-40 flex items-center justify-center transition-colors duration-1000 relative z-10",
                  (isListening || isPlaying || isLoading) ? "bg-white" : "bg-zinc-800"
                )}
              >
                {isListening ? (
                  <Mic className="w-12 h-12 text-black" />
                ) : isPlaying ? (
                  <Waves className="w-12 h-12 text-black" />
                ) : isLoading ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                  >
                    <Zap className="w-12 h-12 text-black" />
                  </motion.div>
                ) : (
                  <MicOff className="w-12 h-12 text-zinc-500" />
                )}
              </motion.div>
            </div>

            {/* Transcriptions */}
            <div className="space-y-6 min-h-[120px] flex flex-col justify-center px-4">
              <AnimatePresence mode="wait">
                {transcript && (
                  <motion.p 
                    key="transcript"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 0.5, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="text-lg md:text-xl font-medium italic text-zinc-300"
                  >
                    "{transcript}"
                  </motion.p>
                )}
              </AnimatePresence>
              
              <AnimatePresence mode="wait">
                {response && (
                  <motion.p 
                    key="response"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="text-xl md:text-3xl font-bold leading-tight"
                  >
                    {response}
                  </motion.p>
                )}
              </AnimatePresence>

              {!transcript && !response && (
                <motion.p 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-zinc-500 text-lg md:text-xl font-medium"
                >
                  {isListening ? "I'm listening..." : isPlaying ? "Ideaflux is speaking..." : isLoading ? "Thinking..." : "Tap the microphone to start"}
                </motion.p>
              )}
            </div>
          </div>

          {/* Controls */}
          <div className="w-full max-w-md flex items-center justify-around pb-8 z-20">
            <button 
              onClick={onToggleMute}
              className={cn(
                "p-5 rounded-full transition-all transform hover:scale-110 active:scale-95",
                isMuted ? "bg-red-500/20 text-red-500" : "bg-zinc-900 text-white hover:bg-zinc-800"
              )}
              title={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
            </button>

            <button 
              onClick={onToggleListening}
              className={cn(
                "p-8 rounded-full transition-all transform hover:scale-110 active:scale-95 shadow-2xl",
                isListening ? "bg-white text-black" : "bg-blue-600 text-white"
              )}
              title={isListening ? "Stop Listening" : "Start Listening"}
            >
              {isListening ? <Mic className="w-10 h-10" /> : <Mic className="w-10 h-10" />}
            </button>

            <button 
              onClick={onToggleSpeaker}
              className={cn(
                "p-5 rounded-full transition-all transform hover:scale-110 active:scale-95",
                !isSpeakerOn ? "bg-red-500/20 text-red-500" : "bg-zinc-900 text-white hover:bg-zinc-800"
              )}
              title={isSpeakerOn ? "Speaker On" : "Speaker Off"}
            >
              {isSpeakerOn ? <Volume2 className="w-6 h-6" /> : <VolumeX className="w-6 h-6" />}
            </button>

            <button 
              onClick={onClose}
              className="p-5 rounded-full bg-red-600 text-white hover:bg-red-700 transition-all transform hover:scale-110 active:scale-95 shadow-lg"
              title="End Chat"
            >
              <PhoneOff className="w-6 h-6" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
