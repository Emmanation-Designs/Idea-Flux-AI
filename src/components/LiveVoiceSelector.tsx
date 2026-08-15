import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, ChevronRight, X, Globe, ChevronDown, Check, Volume2 } from 'lucide-react';
import { SUPPORTED_LIVE_VOICES, LiveVoice } from '../types/live';

interface LiveVoiceSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  selectedVoice: string;
  onSelectVoice: (voiceId: string) => void;
  selectedLanguage: string;
  onSelectLanguage: (lang: string) => void;
}

const LANGUAGES = [
  { id: 'auto', label: 'Auto-detect' },
  { id: 'en', label: 'English' },
  { id: 'es', label: 'Spanish' },
  { id: 'fr', label: 'French' },
  { id: 'de', label: 'German' },
  { id: 'zh', label: 'Chinese' },
  { id: 'ja', label: 'Japanese' },
  { id: 'ko', label: 'Korean' },
  { id: 'pt', label: 'Portuguese' },
  { id: 'it', label: 'Italian' },
  { id: 'nl', label: 'Dutch' },
  { id: 'ru', label: 'Russian' },
  { id: 'hi', label: 'Hindi' },
  { id: 'ar', label: 'Arabic' },
];

export const LiveVoiceSelector: React.FC<LiveVoiceSelectorProps> = ({
  isOpen,
  onClose,
  selectedVoice,
  onSelectVoice,
  selectedLanguage,
  onSelectLanguage,
}) => {
  const currentIndex = SUPPORTED_LIVE_VOICES.findIndex((v) => v.id === selectedVoice);
  const activeIndex = currentIndex >= 0 ? currentIndex : 0;
  const currentVoice = SUPPORTED_LIVE_VOICES[activeIndex] || SUPPORTED_LIVE_VOICES[0];

  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);

  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const previewTokenRef = useRef<number>(0);

  // Stop audio playback when modal unmounts or closes
  useEffect(() => {
    if (!isOpen) {
      stopCurrentPreview();
    }
  }, [isOpen]);

  const stopCurrentPreview = () => {
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current.currentTime = 0;
      previewAudioRef.current = null;
    }
    setIsPlayingPreview(false);
  };

  const playVoicePreview = (voice: LiveVoice) => {
    stopCurrentPreview();

    const thisToken = ++previewTokenRef.current;
    setIsPlayingPreview(true);

    try {
      const audio = new Audio(`/voices/${voice.id}.wav`);
      previewAudioRef.current = audio;

      audio.onended = () => {
        if (previewTokenRef.current === thisToken) {
          setIsPlayingPreview(false);
          previewAudioRef.current = null;
        }
      };

      audio.onerror = (e) => {
        console.warn(`[Live Voice Preview] Audio load error for ${voice.id}:`, e);
        if (previewTokenRef.current === thisToken) {
          setIsPlayingPreview(false);
          previewAudioRef.current = null;
        }
      };

      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          console.warn(`[Live Voice Preview] Playback prevented:`, err);
          if (previewTokenRef.current === thisToken) {
            setIsPlayingPreview(false);
          }
        });
      }
    } catch (err) {
      console.warn('[Live Voice Preview] Exception:', err);
      setIsPlayingPreview(false);
    }
  };

  const handlePrev = () => {
    const nextIdx = (activeIndex - 1 + SUPPORTED_LIVE_VOICES.length) % SUPPORTED_LIVE_VOICES.length;
    const voice = SUPPORTED_LIVE_VOICES[nextIdx];
    onSelectVoice(voice.id);
    playVoicePreview(voice);
  };

  const handleNext = () => {
    const nextIdx = (activeIndex + 1) % SUPPORTED_LIVE_VOICES.length;
    const voice = SUPPORTED_LIVE_VOICES[nextIdx];
    onSelectVoice(voice.id);
    playVoicePreview(voice);
  };

  const selectedLanguageLabel = LANGUAGES.find((l) => l.id === selectedLanguage)?.label || 'Auto-detect';

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md"
        onClick={() => {
          stopCurrentPreview();
          onClose();
        }}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 15 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 15 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-[420px] p-7 bg-[#212121] dark:bg-[#18181b] light:bg-white text-white dark:text-white light:text-zinc-900 border border-zinc-700/50 dark:border-zinc-800 rounded-[28px] shadow-2xl overflow-hidden flex flex-col items-center select-none"
        >
          {/* Top Right Close 'X' Button */}
          <button
            onClick={() => {
              stopCurrentPreview();
              onClose();
            }}
            className="absolute top-5 right-5 p-1.5 text-zinc-400 hover:text-white dark:hover:text-white rounded-full hover:bg-white/10 transition-colors"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Voice Preview Orb (Brand Green with animated glow on play) */}
          <div className="relative flex items-center justify-center mt-4 mb-6">
            <motion.div
              key={currentVoice.id}
              initial={{ scale: 0.92, opacity: 0.8 }}
              animate={{ 
                scale: isPlayingPreview ? [1, 1.06, 0.98, 1.04, 1] : 1,
                opacity: 1 
              }}
              transition={isPlayingPreview ? { repeat: Infinity, duration: 1.2 } : { duration: 0.25 }}
              className="w-36 h-36 sm:w-40 sm:h-40 rounded-full bg-gradient-to-tr from-[#19C37D] via-[#10b981] to-[#34d399] shadow-2xl shadow-emerald-500/25 flex items-center justify-center cursor-pointer active:scale-95 transition-transform relative group"
              onClick={() => playVoicePreview(currentVoice)}
              title="Click to preview voice"
            >
              {/* Inner soft diffuse glow */}
              <div className="w-full h-full rounded-full bg-radial from-white/30 via-transparent to-black/10 backdrop-blur-xs flex items-center justify-center">
                {isPlayingPreview && (
                  <Volume2 className="w-8 h-8 text-white/90 animate-pulse" />
                )}
              </div>
            </motion.div>
          </div>

          {/* Voice Name & Description */}
          <div className="text-center mb-5">
            <div className="flex items-center justify-center gap-2">
              <h3 className="text-xl font-bold text-white dark:text-white light:text-zinc-900 tracking-tight mb-1">
                {currentVoice.name}
              </h3>
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 capitalize">
                {currentVoice.gender}
              </span>
            </div>
            <p className="text-sm text-zinc-400 dark:text-zinc-400 light:text-zinc-500">
              {currentVoice.description}
            </p>
          </div>

          {/* Left Arrow, Pagination Dots, Right Arrow */}
          <div className="flex items-center justify-center gap-6 mb-8 w-full max-w-[280px]">
            <button
              onClick={handlePrev}
              className="p-1.5 text-zinc-400 hover:text-white dark:hover:text-white rounded-full hover:bg-white/10 transition active:scale-90"
              title="Previous voice"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            {/* Pagination Dots */}
            <div className="flex items-center gap-1.5 flex-wrap justify-center max-w-[180px]">
              {SUPPORTED_LIVE_VOICES.map((v, idx) => (
                <button
                  key={v.id}
                  onClick={() => {
                    onSelectVoice(v.id);
                    playVoicePreview(v);
                  }}
                  className={`h-1.5 rounded-full transition-all duration-200 ${
                    idx === activeIndex
                      ? 'w-4 bg-white dark:bg-white'
                      : 'w-1.5 bg-zinc-600 hover:bg-zinc-400'
                  }`}
                  title={v.name}
                />
              ))}
            </div>

            <button
              onClick={handleNext}
              className="p-1.5 text-zinc-400 hover:text-white dark:hover:text-white rounded-full hover:bg-white/10 transition active:scale-90"
              title="Next voice"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Bottom Language Row */}
          <div className="w-full pt-4 border-t border-zinc-700/60 dark:border-zinc-800 relative">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-normal text-zinc-300 dark:text-zinc-300 light:text-zinc-700">
                <Globe className="w-4 h-4 text-zinc-400" />
                <span>Language</span>
              </div>

              {/* Language Selector Dropdown trigger */}
              <button
                onClick={() => setShowLanguageDropdown((prev) => !prev)}
                className="flex items-center gap-1 text-sm text-zinc-300 dark:text-zinc-300 hover:text-white dark:hover:text-white transition font-normal"
              >
                <span>{selectedLanguageLabel}</span>
                <ChevronDown className="w-4 h-4 text-zinc-400" />
              </button>
            </div>

            {/* Language Selection Popover */}
            <AnimatePresence>
              {showLanguageDropdown && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute bottom-12 right-0 w-48 max-h-56 overflow-y-auto bg-zinc-800 dark:bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl p-1.5 z-20"
                >
                  {LANGUAGES.map((lang) => (
                    <button
                      key={lang.id}
                      onClick={() => {
                        onSelectLanguage(lang.id);
                        setShowLanguageDropdown(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 text-xs rounded-lg text-left transition ${
                        selectedLanguage === lang.id
                          ? 'bg-emerald-600/20 text-emerald-400 font-semibold'
                          : 'text-zinc-300 hover:bg-zinc-700/50 hover:text-white'
                      }`}
                    >
                      <span>{lang.label}</span>
                      {selectedLanguage === lang.id && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
