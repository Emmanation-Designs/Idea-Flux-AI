import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Mic, 
  MicOff, 
  Volume2, 
  VolumeX, 
  PhoneOff,
  Settings as SettingsIcon,
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
  const [showVoiceSettings, setShowVoiceSettings] = useState(false);

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
              {/* Ambient Glow */}
              <AnimatePresence>
                {(isListening || isPlaying || isLoading) && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ 
                      opacity: [0.1, 0.2, 0.1],
                      scale: [1, 1.2, 1],
                    }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: 3, repeat: Infinity }}
                    className={cn(
                      "absolute w-64 h-64 rounded-full blur-[80px]",
                      isListening ? "bg-red-500" : isPlaying ? "bg-blue-500" : "bg-amber-500"
                    )}
                  />
                )}
              </AnimatePresence>
              
              {/* Core Orb */}
              <motion.div 
                animate={{ 
                  scale: isPlaying ? [1, 1.05, 1] : isListening ? [1, 1.02, 1] : 1,
                  boxShadow: isPlaying 
                    ? ["0 0 20px rgba(255,255,255,0.1)", "0 0 60px rgba(255,255,255,0.3)", "0 0 20px rgba(255,255,255,0.1)"]
                    : ["0 0 20px rgba(255,255,255,0.05)", "0 0 20px rgba(255,255,255,0.05)"]
                }}
                transition={{ duration: 2, repeat: Infinity }}
                className={cn(
                  "relative h-32 w-32 rounded-full flex items-center justify-center transition-all duration-700",
                  (isListening || isPlaying || isLoading) ? "bg-white" : "bg-white/10 backdrop-blur-sm border border-white/10"
                )}
              >
                {isLoading && (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                    className="absolute inset-0 rounded-full border-2 border-t-zinc-900 border-transparent"
                  />
                )}
                
                <div className="relative z-10">
                  {isPlaying ? (
                    <Volume2 className="w-8 h-8 text-black" />
                  ) : isListening ? (
                    <Mic className="w-8 h-8 text-black" />
                  ) : isLoading ? (
                    <div className="w-2 h-2 rounded-full bg-black animate-pulse" />
                  ) : (
                    <MicOff className="w-8 h-8 text-white/40" />
                  )}
                </div>
              </motion.div>
            </div>

            {/* Transcriptions & Subtitles - REMOVED as requested */}
            <div className="absolute bottom-40 left-0 right-0 px-8 flex flex-col items-center gap-4 pointer-events-none">
              {!transcript && !response && (
                <motion.p 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.4 }}
                  className="text-zinc-500 text-sm md:text-base font-medium tracking-widest uppercase"
                >
                  {isListening ? "Listening..." : isPlaying ? "Speaking..." : isLoading ? "Thinking..." : "Ready"}
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
