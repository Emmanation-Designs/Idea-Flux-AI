import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, 
  Pause, 
  Download, 
  Volume2, 
  Sparkles, 
  RefreshCw, 
  Trash2, 
  Clipboard, 
  Clock, 
  Sliders, 
  AlertCircle, 
  CheckCircle2, 
  Mic, 
  SlidersHorizontal,
  ChevronRight,
  Info,
  Radio,
  Sliders as SlidersIcon,
  HelpCircle,
  FileText,
  RotateCcw,
  Compass,
  ArrowRight
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

const SCRIPT_TEMPLATES = [
  {
    label: "🎙️ Podcast Intro",
    text: "Welcome back to another mind-bending episode of Trelvix Insights. Today, we are diving deep into the neural architectures of modern synthetic speech, exploring how real-time intelligence is transforming human connections across the digital landscape."
  },
  {
    label: "📺 Video Essay",
    text: "In the quiet corners of technological evolution, a silent revolution was taking place. Not with a bang, but with a whisper. A whisper that learned to speak, to narrate, and ultimately, to understand our human story."
  },
  {
    label: "⚡ Cyberpunk Hype",
    text: "System status: online. Core neural network: active. Welcome to Trelvix Voice Synthesis Matrix. Prepare your mind for complete sensory override. Commencing voice telemetry stream in three, two, one..."
  },
  {
    label: "📱 App Tour Guide",
    text: "Hi there! I will be your personalized voice assistant throughout this application tour. Feel free to customize my reading speed, selected acoustic model, and overall tone of delivery to perfectly match your workspace."
  }
];

const VOICE_OPTIONS = [
  { 
    id: 'alloy', 
    name: 'Alloy', 
    gender: 'Neutral', 
    personality: 'Versatile, balanced & natural', 
    desc: 'Perfect for long audiobooks, documentaries, and clear general voiceovers.',
    color: '#10b981', // Emerald
    accentBg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:border-emerald-500/40',
    dotColor: 'bg-emerald-500',
    waveStyle: 'animate-[pulse_1.2s_infinite]'
  },
  { 
    id: 'echo', 
    name: 'Echo', 
    gender: 'Male', 
    personality: 'Warm, natural & authoritative', 
    desc: 'Great for high-reach podcasts, dynamic presentations, and video tutorials.',
    color: '#f59e0b', // Amber
    accentBg: 'bg-amber-500/10 text-amber-400 border-amber-500/20 hover:border-amber-500/40',
    dotColor: 'bg-amber-500',
    waveStyle: 'animate-[pulse_1s_infinite]'
  },
  { 
    id: 'fable', 
    name: 'Fable', 
    gender: 'Neutral', 
    personality: 'Expressive, dramatic & storytelling', 
    desc: 'Ideal for engaging storytelling, high-energy advertisements, and narration.',
    color: '#8b5cf6', // Violet
    accentBg: 'bg-violet-500/10 text-violet-400 border-violet-500/20 hover:border-violet-500/40',
    dotColor: 'bg-violet-500',
    waveStyle: 'animate-[pulse_1.5s_infinite]'
  },
  { 
    id: 'onyx', 
    name: 'Onyx', 
    gender: 'Male', 
    personality: 'Deep, confident & professional', 
    desc: 'Excellent for corporate announcements, serious narrations, and luxury branding.',
    color: '#06b6d4', // Cyan
    accentBg: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20 hover:border-cyan-500/40',
    dotColor: 'bg-cyan-500',
    waveStyle: 'animate-[pulse_0.8s_infinite]'
  },
  { 
    id: 'nova', 
    name: 'Nova', 
    gender: 'Female', 
    personality: 'Energetic, bright & friendly', 
    desc: 'Best for cheerful explainers, product announcements, and learning content.',
    color: '#ec4899', // Pink
    accentBg: 'bg-pink-500/10 text-pink-400 border-pink-500/20 hover:border-pink-500/40',
    dotColor: 'bg-pink-500',
    waveStyle: 'animate-[pulse_1.1s_infinite]'
  },
  { 
    id: 'shimmer', 
    name: 'Shimmer', 
    gender: 'Female', 
    personality: 'Professional, clear & confident', 
    desc: 'Recommended for AI assistants, customer training, and corporate explainers.',
    color: '#3b82f6', // Blue
    accentBg: 'bg-blue-500/10 text-blue-400 border-blue-500/20 hover:border-blue-500/40',
    dotColor: 'bg-blue-500',
    waveStyle: 'animate-[pulse_1.3s_infinite]'
  }
];

const MODEL_OPTIONS = [
  { id: 'tts-1', name: 'Standard Latency (tts-1)', desc: 'Lowest generation latency, optimized for rapid, real-time feedback loops.' },
  { id: 'tts-1-hd', name: 'Studio HD Quality (tts-1-hd)', desc: 'Maximum fidelity audio spectrum with rich textures and deep dynamic ranges.' }
];

export const TextToSpeechView = ({ profile, onUpgradeClick, onBack }: TextToSpeechViewProps) => {
  // Local storage state keys
  const STORAGE_KEY_VOICE = 'trelvix_tts_voice';
  const STORAGE_KEY_SPEED = 'trelvix_tts_speed';
  const STORAGE_KEY_MODEL = 'trelvix_tts_model';

  // State values with default fallback & local storage retrieval
  const [text, setText] = useState('');
  const [selectedVoice, setSelectedVoice] = useState(() => localStorage.getItem(STORAGE_KEY_VOICE) || 'alloy');
  const [speed, setSpeed] = useState(() => Number(localStorage.getItem(STORAGE_KEY_SPEED)) || 1.0);
  const [selectedModel, setSelectedModel] = useState(() => localStorage.getItem(STORAGE_KEY_MODEL) || 'tts-1');
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationPhase, setGenerationPhase] = useState<'preparing' | 'generating' | 'optimizing' | 'finalizing' | null>(null);
  
  // Usage/Quota States
  const [generationsToday, setGenerationsToday] = useState(0);
  const [maxGenerationsToday, setMaxGenerationsToday] = useState(3);
  const [maxCharactersPerGen, setMaxCharactersPerGen] = useState(2000);
  const [unlimitedGenerations, setUnlimitedGenerations] = useState(false);
  const [isLoadingLimits, setIsLoadingLimits] = useState(true);

  // Audio Player States
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioDuration, setAudioDuration] = useState(0);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);

  // Generation History state
  const [history, setHistory] = useState<TTSHistoryItem[]>([]);
  const [activeHistoryId, setActiveHistoryId] = useState<string | null>(null);

  // Active view tabs for the Left panel to declutter screen
  const [activeTab, setActiveTab] = useState<'script' | 'settings'>('script');

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const activeVoiceInfo = VOICE_OPTIONS.find(v => v.id === selectedVoice) || VOICE_OPTIONS[0];

  // Save changes to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_VOICE, selectedVoice);
  }, [selectedVoice]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_SPEED, String(speed));
  }, [speed]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_MODEL, selectedModel);
  }, [selectedModel]);

  // Fetch usage quotas and limit metadata
  const fetchUsageLimitsAndHistory = async () => {
    if (!profile?.id) return;
    try {
      setIsLoadingLimits(true);
      // Fetch dynamic plan limits
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

      // Fetch daily count using the helper function
      const { data: usageFunc, error: usageErr } = await supabase
        .rpc('get_today_tts_usage', { user_uuid: profile.id });

      if (!usageErr && usageFunc && usageFunc.length > 0) {
        setGenerationsToday(usageFunc[0].generations_today || 0);
      }

      // Fetch user generation history (recent 10 items)
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
          text_snippet: h.metadata?.text_snippet || 'Text-to-Speech clip'
        }));
        setHistory(mapped);
      }
    } catch (err) {
      console.error('Error fetching TTS metadata:', err);
    } finally {
      setIsLoadingLimits(false);
    }
  };

  useEffect(() => {
    fetchUsageLimitsAndHistory();
  }, [profile?.id, profile?.plan]);

  // Audio Player Event Listeners
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

  // Update playback speed on actual HTML5 audio ref
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackSpeed;
    }
  }, [playbackSpeed, audioUrl]);

  // Word and Duration Estimates
  const wordCount = text.trim() === '' ? 0 : text.trim().split(/\s+/).length;
  // Standard speaking rate: ~140 words per minute -> ~2.33 words per second
  const estimatedSeconds = Math.round((wordCount / 140) * 60) || 0;

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Quick Action Utilities
  const handlePaste = async () => {
    try {
      const clipboardText = await navigator.clipboard.readText();
      if (clipboardText) {
        setText(prev => (prev + ' ' + clipboardText).trim());
        toast.success('Script loaded from clipboard');
      }
    } catch (err) {
      toast.error('Failed to read clipboard data');
    }
  };

  const handleClear = () => {
    setText('');
    toast.info('Script cleared');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault();
      handleGenerate();
    }
  };

  // Play voice preview
  const playVoicePreview = (voiceId: string) => {
    toast.info(`Auditioning voice: ${voiceId}`);
    const utterance = new SpeechSynthesisUtterance(`Hi there, I am ${voiceId}. This is a direct test of my synthetic vocal contour. Enjoy the show!`);
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

  // Generate speech API execution
  const handleGenerate = async () => {
    if (!text.trim()) {
      toast.error('Please enter or select a speech script first.');
      return;
    }

    if (text.length > maxCharactersPerGen) {
      toast.error(`Character count of ${text.length} exceeds limit of ${maxCharactersPerGen}.`);
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
      await new Promise(r => setTimeout(r, 600));

      const { data: sessionData } = await supabase.auth.getSession();
      const sessionToken = sessionData?.session?.access_token;

      if (!sessionToken) {
        throw new Error('Authentication required. Please sign in first.');
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
        throw new Error(errorData.error || `Failed to synthesize audio (Status: ${response.status})`);
      }

      setGenerationPhase('optimizing');
      const audioBlob = await response.blob();
      const generatedAudioUrl = URL.createObjectURL(audioBlob);

      setGenerationPhase('finalizing');
      await new Promise(r => setTimeout(r, 400));

      setAudioUrl(generatedAudioUrl);
      toast.success('Acoustic synthesis complete!');
      
      fetchUsageLimitsAndHistory();
    } catch (err: any) {
      console.error('[TTS Error]:', err);
      toast.error(err.message || 'An unexpected error occurred during synthesis.');
    } finally {
      setIsGenerating(false);
      setGenerationPhase(null);
    }
  };

  // Play audio item from history list
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
      toast.loading('Streaming track from database...', { id: 'history-fetch' });
      const { data: sessionData } = await supabase.auth.getSession();
      const sessionToken = sessionData?.session?.access_token;

      if (!sessionToken) throw new Error('Authentication required');

      const response = await fetch(`/api/tools/text-to-speech/retrieve/${item.id}`, {
        headers: {
          'Authorization': `Bearer ${sessionToken}`
        }
      });

      if (!response.ok) {
        throw new Error('Target audio binary could not be found.');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      
      setAudioUrl(url);
      setActiveHistoryId(item.id);
      setIsPlaying(true);
      
      setTimeout(() => {
        audioRef.current?.play().catch(console.error);
      }, 100);

      toast.success('Loaded track successfully!', { id: 'history-fetch' });
    } catch (err: any) {
      toast.error(err.message || 'Failed to retrieve audio track.', { id: 'history-fetch' });
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
    const dateStr = new Date().toISOString().replace(/T/, '-').replace(/\..+/, '').replace(/:/g, '');
    const filename = `trelvix-synthesis-${dateStr}.mp3`;
    
    const a = document.createElement('a');
    a.href = audioUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success('Downloading Master Audio MP3...');
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-zinc-950 text-zinc-100 overflow-y-auto selection:bg-rose-500/30">
      {/* Hidden HTML5 Player */}
      {audioUrl && <audio ref={audioRef} src={audioUrl} />}

      {/* Futuristic Ambient Backdrop */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(244,63,94,0.06),transparent_60%)] pointer-events-none" />

      {/* Top Professional Header Deck */}
      <div className="px-6 py-5 md:px-10 border-b border-zinc-900 bg-zinc-950/80 backdrop-blur sticky top-0 z-20 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="p-2.5 rounded-xl border border-zinc-900 bg-zinc-900/30 hover:bg-zinc-900 text-zinc-400 hover:text-zinc-100 transition-all flex items-center justify-center shrink-0"
          >
            <ChevronRight className="w-5 h-5 rotate-180" />
          </button>
          <div className="space-y-0.5">
            <div className="flex items-center gap-2.5">
              <span className="h-2 w-2 rounded-full bg-rose-500 animate-ping shrink-0" />
              <h2 className="text-lg font-black tracking-tight text-zinc-100 uppercase">Acoustic Forge</h2>
              <span className="text-[10px] font-mono bg-zinc-900 text-zinc-400 border border-zinc-800 px-2 py-0.5 rounded-md">
                v2.0 Beta
              </span>
            </div>
            <p className="text-xs text-zinc-400 font-medium">Professional-grade neural wave generators.</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Daily Meter */}
          <div className="hidden md:flex items-center gap-3 px-3.5 py-1.5 rounded-xl bg-zinc-900/40 border border-zinc-850">
            <Radio className="w-3.5 h-3.5 text-rose-500 animate-pulse" />
            <div className="text-[11px] font-bold">
              {isLoadingLimits ? (
                <span className="text-zinc-500">Checking quota...</span>
              ) : unlimitedGenerations ? (
                <span className="text-rose-400 uppercase tracking-wider font-mono text-[10px]">Unlimited Plan</span>
              ) : (
                <span className="text-zinc-300 font-mono">
                  Quota: <strong className="text-rose-400">{generationsToday}</strong> / {maxGenerationsToday}
                </span>
              )}
            </div>
          </div>
          {onUpgradeClick && !unlimitedGenerations && (
            <button
              onClick={onUpgradeClick}
              className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-rose-500 to-amber-500 hover:from-rose-400 hover:to-amber-400 text-white text-xs font-black uppercase tracking-wider shadow-lg shadow-rose-500/10 transition-all cursor-pointer"
            >
              Upgrade
            </button>
          )}
        </div>
      </div>

      {/* Main Studio Workbench Area */}
      <div className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-8 lg:p-10 grid grid-cols-1 lg:grid-cols-12 gap-8 relative z-10">
        
        {/* LEFT COLUMN: Controls & Scripting Engine (7 cols) */}
        <div className="lg:col-span-7 flex flex-col gap-6">

          {/* Overhauled Navigation Tabs */}
          <div className="bg-zinc-900/30 p-1.5 border border-zinc-850 rounded-2xl flex items-center justify-between shrink-0">
            <div className="flex items-center gap-1.5 w-full">
              <button
                type="button"
                onClick={() => setActiveTab('script')}
                className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  activeTab === 'script'
                    ? 'bg-zinc-850 border border-zinc-800 text-zinc-100 shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <FileText className="w-4 h-4" />
                Scripting Desk
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('settings')}
                className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  activeTab === 'settings'
                    ? 'bg-zinc-850 border border-zinc-800 text-zinc-100 shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <SlidersIcon className="w-4 h-4" />
                Acoustic Forge Settings
              </button>
            </div>
          </div>

          <AnimatePresence mode="wait">
            {activeTab === 'script' ? (
              <motion.div
                key="script-desk"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col gap-6"
              >
                {/* Visual Scripting Board */}
                <div className="bg-zinc-900/40 border border-zinc-850 rounded-3xl p-6 flex flex-col gap-5 relative">
                  
                  {/* Glowing corners to mimic futuristic workspace */}
                  <div className="absolute top-0 left-0 w-8 h-8 border-t border-l border-rose-500/35 rounded-tl-3xl pointer-events-none" />
                  <div className="absolute bottom-0 right-0 w-8 h-8 border-b border-r border-rose-500/35 rounded-br-3xl pointer-events-none" />

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="p-1 rounded-lg bg-rose-500/10 text-rose-400">
                        <FileText className="w-3.5 h-3.5" />
                      </span>
                      <span className="text-xs font-black uppercase tracking-widest text-zinc-300">Speech Draft Script</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handlePaste}
                        className="px-3 py-1.5 rounded-xl bg-zinc-950/80 hover:bg-zinc-900 border border-zinc-800 text-zinc-350 text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-all cursor-pointer"
                      >
                        <Clipboard className="w-3.5 h-3.5 text-zinc-450" />
                        Load Paste
                      </button>
                      <button
                        type="button"
                        onClick={handleClear}
                        className="px-3 py-1.5 rounded-xl bg-zinc-950/80 hover:bg-zinc-900 border border-zinc-800 text-zinc-450 hover:text-rose-400 text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-all cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Flush
                      </button>
                    </div>
                  </div>

                  <div className="relative">
                    <textarea
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      onKeyDown={handleKeyPress}
                      placeholder="Input transcript scripts here... Choose prompt templates below to seed instantly. Press Ctrl+Enter to synthesis."
                      maxLength={maxCharactersPerGen}
                      className="w-full h-72 bg-zinc-950/70 border border-zinc-850 focus:border-rose-500/35 rounded-2xl p-5 text-sm text-zinc-200 placeholder:text-zinc-650 focus:outline-none focus:ring-1 focus:ring-rose-500/10 resize-none transition-all leading-relaxed font-sans"
                    />
                    <div className="absolute bottom-4 right-4 text-[10px] font-mono text-zinc-500 bg-zinc-950 px-2.5 py-1 border border-zinc-900 rounded-md">
                      {text.length} / {maxCharactersPerGen}
                    </div>
                  </div>

                  {/* Character stats footer */}
                  <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-zinc-400 pt-2 border-t border-zinc-900/60">
                    <div className="flex items-center gap-4">
                      <span>
                        Words Count: <strong className="text-zinc-200">{wordCount}</strong>
                      </span>
                      <span>
                        Estimated Speaking Run: <strong className="text-rose-400 font-mono">{formatDuration(estimatedSeconds)}</strong>
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-zinc-500">
                      Standard speech: ~140 words/min
                    </span>
                  </div>
                </div>

                {/* Aesthetic Prompt Seed Library */}
                <div className="bg-zinc-900/20 border border-zinc-850/60 rounded-3xl p-5 flex flex-col gap-3">
                  <div className="flex items-center gap-1.5">
                    <Compass className="w-3.5 h-3.5 text-zinc-450 animate-spin-slow" />
                    <h3 className="text-xs font-black uppercase tracking-widest text-zinc-400">Pre-Configured Template Scripts</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    {SCRIPT_TEMPLATES.map((tmpl) => (
                      <button
                        key={tmpl.label}
                        type="button"
                        onClick={() => {
                          setText(tmpl.text);
                          toast.success(`Loaded ${tmpl.label} Template!`);
                        }}
                        className="p-3 text-left bg-zinc-950/40 hover:bg-zinc-900/60 border border-zinc-900 hover:border-zinc-800 rounded-xl text-xs font-bold transition-all text-zinc-300 hover:text-white flex items-center justify-between group cursor-pointer"
                      >
                        <span>{tmpl.label}</span>
                        <ArrowRight className="w-3.5 h-3.5 text-zinc-650 group-hover:text-rose-500 group-hover:translate-x-0.5 transition-all" />
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="forge-settings"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col gap-6"
              >
                {/* Tuning Board */}
                <div className="bg-zinc-900/40 border border-zinc-850 rounded-3xl p-6 flex flex-col gap-6 relative">
                  <div className="absolute top-0 left-0 w-8 h-8 border-t border-l border-zinc-700/35 rounded-tl-3xl pointer-events-none" />
                  
                  <div className="flex items-center gap-2">
                    <SlidersHorizontal className="w-4 h-4 text-zinc-450" />
                    <h3 className="text-xs font-black uppercase tracking-widest text-zinc-300">Advanced Accoustics Engine</h3>
                  </div>

                  <div className="space-y-6">
                    {/* Speed rate custom dial */}
                    <div className="space-y-3 p-4 bg-zinc-950/50 border border-zinc-850 rounded-2xl">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <span className="text-xs font-black uppercase tracking-wider text-zinc-200">Speaking Velocity Speed</span>
                          <p className="text-[10px] text-zinc-500">Fine-tune the acceleration and speaking tempo of the synthetic voice.</p>
                        </div>
                        <span className="text-xs font-mono font-bold text-rose-400 bg-rose-500/10 px-2.5 py-1 rounded-lg border border-rose-500/20">
                          {speed.toFixed(2)}x
                        </span>
                      </div>
                      <div className="flex items-center gap-4 py-2">
                        <input
                          type="range"
                          min="0.25"
                          max="4.0"
                          step="0.05"
                          value={speed}
                          onChange={(e) => setSpeed(Number(e.target.value))}
                          className="w-full h-1 bg-zinc-900 rounded-lg appearance-none cursor-pointer accent-rose-500"
                        />
                      </div>
                      <div className="flex justify-between text-[9px] font-bold text-zinc-500 tracking-wider">
                        <span>Adagio (0.25x)</span>
                        <span>Moderato (1.0x)</span>
                        <span>Presto (4.0x)</span>
                      </div>
                    </div>

                    {/* Speech engine precision select */}
                    <div className="space-y-3 p-4 bg-zinc-950/50 border border-zinc-850 rounded-2xl">
                      <div className="space-y-0.5">
                        <span className="text-xs font-black uppercase tracking-wider text-zinc-200">Neural Model Architecture</span>
                        <p className="text-[10px] text-zinc-500">Select standard real-time synthesis or high-fidelity master recording models.</p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                        {MODEL_OPTIONS.map((opt) => {
                          const isSelected = selectedModel === opt.id;
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => setSelectedModel(opt.id)}
                              className={`p-3.5 rounded-xl text-left border transition-all duration-300 flex flex-col gap-1.5 cursor-pointer ${
                                isSelected
                                  ? 'bg-rose-950/15 border-rose-500/40 text-zinc-100 shadow-sm'
                                  : 'bg-zinc-950/80 border-zinc-900 hover:border-zinc-850 text-zinc-400'
                              }`}
                            >
                              <span className={`text-xs font-black uppercase tracking-wider ${isSelected ? 'text-rose-400' : 'text-zinc-300'}`}>
                                {opt.name}
                              </span>
                              <p className="text-[10px] text-zinc-500 leading-normal">{opt.desc}</p>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Dynamic Core Trigger Studio block */}
          <div className="flex flex-col gap-3">
            <button
              onClick={handleGenerate}
              disabled={isGenerating || !text.trim()}
              className={`w-full py-4.5 rounded-3xl font-black uppercase tracking-[0.2em] text-xs transition-all duration-300 flex items-center justify-center gap-3 border cursor-pointer ${
                isGenerating
                  ? 'bg-zinc-900 border-zinc-850 text-zinc-500 cursor-not-allowed'
                  : text.trim()
                    ? 'bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 border-rose-500/20 text-white shadow-xl hover:shadow-rose-600/15 active:scale-[0.99] hover:-translate-y-[1px]'
                    : 'bg-zinc-900/60 border-zinc-850/60 text-zinc-650 cursor-not-allowed'
              }`}
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-rose-400" />
                  <span className="animate-pulse tracking-[0.1em] font-mono">
                    {generationPhase === 'preparing' && 'Configuring channels...'}
                    {generationPhase === 'generating' && 'Synthesizing voice waves...'}
                    {generationPhase === 'optimizing' && 'Harmonizing acoustic frequency...'}
                    {generationPhase === 'finalizing' && 'Rendering master track...'}
                    {!generationPhase && 'Generating speech files...'}
                  </span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-rose-300 group-hover:scale-110 transition-transform" />
                  Initiate Synthesize Sequence
                </>
              )}
            </button>
            
            {/* Live active configuration footer strip */}
            <div className="px-4 py-2.5 bg-zinc-900/15 border border-zinc-850/50 rounded-2xl flex items-center justify-between text-[11px] text-zinc-400">
              <span className="flex items-center gap-1.5 font-bold">
                <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                Active Contour: <strong className="text-zinc-200 capitalize">{activeVoiceInfo.name}</strong>
              </span>
              <span>•</span>
              <span className="font-mono">Speed: {speed.toFixed(2)}x</span>
              <span>•</span>
              <span className="font-mono text-[10px] uppercase">{selectedModel}</span>
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: The Immersive DAW Synthesizer Mixer & Tape Reels (5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          
          {/* Audio Console Module */}
          <div className="bg-zinc-900/40 border border-zinc-850 rounded-3xl p-6 flex flex-col gap-5 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/5 rounded-full blur-2xl pointer-events-none" />

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-rose-500 shrink-0" />
                <h3 className="text-xs font-black uppercase tracking-widest text-zinc-300">Synthesizer Monitor</h3>
              </div>
              <span className="text-[10px] font-mono text-zinc-500">DAW Output</span>
            </div>

            {/* Immersive Sound stage Visualizer */}
            <div className="bg-zinc-950/80 border border-zinc-850/80 rounded-2xl p-6 flex flex-col items-center justify-center min-h-[220px] text-center relative overflow-hidden shadow-inner">
              <AnimatePresence mode="wait">
                {isGenerating ? (
                  <motion.div
                    key="gen"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="flex flex-col items-center gap-4"
                  >
                    {/* Morphing visual circular sound wave radar */}
                    <div className="relative w-24 h-24 flex items-center justify-center">
                      <div className="absolute inset-0 rounded-full border border-rose-500/10 animate-[ping_2s_infinite]" />
                      <div className="absolute inset-2 rounded-full border border-rose-500/20 animate-[ping_1.5s_infinite_200ms]" />
                      <div className="absolute inset-4 rounded-full border border-rose-500/30 animate-[ping_1.2s_infinite_400ms]" />
                      <div className="w-10 h-10 rounded-full bg-rose-500/10 border border-rose-500/40 flex items-center justify-center">
                        <RefreshCw className="w-5 h-5 text-rose-400 animate-spin" />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-rose-400">Synthesis active</span>
                      <p className="text-[10px] text-zinc-500">Mapping neural contours...</p>
                    </div>
                  </motion.div>
                ) : audioUrl ? (
                  <motion.div
                    key="player"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="w-full flex flex-col gap-6"
                  >
                    {/* Elegant frequency waveform indicator */}
                    <div className="flex items-center justify-between gap-0.5 h-16 px-4 bg-zinc-900/30 rounded-xl border border-zinc-850/30">
                      {Array.from({ length: 28 }).map((_, idx) => {
                        const h = isPlaying 
                          ? Math.floor(Math.random() * 32) + 8 
                          : 4;
                        return (
                          <div
                            key={idx}
                            style={{ height: `${h}px` }}
                            className={`w-1 rounded-full transition-all duration-300 ${
                              isPlaying ? 'bg-gradient-to-t from-rose-500 to-rose-400' : 'bg-zinc-800'
                            }`}
                          />
                        );
                      })}
                    </div>

                    {/* Playback timeline rail */}
                    <div className="space-y-1.5">
                      <input
                        type="range"
                        min="0"
                        max={audioDuration || 100}
                        value={audioCurrentTime}
                        onChange={handleSeek}
                        className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-rose-500 focus:outline-none"
                      />
                      <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500">
                        <span>{formatDuration(audioCurrentTime)}</span>
                        <span>{formatDuration(audioDuration)}</span>
                      </div>
                    </div>

                    {/* Synthesis Master Control Board */}
                    <div className="flex items-center justify-between gap-4">
                      {/* Playback Speed contour fader */}
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500 font-mono">Rate:</span>
                        <select
                          value={playbackSpeed}
                          onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
                          className="bg-zinc-900 border border-zinc-850 rounded-lg py-1 px-2 text-[10px] font-bold text-zinc-300 outline-none"
                        >
                          <option value="0.5">0.5x</option>
                          <option value="0.8">0.8x</option>
                          <option value="1.0">1.0x</option>
                          <option value="1.2">1.2x</option>
                          <option value="1.5">1.5x</option>
                          <option value="2.0">2.0x</option>
                        </select>
                      </div>

                      {/* Main Power trigger button */}
                      <button
                        onClick={togglePlayPause}
                        className="p-4 bg-rose-600 hover:bg-rose-500 rounded-full text-white shadow-xl shadow-rose-600/10 hover:shadow-rose-500/20 active:scale-95 transition-all cursor-pointer border border-rose-500/20"
                      >
                        {isPlaying ? (
                          <Pause className="w-5 h-5 fill-white" />
                        ) : (
                          <Play className="w-5 h-5 fill-white translate-x-0.5" />
                        )}
                      </button>

                      {/* Download Master Tape */}
                      <button
                        onClick={downloadAudio}
                        title="Download MP3 master track"
                        className="p-2.5 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 rounded-xl text-zinc-300 hover:text-white transition-all cursor-pointer"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col items-center gap-4"
                  >
                    <div className="w-14 h-14 rounded-full bg-zinc-900 border border-zinc-850 flex items-center justify-center text-zinc-500">
                      <Volume2 className="w-6 h-6 text-zinc-600" />
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] font-black uppercase tracking-[0.15em] text-zinc-500">Monitor stands ready</span>
                      <p className="text-[10px] text-zinc-600 max-w-xs leading-normal">
                        Configure voice contours, type scripts, then ignite acoustic rendering.
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Mixing deck of Tactical Audio Channels (Voice Selector) */}
          <div className="bg-zinc-900/40 border border-zinc-850 rounded-3xl p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-rose-500 shrink-0 animate-pulse" />
                <h3 className="text-xs font-black uppercase tracking-widest text-zinc-300">Channel Audio Strips</h3>
              </div>
              <span className="text-[10px] font-mono text-zinc-500">Select Contour</span>
            </div>

            {/* Scrolling Tactile strip of voice buttons */}
            <div className="space-y-2.5 max-h-[290px] overflow-y-auto pr-1">
              {VOICE_OPTIONS.map((voice) => {
                const isSelected = selectedVoice === voice.id;
                return (
                  <div
                    key={voice.id}
                    onClick={() => setSelectedVoice(voice.id)}
                    className={`p-3 rounded-2xl border transition-all duration-300 flex items-center justify-between gap-4 cursor-pointer group relative ${
                      isSelected
                        ? 'bg-rose-950/10 border-rose-500/45 shadow-sm'
                        : 'bg-zinc-950/30 border-zinc-900 hover:border-zinc-800'
                    }`}
                  >
                    {/* Active highlight glow strip */}
                    {isSelected && (
                      <div className="absolute left-0 top-3 bottom-3 w-0.5 bg-rose-500 rounded-r" />
                    )}

                    <div className="flex items-center gap-3">
                      {/* Interactive round profile slot */}
                      <div className={`w-9 h-9 rounded-xl border flex items-center justify-center transition-all ${
                        isSelected 
                          ? 'bg-rose-500/20 border-rose-500/40 text-rose-400' 
                          : 'bg-zinc-900 border-zinc-850 text-zinc-500 group-hover:text-zinc-300'
                      }`}>
                        <Mic className="w-4 h-4" />
                      </div>
                      
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-zinc-200">{voice.name}</span>
                          <span className={`text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded ${voice.accentBg}`}>
                            {voice.gender}
                          </span>
                        </div>
                        <p className="text-[10px] text-zinc-500 truncate max-w-[170px]">{voice.personality}</p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        playVoicePreview(voice.id);
                      }}
                      className={`text-[9px] font-black uppercase tracking-widest border px-2.5 py-1.5 rounded-xl transition-all cursor-pointer ${
                        isSelected
                          ? 'border-rose-500/30 hover:border-rose-500 bg-rose-500/10 text-rose-400'
                          : 'border-zinc-800 hover:border-zinc-700 text-zinc-450 hover:text-zinc-200 bg-zinc-900/40'
                      }`}
                    >
                      Audition
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Tape reels (History) */}
          <div className="bg-zinc-900/40 border border-zinc-850 rounded-3xl p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-zinc-500" />
                <h3 className="text-xs font-black uppercase tracking-widest text-zinc-300">Archived Reels</h3>
              </div>
              <span className="text-[10px] font-mono text-zinc-500">History Log</span>
            </div>

            <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
              {history.length === 0 ? (
                <div className="px-4 py-8 text-center bg-zinc-950/20 rounded-2xl border border-dashed border-zinc-850/60">
                  <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest leading-normal">
                    Reel stack is empty today.
                  </p>
                </div>
              ) : (
                history.map((item) => {
                  const isActive = activeHistoryId === item.id;
                  const formattedDate = new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  
                  return (
                    <div
                      key={item.id}
                      className={`p-3 rounded-xl border transition-all flex items-center justify-between gap-4 ${
                        isActive
                          ? 'bg-rose-950/10 border-rose-500/40 shadow-sm'
                          : 'bg-zinc-950/40 border-zinc-900 hover:border-zinc-850'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                          <span className="text-[10px] font-black uppercase tracking-wider text-rose-400">
                            {item.selected_voice}
                          </span>
                          <span className="text-[8px] font-mono font-bold text-zinc-500 uppercase tracking-widest bg-zinc-900 border border-zinc-850 px-1.5 py-0.2 rounded">
                            {item.selected_model}
                          </span>
                        </div>
                        <p className="text-[10px] text-zinc-400 truncate leading-relaxed">
                          "{item.text_snippet}"
                        </p>
                        <div className="flex items-center gap-3 mt-1.5 text-[9px] font-bold text-zinc-550 font-mono">
                          <span>{item.character_count} Chars</span>
                          <span>•</span>
                          <span>Today, {formattedDate}</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => playHistoryAudioItem(item)}
                        className={`p-2.5 rounded-xl shrink-0 flex items-center justify-center transition-all cursor-pointer ${
                          isActive && isPlaying
                            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                            : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-850'
                        }`}
                      >
                        {isActive && isPlaying ? (
                          <Pause className="w-3.5 h-3.5 fill-rose-400" />
                        ) : (
                          <Play className="w-3.5 h-3.5 fill-current translate-x-0.25" />
                        )}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
