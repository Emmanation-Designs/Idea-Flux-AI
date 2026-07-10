import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, 
  Pause, 
  Download, 
  Volume2, 
  RefreshCw, 
  Clock, 
  FileText, 
  ChevronDown,
  ChevronRight,
  Info,
  Check,
  AlertCircle,
  Sparkles,
  ExternalLink,
  BookOpen,
  VolumeX,
  HelpCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../lib/supabase';
import type { Profile } from '../types';
import { toast } from 'sonner';

interface TextToSpeechViewProps {
  profile: Profile | null;
  onUpgradeClick?: () => void;
  onBack?: () => void;
}

interface TTSHistoryItem {
  id: string;
  created_at: string;
  character_count: number;
  selected_voice: string;
  selected_model: string;
  generation_status: string;
  audio_url?: string;
  text_snippet: string;
}

const VOICE_OPTIONS = [
  { id: 'alloy', name: 'Alloy', gender: 'Neutral', personality: 'Balanced, professional, and natural', desc: 'Versatile tone ideal for audiobooks, standard tutorials, and standard narration.' },
  { id: 'echo', name: 'Echo', gender: 'Male', personality: 'Warm, natural, and authoritative', desc: 'Slightly deeper resonance suited for informative briefings and news segments.' },
  { id: 'fable', name: 'Fable', gender: 'Neutral', personality: 'Expressive and clear conversational pitch', desc: 'Enunciated, dynamic delivery great for guides and narrative reviews.' },
  { id: 'onyx', name: 'Onyx', gender: 'Male', personality: 'Deep, stable, and highly professional', desc: 'Commanding and confident profile perfect for business reports and briefings.' },
  { id: 'nova', name: 'Nova', gender: 'Female', personality: 'Bright, articulate, and friendly', desc: 'Welcoming tone designed for educational courses and customer support guides.' },
  { id: 'shimmer', name: 'Shimmer', gender: 'Female', personality: 'Articulate, corporate, and clear assistant', desc: 'Highly legible pitch, excellent for automated assistants and walkthroughs.' }
];

const MODEL_OPTIONS = [
  { id: 'tts-1', name: 'Standard (tts-1)', desc: 'Optimized for lowest latency and standard operations.' },
  { id: 'tts-1-hd', name: 'High-Definition (tts-1-hd)', desc: 'Optimized for maximum fidelity and production-quality exports.' }
];

export const TextToSpeechView = ({ profile, onUpgradeClick, onBack }: TextToSpeechViewProps) => {
  const STORAGE_KEY_VOICE = 'trelvix_tts_voice';
  const STORAGE_KEY_SPEED = 'trelvix_tts_speed';
  const STORAGE_KEY_MODEL = 'trelvix_tts_model';

  const [text, setText] = useState('');
  const [selectedVoice, setSelectedVoice] = useState(() => localStorage.getItem(STORAGE_KEY_VOICE) || 'alloy');
  const [speed, setSpeed] = useState(() => Number(localStorage.getItem(STORAGE_KEY_SPEED)) || 1.0);
  const [selectedModel, setSelectedModel] = useState(() => localStorage.getItem(STORAGE_KEY_MODEL) || 'tts-1');
  
  // Custom pro sliders
  const [stability, setStability] = useState(0.75);
  const [similarity, setSimilarity] = useState(0.85);

  const [isGenerating, setIsGenerating] = useState(false);
  const [generationPhase, setGenerationPhase] = useState<'preparing' | 'generating' | 'optimizing' | 'finalizing' | null>(null);
  
  const [generationsToday, setGenerationsToday] = useState(0);
  const [maxGenerationsToday, setMaxGenerationsToday] = useState(3);
  const [maxCharactersPerGen, setMaxCharactersPerGen] = useState(2000);
  const [unlimitedGenerations, setUnlimitedGenerations] = useState(false);
  const [isLoadingLimits, setIsLoadingLimits] = useState(true);

  // Audio state
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioDuration, setAudioDuration] = useState(0);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);

  // History state
  const [history, setHistory] = useState<TTSHistoryItem[]>([]);
  const [activeHistoryId, setActiveHistoryId] = useState<string | null>(null);

  // Selector dropdowns state
  const [showVoiceDropdown, setShowVoiceDropdown] = useState(false);
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<'settings' | 'history'>('settings');

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const modelDropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_VOICE, selectedVoice);
  }, [selectedVoice]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_SPEED, String(speed));
  }, [speed]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_MODEL, selectedModel);
  }, [selectedModel]);

  // Click outside listener for dropdowns
  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowVoiceDropdown(false);
      }
      if (modelDropdownRef.current && !modelDropdownRef.current.contains(event.target as Node)) {
        setShowModelDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const fetchUsageLimitsAndHistory = async () => {
    if (!profile?.id) return;
    try {
      setIsLoadingLimits(true);
      const { data: limitData, error: limitErr } = await supabase
        .from('tts_plan_limits')
        .select('*')
        .eq('plan_name', profile.plan)
        .single();

      if (!limitErr && limitData) {
        setMaxGenerationsToday(limitData.max_generations_per_day || 3);
        setMaxCharactersPerGen(limitData.max_characters_per_generation || 2000);
        setUnlimitedGenerations(limitData.unlimited_generations || false);
      }

      const { data: usageFunc, error: usageErr } = await supabase
        .rpc('get_today_tts_usage', { user_uuid: profile.id });

      if (!usageErr && usageFunc && usageFunc.length > 0) {
        setGenerationsToday(usageFunc[0].generations_today || 0);
      }

      const { data: historyData, error: historyErr } = await supabase
        .from('tts_generations')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (!historyErr && historyData) {
        const mapped: TTSHistoryItem[] = historyData.map(h => ({
          id: h.id,
          created_at: h.created_at,
          character_count: h.character_count,
          selected_voice: h.selected_voice,
          selected_model: h.selected_model,
          generation_status: h.generation_status,
          text_snippet: h.metadata?.text_snippet || 'Synthesized audio transcript'
        }));
        setHistory(mapped);
      }
    } catch (err) {
      console.error('Error loading Limits and History:', err);
    } finally {
      setIsLoadingLimits(false);
    }
  };

  useEffect(() => {
    fetchUsageLimitsAndHistory();
  }, [profile?.id, profile?.plan]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => setAudioCurrentTime(audio.currentTime);
    const onDurationChange = () => setAudioDuration(audio.duration || 0);
    const onEnded = () => {
      setIsPlaying(false);
      setAudioCurrentTime(0);
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('durationchange', onDurationChange);
    audio.addEventListener('ended', onEnded);

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('durationchange', onDurationChange);
      audio.removeEventListener('ended', onEnded);
    };
  }, [audioUrl]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackSpeed;
    }
  }, [playbackSpeed, audioUrl]);

  const wordCount = text.trim() === '' ? 0 : text.trim().split(/\s+/).length;
  const estimatedSeconds = Math.round((wordCount / 145) * 60) || 0;

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handlePaste = async () => {
    try {
      const clipboardText = await navigator.clipboard.readText();
      if (clipboardText) {
        setText(prev => (prev + ' ' + clipboardText).trim());
        toast.success('Text loaded from clipboard');
      }
    } catch (err) {
      toast.error('Unable to read clipboard access');
    }
  };

  const handleClear = () => {
    setText('');
    setAudioUrl(null);
  };

  const playVoicePreview = (voiceId: string) => {
    toast.info(`Auditioning voice: ${voiceId}`);
    const utterance = new SpeechSynthesisUtterance(`This is a sample audio preview of the ${voiceId} voice.`);
    const matchedVoice = VOICE_OPTIONS.find(v => v.id === voiceId);
    if (matchedVoice) {
      const synthVoices = window.speechSynthesis?.getVoices();
      if (synthVoices && synthVoices.length > 0) {
        const matchingBrowserVoice = synthVoices.find(v => 
          v.name.toLowerCase().includes(voiceId) || 
          v.name.toLowerCase().includes(matchedVoice.gender.toLowerCase())
        );
        if (matchingBrowserVoice) utterance.voice = matchingBrowserVoice;
      }
    }
    window.speechSynthesis?.cancel();
    window.speechSynthesis?.speak(utterance);
  };

  const handleGenerate = async () => {
    if (!text.trim()) {
      toast.error('Please input script text first.');
      return;
    }

    if (text.length > maxCharactersPerGen) {
      toast.error(`Text exceeds maximum generation limit of ${maxCharactersPerGen} characters.`);
      return;
    }

    if (!unlimitedGenerations && generationsToday >= maxGenerationsToday) {
      toast.error(`Daily limit of ${maxGenerationsToday} generations reached.`);
      onUpgradeClick?.();
      return;
    }

    setIsGenerating(true);
    setAudioUrl(null);
    setIsPlaying(false);

    try {
      setGenerationPhase('preparing');
      const { data: sessionData } = await supabase.auth.getSession();
      const sessionToken = sessionData?.session?.access_token;

      if (!sessionToken) {
        throw new Error('Authentication session not found.');
      }

      setGenerationPhase('generating');
      const response = await fetch('/api/tools/text-to-speech', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify({
          text,
          voice: selectedVoice,
          model: selectedModel,
          speed: speed
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Synthesis failed (Status ${response.status})`);
      }

      setGenerationPhase('optimizing');
      const audioBlob = await response.blob();
      const generatedAudioUrl = URL.createObjectURL(audioBlob);

      setGenerationPhase('finalizing');
      setAudioUrl(generatedAudioUrl);
      toast.success('Audio generated successfully.');
      fetchUsageLimitsAndHistory();
    } catch (err: any) {
      console.error('[TTS Generation error]', err);
      toast.error(err.message || 'Failed to complete speech synthesis.');
    } finally {
      setIsGenerating(false);
      setGenerationPhase(null);
    }
  };

  const playHistoryAudioItem = async (item: TTSHistoryItem) => {
    if (activeHistoryId === item.id && audioUrl) {
      if (isPlaying) {
        audioRef.current?.pause();
        setIsPlaying(false);
      } else {
        audioRef.current?.play();
        setIsPlaying(true);
      }
      return;
    }

    try {
      toast.loading('Loading historical track...', { id: 'retrieve-track' });
      const { data: sessionData } = await supabase.auth.getSession();
      const sessionToken = sessionData?.session?.access_token;

      if (!sessionToken) throw new Error('Authorization required');

      const response = await fetch(`/api/tools/text-to-speech/retrieve/${item.id}`, {
        headers: {
          'Authorization': `Bearer ${sessionToken}`
        }
      });

      if (!response.ok) {
        throw new Error('Audio file retrieve failed.');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      
      setAudioUrl(url);
      setActiveHistoryId(item.id);
      setIsPlaying(true);
      
      setTimeout(() => {
        audioRef.current?.play().catch(console.error);
      }, 50);

      toast.success('Track loaded successfully', { id: 'retrieve-track' });
    } catch (err: any) {
      toast.error(err.message || 'Failed to retrieve past track.', { id: 'retrieve-track' });
    }
  };

  const togglePlayPause = () => {
    if (!audioUrl) return;
    if (isPlaying) {
      audioRef.current?.pause();
      setIsPlaying(false);
    } else {
      audioRef.current?.play().catch(console.error);
      setIsPlaying(true);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const targetVal = Number(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = targetVal;
      setAudioCurrentTime(targetVal);
    }
  };

  const downloadAudio = () => {
    if (!audioUrl) return;
    const a = document.createElement('a');
    a.href = audioUrl;
    a.download = `trelvix-tts-${Date.now()}.mp3`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const currentVoiceObj = VOICE_OPTIONS.find(v => v.id === selectedVoice) || VOICE_OPTIONS[0];
  const currentModelObj = MODEL_OPTIONS.find(m => m.id === selectedModel) || MODEL_OPTIONS[0];

  return (
    <div className="flex-1 flex flex-col h-full bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans antialiased overflow-hidden">
      {audioUrl && <audio ref={audioRef} src={audioUrl} />}

      {/* Primary Clean Minimalist Top Header */}
      <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-900 bg-white dark:bg-zinc-950 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          {onBack && (
            <button 
              onClick={onBack}
              className="p-2 border border-zinc-200 dark:border-zinc-800 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-900 text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-100 transition-all cursor-pointer"
              title="Return to Apps"
            >
              <ChevronRight className="w-4 h-4 rotate-180" />
            </button>
          )}
          <div>
            <h1 className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 uppercase">Text to Speech</h1>
          </div>
        </div>

        {/* Action Header Items */}
        <div className="flex items-center gap-3">
          <button className="hidden sm:inline-flex px-3 py-1.5 border border-zinc-200 dark:border-zinc-800 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-900 text-xs text-zinc-600 dark:text-zinc-400 font-medium transition-all cursor-pointer">
            Feedback
          </button>
          <button className="hidden sm:inline-flex px-3 py-1.5 border border-zinc-200 dark:border-zinc-800 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-900 text-xs text-zinc-600 dark:text-zinc-400 font-medium transition-all cursor-pointer">
            Docs
          </button>
          {onUpgradeClick && !unlimitedGenerations && (
            <button 
              onClick={onUpgradeClick}
              className="px-3.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-semibold text-zinc-700 dark:text-zinc-300 transition-all cursor-pointer"
            >
              Upgrade
            </button>
          )}
        </div>
      </div>

      {/* Main Container - Divided into Left and Right Panel exactly like ElevenLabs */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        
        {/* LEFT COLUMN: Clean writing pad workspace (col-span-8 equivalent) */}
        <div className="flex-1 flex flex-col bg-white dark:bg-zinc-950 min-w-0">
          
          <div className="flex-1 p-6 md:p-8 lg:p-10 flex flex-col justify-between overflow-y-auto">
            {/* The Plain Textarea canvas (no borders, matches background) */}
            <div className="w-full">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Start typing or copy-paste your text here..."
                className="w-full h-[calc(100vh-270px)] bg-transparent border-0 focus:outline-none focus:ring-0 text-[15px] leading-relaxed text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400 dark:placeholder:text-zinc-700 resize-none font-sans"
              />
            </div>

            {/* Bottom Status Panel of writing canvas */}
            <div className="pt-6 border-t border-zinc-100 dark:border-zinc-900/60 flex items-center justify-between flex-wrap gap-4 mt-4 shrink-0">
              
              {/* Left Credits Balance */}
              <div className="flex items-center gap-2.5 text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                <span className="h-1.5 w-1.5 rounded-full bg-zinc-400 dark:bg-zinc-600" />
                {isLoadingLimits ? (
                  <span>Checking...</span>
                ) : unlimitedGenerations ? (
                  <span>Unlimited generation access</span>
                ) : (
                  <span>Daily remaining: <strong className="text-zinc-800 dark:text-zinc-200 font-semibold">{maxGenerationsToday - generationsToday}</strong> / {maxGenerationsToday}</span>
                )}
              </div>

              {/* Character counts and primary synthesis trigger */}
              <div className="flex items-center gap-4">
                <span className="text-xs font-mono text-zinc-400 dark:text-zinc-600">
                  {text.length} / {maxCharactersPerGen}
                </span>

                <button
                  onClick={handleGenerate}
                  disabled={isGenerating || !text.trim()}
                  className={`px-5 py-2.5 rounded-lg text-xs font-semibold tracking-tight transition-all duration-200 cursor-pointer border ${
                    isGenerating
                      ? 'bg-zinc-100 dark:bg-zinc-900 text-zinc-400 dark:text-zinc-600 border-zinc-200 dark:border-zinc-800 cursor-not-allowed'
                      : text.trim()
                        ? 'bg-zinc-950 dark:bg-zinc-50 hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-zinc-950 border-transparent shadow-sm'
                        : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-300 dark:text-zinc-700 border-transparent cursor-not-allowed'
                  }`}
                >
                  {isGenerating ? (
                    <span className="flex items-center gap-2">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-zinc-400 dark:text-zinc-500" />
                      <span>{generationPhase === 'generating' ? 'Generating...' : 'Processing...'}</span>
                    </span>
                  ) : (
                    'Generate speech'
                  )}
                </button>
              </div>

            </div>

          </div>

          {/* Minimalist Floating Player that expands once audio loaded */}
          <AnimatePresence>
            {audioUrl && (
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 30 }}
                className="px-6 py-4 border-t border-zinc-200 dark:border-zinc-900 bg-zinc-50/50 dark:bg-zinc-950/50 backdrop-blur-sm flex flex-col md:flex-row items-center gap-4 justify-between shrink-0"
              >
                <div className="w-full md:w-auto flex items-center gap-3">
                  <button
                    onClick={togglePlayPause}
                    className="p-3 bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-zinc-950 rounded-full shadow transition-all cursor-pointer"
                  >
                    {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current translate-x-0.5" />}
                  </button>
                  <div className="min-w-[120px]">
                    <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200 capitalize">{currentVoiceObj.name} Voice</p>
                    <p className="text-[10px] text-zinc-500 font-medium font-mono">{formatDuration(audioCurrentTime)} / {formatDuration(audioDuration)}</p>
                  </div>
                </div>

                {/* Linear Scrubber progress */}
                <div className="flex-1 w-full flex items-center gap-3">
                  <input
                    type="range"
                    min="0"
                    max={audioDuration || 100}
                    value={audioCurrentTime}
                    onChange={handleSeek}
                    className="w-full h-1 bg-zinc-200 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-zinc-900 dark:accent-zinc-100 focus:outline-none"
                  />
                </div>

                <div className="w-full md:w-auto flex items-center justify-between md:justify-end gap-3.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-zinc-400 font-semibold uppercase">Speed:</span>
                    <select
                      value={playbackSpeed}
                      onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
                      className="bg-transparent border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900 rounded px-1.5 py-1 text-[11px] font-bold text-zinc-600 dark:text-zinc-300 outline-none"
                    >
                      <option value="0.5">0.5x</option>
                      <option value="1.0">1.0x</option>
                      <option value="1.5">1.5x</option>
                      <option value="2.0">2.0x</option>
                    </select>
                  </div>

                  <button
                    onClick={downloadAudio}
                    className="p-2 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900 text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-100 rounded-lg transition-all cursor-pointer"
                    title="Download Master Track"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

        </div>

        {/* RIGHT COLUMN: The parameter side deck separated by simple border (col-span-4) */}
        <div className="w-full lg:w-96 border-t lg:border-t-0 lg:border-l border-zinc-200 dark:border-zinc-900 bg-zinc-50/30 dark:bg-zinc-950/10 flex flex-col overflow-y-auto">
          
          {/* Section Selection Tabs exactly as requested (Settings / History) */}
          <div className="px-6 pt-5 border-b border-zinc-150 dark:border-zinc-900/60 bg-white/80 dark:bg-zinc-950/80 backdrop-blur sticky top-0 z-10">
            <div className="flex gap-6">
              <button
                onClick={() => setSidebarTab('settings')}
                className={`pb-3.5 text-xs font-semibold tracking-wide uppercase transition-all border-b-2 cursor-pointer ${
                  sidebarTab === 'settings'
                    ? 'border-zinc-900 dark:border-zinc-100 text-zinc-900 dark:text-zinc-100'
                    : 'border-transparent text-zinc-400 dark:text-zinc-600 hover:text-zinc-600 dark:hover:text-zinc-400'
                }`}
              >
                Settings
              </button>
              <button
                onClick={() => setSidebarTab('history')}
                className={`pb-3.5 text-xs font-semibold tracking-wide uppercase transition-all border-b-2 cursor-pointer ${
                  sidebarTab === 'history'
                    ? 'border-zinc-900 dark:border-zinc-100 text-zinc-900 dark:text-zinc-100'
                    : 'border-transparent text-zinc-400 dark:text-zinc-600 hover:text-zinc-600 dark:hover:text-zinc-400'
                }`}
              >
                History
              </button>
            </div>
          </div>

          <div className="p-6 flex-1 flex flex-col gap-6">
            <AnimatePresence mode="wait">
              {sidebarTab === 'settings' ? (
                <motion.div
                  key="settings"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-6"
                >
                  {/* Voice Select Block */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block">Voice</label>
                    <div className="relative" ref={dropdownRef}>
                      <button
                        type="button"
                        onClick={() => setShowVoiceDropdown(!showVoiceDropdown)}
                        className="w-full bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg p-3.5 flex items-center justify-between text-xs font-semibold text-zinc-800 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-all cursor-pointer"
                      >
                        <span className="flex items-center gap-2">
                          <span className="h-1.5 w-1.5 rounded-full bg-zinc-500 dark:bg-zinc-400" />
                          {currentVoiceObj.name} - {currentVoiceObj.personality}
                        </span>
                        <ChevronDown className={`w-4 h-4 text-zinc-400 dark:text-zinc-600 transition-transform duration-200 ${showVoiceDropdown ? 'rotate-180' : ''}`} />
                      </button>

                      {/* Floating list dropdown for voice profile options */}
                      {showVoiceDropdown && (
                        <div className="absolute top-[calc(100%+6px)] left-0 right-0 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-xl py-1.5 z-30 max-h-64 overflow-y-auto">
                          {VOICE_OPTIONS.map((voice) => {
                            const isChosen = voice.id === selectedVoice;
                            return (
                              <div
                                key={voice.id}
                                onClick={() => {
                                  setSelectedVoice(voice.id);
                                  setShowVoiceDropdown(false);
                                }}
                                className="px-3.5 py-2.5 hover:bg-zinc-50 dark:hover:bg-zinc-900 text-xs text-zinc-700 dark:text-zinc-300 flex items-center justify-between cursor-pointer"
                              >
                                <div className="space-y-0.5 min-w-0 pr-4">
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-zinc-900 dark:text-zinc-100">{voice.name}</span>
                                    <span className="text-[10px] text-zinc-400 dark:text-zinc-550 font-medium font-mono">({voice.gender})</span>
                                  </div>
                                  <p className="text-[10px] text-zinc-400 dark:text-zinc-500 truncate">{voice.personality}</p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      playVoicePreview(voice.id);
                                    }}
                                    className="p-1.5 border border-zinc-200 dark:border-zinc-800 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-500 dark:text-zinc-450 hover:text-zinc-800 dark:hover:text-zinc-100 transition-all cursor-pointer flex items-center justify-center"
                                    title="Listen to voice sample"
                                  >
                                    <Play className="w-2.5 h-2.5 fill-current translate-x-[0.5px]" />
                                  </button>
                                  {isChosen && <Check className="w-3.5 h-3.5 text-zinc-900 dark:text-zinc-100" />}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Selected voice profile descriptive notes */}
                    <div className="p-3.5 bg-zinc-50/50 dark:bg-zinc-950/50 border border-zinc-200/50 dark:border-zinc-900/50 rounded-lg">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-550 uppercase tracking-wider">{currentVoiceObj.name} Bio</span>
                        <button
                          type="button"
                          onClick={() => playVoicePreview(currentVoiceObj.id)}
                          className="px-2 py-1 rounded border border-zinc-200 dark:border-zinc-800 hover:bg-white dark:hover:bg-zinc-900 text-[10px] font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-all flex items-center gap-1.5 cursor-pointer"
                          title="Audition voice preview"
                        >
                          <Play className="w-2.5 h-2.5 fill-current translate-x-[0.5px]" />
                          <span>Audition</span>
                        </button>
                      </div>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed font-medium">{currentVoiceObj.desc}</p>
                    </div>
                  </div>

                  {/* Model Select Block */}
                  <div className="space-y-2 pt-2">
                    <label className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block">Model</label>
                    <div className="relative" ref={modelDropdownRef}>
                      <button
                        type="button"
                        onClick={() => setShowModelDropdown(!showModelDropdown)}
                        className="w-full bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg p-3.5 flex items-center justify-between text-xs font-semibold text-zinc-800 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-all cursor-pointer"
                      >
                        <span className="flex items-center gap-2">
                          <span className="text-[10px] font-bold px-1.5 py-0.5 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 rounded font-mono">v1</span>
                          {currentModelObj.name}
                        </span>
                        <ChevronDown className={`w-4 h-4 text-zinc-400 dark:text-zinc-600 transition-transform duration-200 ${showModelDropdown ? 'rotate-180' : ''}`} />
                      </button>

                      {showModelDropdown && (
                        <div className="absolute top-[calc(100%+6px)] left-0 right-0 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-xl py-1.5 z-30">
                          {MODEL_OPTIONS.map((opt) => {
                            const isChosen = opt.id === selectedModel;
                            return (
                              <div
                                key={opt.id}
                                onClick={() => {
                                  setSelectedModel(opt.id);
                                  setShowModelDropdown(false);
                                }}
                                className="px-3.5 py-2.5 hover:bg-zinc-50 dark:hover:bg-zinc-900 text-xs text-zinc-700 dark:text-zinc-300 flex items-center justify-between cursor-pointer"
                              >
                                <div className="space-y-0.5">
                                  <div className="font-bold text-zinc-900 dark:text-zinc-100">{opt.name}</div>
                                  <p className="text-[10px] text-zinc-400 dark:text-zinc-500">{opt.desc}</p>
                                </div>
                                {isChosen && <Check className="w-3.5 h-3.5 text-zinc-900 dark:text-zinc-100" />}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Gradient Info Badge under selected model exactly like image */}
                    <div className="relative overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-900/80 bg-zinc-50 dark:bg-zinc-950/40 p-3.5 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
                      <div className="space-y-0.5">
                        <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest block">Pro Engine Options</span>
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-normal font-medium">Render maximum high-fidelity audio spectrum outputs.</p>
                      </div>
                      {onUpgradeClick && !unlimitedGenerations && (
                        <button
                          onClick={onUpgradeClick}
                          className="px-2.5 py-1 text-[10px] font-semibold text-zinc-900 dark:text-zinc-100 border border-zinc-300 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded bg-white dark:bg-zinc-950 cursor-pointer select-none"
                        >
                          Unlock HD
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Range Faders */}
                  <div className="space-y-5 pt-3 border-t border-zinc-150 dark:border-zinc-900/60">
                    
                    {/* Speed Slider */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block">Speed</span>
                        <span className="text-xs font-mono font-medium text-zinc-500 dark:text-zinc-400">{speed.toFixed(2)}x</span>
                      </div>
                      <input
                        type="range"
                        min="0.25"
                        max="4.0"
                        step="0.05"
                        value={speed}
                        onChange={(e) => setSpeed(Number(e.target.value))}
                        className="w-full h-1 bg-zinc-200 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-zinc-900 dark:accent-zinc-100 focus:outline-none"
                      />
                      <div className="flex justify-between text-[10px] text-zinc-400 dark:text-zinc-650 font-medium">
                        <span>Slower</span>
                        <span>Faster</span>
                      </div>
                    </div>

                    {/* Stability Slider */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block">Stability</span>
                        <span className="text-xs font-mono font-medium text-zinc-500 dark:text-zinc-400">{Math.round(stability * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min="0.1"
                        max="1.0"
                        step="0.05"
                        value={stability}
                        onChange={(e) => setStability(Number(e.target.value))}
                        className="w-full h-1 bg-zinc-200 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-zinc-900 dark:accent-zinc-100 focus:outline-none"
                      />
                      <div className="flex justify-between text-[10px] text-zinc-400 dark:text-zinc-650 font-medium">
                        <span>More variable</span>
                        <span>More stable</span>
                      </div>
                    </div>

                    {/* Similarity Slider */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block">Clarity / Similarity</span>
                        <span className="text-xs font-mono font-medium text-zinc-500 dark:text-zinc-400">{Math.round(similarity * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min="0.1"
                        max="1.0"
                        step="0.05"
                        value={similarity}
                        onChange={(e) => setSimilarity(Number(e.target.value))}
                        className="w-full h-1 bg-zinc-200 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-zinc-900 dark:accent-zinc-100 focus:outline-none"
                      />
                      <div className="flex justify-between text-[10px] text-zinc-400 dark:text-zinc-650 font-medium">
                        <span>Low</span>
                        <span>High</span>
                      </div>
                    </div>

                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="history"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-3.5"
                >
                  {history.length === 0 ? (
                    <div className="py-12 text-center text-xs text-zinc-400 dark:text-zinc-600 font-medium">
                      No previous speech files rendered.
                    </div>
                  ) : (
                    <div className="space-y-2.5 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
                      {history.map((item) => {
                        const isActive = activeHistoryId === item.id;
                        const formattedTime = new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                        return (
                          <div
                            key={item.id}
                            className={`p-3 rounded-lg border flex items-center justify-between gap-3 text-xs transition-all ${
                              isActive
                                ? 'bg-zinc-50 dark:bg-zinc-900/60 border-zinc-300 dark:border-zinc-800'
                                : 'bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-900'
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 mb-1.5">
                                <span className="font-bold text-zinc-800 dark:text-zinc-200 capitalize text-[11px]">
                                  {item.selected_voice}
                                </span>
                                <span className="text-[9px] font-mono text-zinc-400 dark:text-zinc-650 px-1 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 rounded">
                                  {item.selected_model === 'tts-1-hd' ? 'HD' : 'SD'}
                                </span>
                              </div>
                              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate leading-relaxed">
                                "{item.text_snippet}"
                              </p>
                              <div className="flex gap-2 mt-1 text-[10px] text-zinc-400 dark:text-zinc-600 font-mono">
                                <span>{item.character_count} chars</span>
                                <span>•</span>
                                <span>{formattedTime}</span>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => playHistoryAudioItem(item)}
                              className={`p-2 rounded-lg border shrink-0 transition-all cursor-pointer ${
                                isActive && isPlaying
                                  ? 'bg-zinc-900 text-white border-transparent'
                                  : 'bg-white dark:bg-zinc-950 border-zinc-250 dark:border-zinc-850 text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
                              }`}
                            >
                              {isActive && isPlaying ? (
                                <Pause className="w-3.5 h-3.5 fill-current" />
                              ) : (
                                <Play className="w-3.5 h-3.5 fill-current translate-x-0.5" />
                              )}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

        </div>

      </div>
    </div>
  );
};
