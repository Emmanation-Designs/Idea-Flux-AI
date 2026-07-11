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
  HelpCircle,
  Settings,
  Sliders,
  Search,
  X,
  Bell,
  User
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../lib/supabase';
import type { Profile } from '../types';
import { toast } from 'sonner';
import { getSubscriptionPlan } from '../lib/subscriptions';
import { downloadFile } from '../utils/nativeCompat';

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

const MODEL_OPTIONS = [
  { id: 'eleven_turbo_v2_5', name: 'Standard (Turbo v2.5)', desc: 'Optimized for lowest latency and standard text-to-speech.' },
  { id: 'eleven_multilingual_v2', name: 'High-Definition (Multilingual v2)', desc: 'Optimized for maximum fidelity and foreign language support.' }
];

export const TextToSpeechView = ({ profile, onUpgradeClick, onBack }: TextToSpeechViewProps) => {
  const STORAGE_KEY_VOICE = 'trelvix_tts_voice';
  const STORAGE_KEY_SPEED = 'trelvix_tts_speed';
  const STORAGE_KEY_MODEL = 'trelvix_tts_model';

  const [text, setText] = useState('');
  const [selectedVoice, setSelectedVoice] = useState(() => localStorage.getItem(STORAGE_KEY_VOICE) || '');
  const [speed, setSpeed] = useState(() => Number(localStorage.getItem(STORAGE_KEY_SPEED)) || 1.0);
  const [selectedModel, setSelectedModel] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY_MODEL);
    if (saved && MODEL_OPTIONS.some(m => m.id === saved)) {
      return saved;
    }
    return 'eleven_turbo_v2_5';
  });
  
  // ElevenLabs dynamic voices states
  const [voices, setVoices] = useState<any[]>([]);
  const [isLoadingVoices, setIsLoadingVoices] = useState(true);
  const [playingPreviewId, setPlayingPreviewId] = useState<string | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  
  // Custom pro sliders
  const [stability, setStability] = useState(0.75);
  const [similarity, setSimilarity] = useState(0.85);

  const [isGenerating, setIsGenerating] = useState(false);
  const [generationPhase, setGenerationPhase] = useState<'preparing' | 'generating' | 'optimizing' | 'finalizing' | null>(null);
  
  const [charactersUsed, setCharactersUsed] = useState(0);
  const [monthlyAllowance, setMonthlyAllowance] = useState(10000);
  const [remainingCharacters, setRemainingCharacters] = useState(10000);
  const [maxCharactersPerGen, setMaxCharactersPerGen] = useState(2000);
  const [resetDate, setResetDate] = useState<string | null>(null);
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

  // Mobile Bottom Sheets & Advanced Sliders state
  const [activeMobileSheet, setActiveMobileSheet] = useState<'voice' | 'settings' | 'history' | null>(null);
  const [styleExaggeration, setStyleExaggeration] = useState(0.0);
  
  // History Search & Filters
  const [historySearch, setHistorySearch] = useState('');
  const [historyVoiceFilter, setHistoryVoiceFilter] = useState<string | null>(null);
  const [historyModelFilter, setHistoryModelFilter] = useState<string | null>(null);

  // Memoized grouped and filtered history
  const groupedHistory = React.useMemo(() => {
    // 1. Filter items
    const filtered = history.filter((item) => {
      const voiceObj = voices.find(v => v.voice_id === item.selected_voice) || { name: item.selected_voice };
      const voiceName = (voiceObj.name || '').toLowerCase();
      const textSnippet = (item.text_snippet || '').toLowerCase();
      const modelName = (item.selected_model || '').toLowerCase();
      const matchesSearch = !historySearch || 
        voiceName.includes(historySearch.toLowerCase()) || 
        textSnippet.includes(historySearch.toLowerCase()) ||
        modelName.includes(historySearch.toLowerCase());

      const matchesVoice = !historyVoiceFilter || item.selected_voice === historyVoiceFilter;
      const matchesModel = !historyModelFilter || item.selected_model === historyModelFilter;

      return matchesSearch && matchesVoice && matchesModel;
    });

    // 2. Group items by date labels (Today, Yesterday, Older)
    const groups: { [key: string]: TTSHistoryItem[] } = {};
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    filtered.forEach((item) => {
      const itemDate = new Date(item.created_at);
      itemDate.setHours(0, 0, 0, 0);

      let groupLabel = 'Older';
      if (itemDate.getTime() === today.getTime()) {
        groupLabel = 'Today';
      } else if (itemDate.getTime() === yesterday.getTime()) {
        groupLabel = 'Yesterday';
      } else {
        groupLabel = itemDate.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
      }

      if (!groups[groupLabel]) {
        groups[groupLabel] = [];
      }
      groups[groupLabel].push(item);
    });

    return groups;
  }, [history, historySearch, historyVoiceFilter, historyModelFilter, voices]);

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
      
      // Call get_monthly_tts_usage RPC which automatically handles lazy monthly resets
      const { data: usageData, error: usageErr } = await supabase
        .rpc('get_monthly_tts_usage', { user_uuid: profile.id });

      if (!usageErr && usageData && usageData.length > 0) {
        const u = usageData[0];
        setCharactersUsed(u.characters_used || 0);
        setMonthlyAllowance(u.monthly_allowance || 10000);
        setRemainingCharacters(u.remaining_characters || 0);
        setMaxCharactersPerGen(u.max_characters_per_generation || 2000);
        setResetDate(u.reset_date);
      } else {
        // Fallback to client-side profiles check and SUBSCRIPTION_PLANS configuration
        console.warn('get_monthly_tts_usage RPC fallback:', usageErr?.message);
        
        // Fetch current profile directly
        const { data: profData } = await supabase
          .from('profiles')
          .select('plan, tts_characters_used, tts_reset_date')
          .eq('id', profile.id)
          .single();

        const planName = profData?.plan || profile.plan || 'free';
        const planConfig = getSubscriptionPlan(planName);

        let used = profData?.tts_characters_used || 0;
        let rDate = profData?.tts_reset_date || null;

        // Fallback lazy reset check
        if (rDate && new Date() >= new Date(rDate)) {
          used = 0;
          const nextReset = new Date();
          nextReset.setMonth(nextReset.getMonth() + 1);
          rDate = nextReset.toISOString();
          
          await supabase
            .from('profiles')
            .update({
              tts_characters_used: 0,
              tts_reset_date: rDate
            })
            .eq('id', profile.id);
        }

        setCharactersUsed(used);
        setMonthlyAllowance(planConfig.monthlyAllowance);
        setRemainingCharacters(Math.max(0, planConfig.monthlyAllowance - used));
        setMaxCharactersPerGen(planConfig.maxCharactersPerGeneration);
        setResetDate(rDate);
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

  const fetchVoices = async () => {
    try {
      setIsLoadingVoices(true);
      const { data: sessionData } = await supabase.auth.getSession();
      const sessionToken = sessionData?.session?.access_token;
      
      const response = await fetch('/api/text-to-speech/voices', {
        headers: sessionToken ? {
          'Authorization': `Bearer ${sessionToken}`
        } : {}
      });
      
      if (!response.ok) {
        throw new Error(`Failed to load voices: Status ${response.status}`);
      }
      
      const data = await response.json();
      const loadedVoices = data.voices || [];
      setVoices(loadedVoices);
      
      if (loadedVoices.length > 0) {
        const storedVoice = localStorage.getItem(STORAGE_KEY_VOICE);
        const voiceExists = loadedVoices.some((v: any) => v.voice_id === storedVoice);
        if (!storedVoice || !voiceExists) {
          setSelectedVoice(loadedVoices[0].voice_id);
        } else {
          setSelectedVoice(storedVoice);
        }
      }
    } catch (err: any) {
      console.error('Error fetching ElevenLabs voices:', err);
      toast.error('Could not load voices from ElevenLabs.');
    } finally {
      setIsLoadingVoices(false);
    }
  };

  useEffect(() => {
    fetchUsageLimitsAndHistory();
    fetchVoices();
  }, [profile?.id, profile?.plan]);

  useEffect(() => {
    return () => {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
      }
    };
  }, []);

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
    const voiceObj = voices.find(v => v.voice_id === voiceId);
    if (!voiceObj || !voiceObj.preview_url) {
      toast.error('No preview sample available for this voice.');
      return;
    }

    if (playingPreviewId === voiceId) {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
        setPlayingPreviewId(null);
      }
      return;
    }

    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
    }

    toast.info(`Auditioning voice: ${voiceObj.name}`);
    const audio = new Audio(voiceObj.preview_url);
    previewAudioRef.current = audio;
    setPlayingPreviewId(voiceId);
    
    audio.play().catch(err => {
      console.error('Error playing preview:', err);
      setPlayingPreviewId(null);
    });

    audio.onended = () => {
      setPlayingPreviewId(null);
    };
  };

  const handleGenerate = async () => {
    if (!text.trim()) {
      toast.error('Please input script text first.');
      return;
    }

    if (text.length > maxCharactersPerGen) {
      toast.error(`Text exceeds maximum generation limit of ${maxCharactersPerGen} characters on your plan.`);
      return;
    }

    if (text.length > remainingCharacters) {
      toast.error(`Text length (${text.length} characters) exceeds your remaining monthly character allowance of ${remainingCharacters} characters.`);
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
          voiceId: selectedVoice,
          modelId: selectedModel,
          speed: speed,
          stability: stability,
          similarity: similarity,
          style: styleExaggeration
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
    downloadFile(audioUrl, `trelvix-tts-${Date.now()}.mp3`, 'audio/mpeg');
  };

  const currentVoiceObj = voices.find(v => v.voice_id === selectedVoice) || voices[0] || {
    voice_id: '',
    name: 'Select Voice',
    category: 'premade',
    labels: { description: 'Select a voice profile' },
    preview_url: ''
  };
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
          {onUpgradeClick && (profile?.plan || 'free') !== 'plus' && (
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
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
        
        {/* LEFT COLUMN: Clean writing pad workspace (col-span-8 equivalent) */}
        <div className="flex-1 flex flex-col bg-white dark:bg-zinc-950 min-w-0">
          
          <div className="flex-1 p-5 md:p-8 flex flex-col justify-between overflow-y-auto min-h-0">
            {/* The Plain Textarea canvas (no borders, matches background) */}
            <div className="flex-1 w-full min-h-0 flex flex-col mb-4">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Start typing or copy-paste your text here..."
                className="w-full flex-1 bg-transparent border-0 focus:outline-none focus:ring-0 text-[15px] leading-relaxed text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400 dark:placeholder:text-zinc-700 resize-none font-sans min-h-[120px] overflow-y-auto"
              />
            </div>

            {/* Desktop Bottom Status Panel of writing canvas (hidden on mobile) */}
            <div className="hidden lg:flex pt-6 border-t border-zinc-100 dark:border-zinc-900/60 items-center justify-between flex-wrap gap-4 mt-4 shrink-0">
              
              {/* Left Credits Balance */}
              <div className="flex items-center gap-2.5 text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                <span className={`h-1.5 w-1.5 rounded-full ${
                  (charactersUsed / monthlyAllowance) > 0.9 ? 'bg-red-500' : 'bg-emerald-500'
                }`} />
                {isLoadingLimits ? (
                  <span>Checking allowance...</span>
                ) : (
                  <span>
                    Monthly Allowance: <strong className="text-zinc-800 dark:text-zinc-200 font-semibold">{remainingCharacters.toLocaleString()}</strong> of {monthlyAllowance.toLocaleString()} characters remaining
                  </span>
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
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-zinc-400 dark:text-zinc-550" />
                      <span>{generationPhase === 'generating' ? 'Generating...' : 'Processing...'}</span>
                    </span>
                  ) : (
                    'Generate speech'
                  )}
                </button>
              </div>

            </div>

            {/* Mobile-Only Bottom Control Status panel (mockup Image 1) */}
            <div className="flex lg:hidden flex-col gap-4 pt-4 border-t border-zinc-150 dark:border-zinc-900 mt-4 shrink-0">
              
              {/* Row 1: Voice Button, Settings icon ⚙️, History icon 🕒 */}
              <div className="flex items-center gap-3 w-full">
                {/* Active Voice Pill */}
                <button
                  type="button"
                  onClick={() => setActiveMobileSheet('voice')}
                  className="flex-1 min-w-0 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 flex items-center gap-3 text-left hover:bg-zinc-100 dark:hover:bg-zinc-850 active:scale-[0.98] transition-all cursor-pointer"
                >
                  {/* Avatar Sphere design with lighting */}
                  <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-zinc-850 to-zinc-600 dark:from-zinc-250 dark:to-zinc-400 flex-shrink-0 flex items-center justify-center text-[11px] text-white dark:text-zinc-950 font-bold font-mono shadow border border-white/25">
                    {currentVoiceObj.name ? currentVoiceObj.name[0] : 'V'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-bold text-zinc-800 dark:text-zinc-200 truncate leading-snug">{currentVoiceObj.name || 'Select Voice'}</p>
                    <p className="text-[9px] text-zinc-400 dark:text-zinc-500 truncate font-medium uppercase tracking-wider font-mono">
                      {currentVoiceObj.category || 'Premade'} profile
                    </p>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-600 flex-shrink-0" />
                </button>

                {/* Voice Settings Slider trigger ⚙️ */}
                <button
                  type="button"
                  onClick={() => setActiveMobileSheet('settings')}
                  className="w-12 h-12 flex flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-850 text-zinc-600 dark:text-zinc-300 active:scale-95 transition-all cursor-pointer"
                  title="Voice Settings"
                >
                  <Settings className="w-4 h-4" />
                </button>

                {/* Speech History trigger 🕒 */}
                <button
                  type="button"
                  onClick={() => setActiveMobileSheet('history')}
                  className="w-12 h-12 flex flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-850 text-zinc-600 dark:text-zinc-300 active:scale-95 transition-all cursor-pointer"
                  title="Speech History"
                >
                  <Clock className="w-4 h-4" />
                </button>
              </div>

              {/* Row 2: Full width Primary Generate synthesis button */}
              <button
                onClick={handleGenerate}
                disabled={isGenerating || !text.trim()}
                className={`w-full py-3.5 rounded-xl text-xs font-semibold tracking-tight transition-all duration-200 active:scale-[0.98] cursor-pointer shadow-sm ${
                  isGenerating
                    ? 'bg-zinc-100 dark:bg-zinc-900 text-zinc-400 dark:text-zinc-650 border border-zinc-200 dark:border-zinc-850 cursor-not-allowed'
                    : text.trim()
                      ? 'bg-zinc-950 dark:bg-zinc-50 hover:bg-zinc-900 dark:hover:bg-zinc-200 text-white dark:text-zinc-950 border border-transparent font-bold'
                      : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-300 dark:text-zinc-700 border border-transparent cursor-not-allowed'
                }`}
              >
                {isGenerating ? (
                  <span className="flex items-center justify-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin text-zinc-400 dark:text-zinc-500" />
                    <span>{generationPhase === 'generating' ? 'Generating...' : 'Processing...'}</span>
                  </span>
                ) : (
                  'Generate speech'
                )}
              </button>

              {/* Row 3: Credits usage + Character counting indicator */}
              <div className="flex items-center justify-between text-[10px] text-zinc-400 dark:text-zinc-500 font-bold uppercase tracking-wider px-0.5">
                <div className="flex items-center gap-1.5">
                  <span className={`h-1.5 w-1.5 rounded-full ${
                    (charactersUsed / monthlyAllowance) > 0.9 ? 'bg-red-500' : 'bg-emerald-500'
                  }`} />
                  {isLoadingLimits ? (
                    <span>Checking allowance...</span>
                  ) : (
                    <span>{remainingCharacters.toLocaleString()} of {monthlyAllowance.toLocaleString()} remaining</span>
                  )}
                </div>
                <div className="font-mono">
                  {text.length} / {maxCharactersPerGen}
                </div>
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

        {/* RIGHT COLUMN: The parameter side deck separated by simple border (col-span-4) - Hidden on smaller screens */}
        <div className="hidden lg:flex lg:w-96 lg:border-l border-zinc-200 dark:border-zinc-900 bg-zinc-50/30 dark:bg-zinc-950/10 flex-col overflow-y-auto">
          
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
                  {/* Premium Subscription & Usage Card */}
                  <div className="bg-gradient-to-br from-zinc-50 to-zinc-100/60 dark:from-zinc-900/60 dark:to-zinc-900/20 border border-zinc-200/80 dark:border-zinc-800/80 rounded-xl p-4.5 space-y-4 shadow-sm">
                    {/* Header: Badge + Plan Name */}
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider block">Current Subscription</span>
                        <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-200 capitalize">
                          {profile?.plan || 'Free'} Plan
                        </h3>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                        profile?.plan === 'plus'
                          ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                          : profile?.plan === 'pro'
                            ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20'
                            : 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20'
                      }`}>
                        {profile?.plan || 'Free'}
                      </span>
                    </div>

                    {/* Progress Bar & Numerical stats */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-end">
                        <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">Monthly Usage</span>
                        <span className="text-xs font-mono font-bold text-zinc-800 dark:text-zinc-200">
                          {charactersUsed.toLocaleString()} <span className="text-zinc-400 dark:text-zinc-600">/ {monthlyAllowance.toLocaleString()}</span>
                        </span>
                      </div>

                      {/* Custom styled progress track */}
                      <div className="h-2 w-full bg-zinc-200/60 dark:bg-zinc-800/60 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all duration-500 ${
                            (charactersUsed / monthlyAllowance) > 0.9
                              ? 'bg-red-500 dark:bg-red-600'
                              : (charactersUsed / monthlyAllowance) > 0.7
                                ? 'bg-amber-500 dark:bg-amber-600'
                                : 'bg-zinc-900 dark:bg-zinc-100'
                          }`}
                          style={{ width: `${Math.min(100, (charactersUsed / monthlyAllowance) * 100)}%` }}
                        />
                      </div>

                      {/* Details row: Characters remaining */}
                      <div className="flex justify-between items-center pt-1 text-[11px] text-zinc-500 dark:text-zinc-400 font-medium">
                        <span>Characters Remaining:</span>
                        <span className="font-mono font-bold text-zinc-700 dark:text-zinc-300">
                          {remainingCharacters.toLocaleString()}
                        </span>
                      </div>
                    </div>

                    {/* Reset date info */}
                    {resetDate && (
                      <div className="pt-2.5 border-t border-zinc-200/60 dark:border-zinc-800/40 flex items-center justify-between text-[11px] text-zinc-400 dark:text-zinc-500">
                        <span className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" />
                          <span>Resets on:</span>
                        </span>
                        <span className="font-bold font-mono">
                          {new Date(resetDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      </div>
                    )}

                    {/* Upgrade button inside card */}
                    {onUpgradeClick && (profile?.plan || 'free') !== 'plus' && (
                      <button
                        onClick={onUpgradeClick}
                        className="w-full mt-1.5 py-2 px-3 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-950 font-bold text-xs rounded-lg shadow-sm hover:shadow transition-all flex items-center justify-center gap-1.5 cursor-pointer animate-pulse"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Upgrade Subscription</span>
                      </button>
                    )}
                  </div>

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
                          {currentVoiceObj.name} {currentVoiceObj.category ? `(${currentVoiceObj.category})` : ''}
                        </span>
                        <ChevronDown className={`w-4 h-4 text-zinc-400 dark:text-zinc-600 transition-transform duration-200 ${showVoiceDropdown ? 'rotate-180' : ''}`} />
                      </button>

                      {/* Floating list dropdown for voice profile options */}
                      {showVoiceDropdown && (
                        <div className="absolute top-[calc(100%+6px)] left-0 right-0 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-xl py-1.5 z-30 max-h-64 overflow-y-auto">
                          {isLoadingVoices ? (
                            <div className="px-3.5 py-4 text-xs text-zinc-400 dark:text-zinc-600 text-center flex items-center justify-center gap-2">
                              <RefreshCw className="w-3 h-3 animate-spin" />
                              <span>Loading ElevenLabs voices...</span>
                            </div>
                          ) : voices.length === 0 ? (
                            <div className="px-3.5 py-4 text-xs text-zinc-400 dark:text-zinc-600 text-center">
                              No voices found. Please check your ElevenLabs configuration.
                            </div>
                          ) : (
                            voices.map((voice) => {
                              const isChosen = voice.voice_id === selectedVoice;
                              const voiceGender = voice.labels?.gender || voice.category || 'Premade';
                              const voiceLabelInfo = voice.labels?.description || voice.labels?.accent || 'ElevenLabs Voice';
                              const isCurrentlyPlayingPreview = playingPreviewId === voice.voice_id;

                              return (
                                <div
                                  key={voice.voice_id}
                                  onClick={() => {
                                    setSelectedVoice(voice.voice_id);
                                    setShowVoiceDropdown(false);
                                  }}
                                  className="px-3.5 py-2.5 hover:bg-zinc-50 dark:hover:bg-zinc-900 text-xs text-zinc-700 dark:text-zinc-300 flex items-center justify-between cursor-pointer"
                                >
                                  <div className="space-y-0.5 min-w-0 pr-4">
                                    <div className="flex items-center gap-2">
                                      <span className="font-bold text-zinc-900 dark:text-zinc-100">{voice.name}</span>
                                      <span className="text-[10px] text-zinc-400 dark:text-zinc-555 font-medium font-mono">({voiceGender})</span>
                                    </div>
                                    <p className="text-[10px] text-zinc-400 dark:text-zinc-500 truncate">{voiceLabelInfo}</p>
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0">
                                    {voice.preview_url && (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          playVoicePreview(voice.voice_id);
                                        }}
                                        className={`p-1.5 border rounded-full transition-all cursor-pointer flex items-center justify-center ${
                                          isCurrentlyPlayingPreview
                                            ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-transparent'
                                            : 'border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-500 dark:text-zinc-455 hover:text-zinc-800 dark:hover:text-zinc-100'
                                        }`}
                                        title="Listen to voice sample"
                                      >
                                        {isCurrentlyPlayingPreview ? (
                                          <span className="h-2.5 w-2.5 flex items-center justify-center font-bold text-[8px] animate-pulse">■</span>
                                        ) : (
                                          <Play className="w-2.5 h-2.5 fill-current translate-x-[0.5px]" />
                                        )}
                                      </button>
                                    )}
                                    {isChosen && <Check className="w-3.5 h-3.5 text-zinc-900 dark:text-zinc-100" />}
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      )}
                    </div>

                    {/* Selected voice profile descriptive notes */}
                    <div className="p-3.5 bg-zinc-50/50 dark:bg-zinc-950/50 border border-zinc-200/50 dark:border-zinc-900/50 rounded-lg">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-550 uppercase tracking-wider">{currentVoiceObj.name} Bio</span>
                        {currentVoiceObj.preview_url && (
                          <button
                            type="button"
                            onClick={() => playVoicePreview(currentVoiceObj.voice_id)}
                            className="px-2 py-1 rounded border border-zinc-200 dark:border-zinc-800 hover:bg-white dark:hover:bg-zinc-900 text-[10px] font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-all flex items-center gap-1.5 cursor-pointer"
                            title="Audition voice preview"
                          >
                            {playingPreviewId === currentVoiceObj.voice_id ? (
                              <>
                                <span className="h-2 w-2 bg-red-500 rounded-sm animate-pulse" />
                                <span>Stop</span>
                              </>
                            ) : (
                              <>
                                <Play className="w-2.5 h-2.5 fill-current translate-x-[0.5px]" />
                                <span>Audition</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed font-medium">
                        {currentVoiceObj.labels && Object.keys(currentVoiceObj.labels).length > 0
                          ? Object.entries(currentVoiceObj.labels).map(([k, v]) => `${k}: ${v}`).join(' | ')
                          : 'ElevenLabs voice profile category: ' + currentVoiceObj.category}
                      </p>
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
                          <span className="text-[10px] font-bold px-1.5 py-0.5 border border-zinc-200 dark:border-zinc-850 bg-zinc-50 dark:bg-zinc-900 rounded font-mono">v2</span>
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
                        <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-550 uppercase tracking-widest block">Pro Engine Options</span>
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-normal font-medium">Render maximum high-fidelity audio spectrum outputs.</p>
                      </div>
                      {onUpgradeClick && (profile?.plan || 'free') !== 'plus' && (
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
                      <div className="flex justify-between text-[10px] text-zinc-400 dark:text-zinc-655 font-medium">
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
                      <div className="flex justify-between text-[10px] text-zinc-400 dark:text-zinc-655 font-medium">
                        <span>Low</span>
                        <span>High</span>
                      </div>
                    </div>

                    {/* Style Exaggeration Slider */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block">Style Exaggeration</span>
                        <span className="text-xs font-mono font-medium text-zinc-500 dark:text-zinc-400">{Math.round(styleExaggeration * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min="0.0"
                        max="1.0"
                        step="0.05"
                        value={styleExaggeration}
                        onChange={(e) => setStyleExaggeration(Number(e.target.value))}
                        className="w-full h-1 bg-zinc-200 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-zinc-900 dark:accent-zinc-100 focus:outline-none"
                      />
                      <div className="flex justify-between text-[10px] text-zinc-400 dark:text-zinc-655 font-medium">
                        <span>None</span>
                        <span>Exaggerated</span>
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
                  {/* Search box for history */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
                    <input
                      type="text"
                      placeholder="Search history..."
                      value={historySearch}
                      onChange={(e) => setHistorySearch(e.target.value)}
                      className="w-full bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg pl-9 pr-3 py-1.5 text-xs focus:ring-0 focus:outline-none focus:border-zinc-400 text-zinc-800 dark:text-zinc-200"
                    />
                  </div>

                  {/* Horizontal Category Pill filters */}
                  <div className="flex gap-1.5 overflow-x-auto pb-0.5 no-scrollbar text-[9px] font-bold">
                    <button
                      onClick={() => {
                        if (historyVoiceFilter) setHistoryVoiceFilter(null);
                        else {
                          const uniqueVoices = Array.from(new Set(history.map(h => h.selected_voice)));
                          if (uniqueVoices.length > 0) setHistoryVoiceFilter(uniqueVoices[0]);
                        }
                      }}
                      className={`px-2 py-1 border rounded-full cursor-pointer whitespace-nowrap transition-all ${
                        historyVoiceFilter 
                          ? 'bg-zinc-900 text-white border-transparent' 
                          : 'border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900 text-zinc-550'
                      }`}
                    >
                      {historyVoiceFilter ? `Voice: ${historyVoiceFilter}` : '+ Voice'}
                    </button>

                    <button
                      onClick={() => {
                        if (historyModelFilter) setHistoryModelFilter(null);
                        else setHistoryModelFilter('eleven_multilingual_v2');
                      }}
                      className={`px-2 py-1 border rounded-full cursor-pointer whitespace-nowrap transition-all ${
                        historyModelFilter 
                          ? 'bg-zinc-900 text-white border-transparent' 
                          : 'border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900 text-zinc-555'
                      }`}
                    >
                      {historyModelFilter ? 'Model: HD' : '+ Model'}
                    </button>

                    {(historySearch || historyVoiceFilter || historyModelFilter) && (
                      <button
                        onClick={() => {
                          setHistorySearch('');
                          setHistoryVoiceFilter(null);
                          setHistoryModelFilter(null);
                        }}
                        className="px-2.5 py-1 border border-red-200 text-red-650 rounded-full cursor-pointer hover:bg-red-50/50 whitespace-nowrap"
                      >
                        Reset
                      </button>
                    )}
                  </div>

                  {Object.keys(groupedHistory).length === 0 ? (
                    <div className="py-12 text-center text-xs text-zinc-400 dark:text-zinc-650 font-medium">
                      No matching speech files found.
                    </div>
                  ) : (
                    <div className="space-y-4 max-h-[calc(100vh-320px)] overflow-y-auto pr-1">
                      {Object.entries(groupedHistory).map(([dateLabel, items]) => (
                        <div key={dateLabel} className="space-y-2">
                          <h4 className="text-[9px] font-bold text-zinc-400 dark:text-zinc-555 uppercase tracking-widest px-1">{dateLabel}</h4>
                          <div className="space-y-2">
                            {items.map((item) => {
                              const isActive = activeHistoryId === item.id;
                              const matchesVoiceObj = voices.find(v => v.voice_id === item.selected_voice) || { name: item.selected_voice };
                              const isCurrentlyPlaying = isActive && isPlaying;

                              return (
                                <div
                                  key={item.id}
                                  className={`p-3 rounded-lg border flex items-center justify-between gap-3 text-xs transition-all ${
                                    isActive
                                      ? 'bg-zinc-50 dark:bg-zinc-900/60 border-zinc-300 dark:border-zinc-800 shadow-sm'
                                      : 'bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-900'
                                  }`}
                                >
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5 mb-1.5">
                                      <span className="font-bold text-zinc-800 dark:text-zinc-200 capitalize text-[11px]">
                                        {matchesVoiceObj.name}
                                      </span>
                                      <span className="text-[9px] font-mono text-zinc-400 dark:text-zinc-655 px-1 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 rounded font-bold uppercase">
                                        {item.selected_model === 'eleven_multilingual_v2' ? 'HD' : 'Turbo'}
                                      </span>
                                    </div>
                                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate leading-relaxed">
                                      "{item.text_snippet}"
                                    </p>
                                    <div className="flex gap-2 mt-1 text-[10px] text-zinc-400 dark:text-zinc-600 font-mono">
                                      <span>{item.character_count} chars</span>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <button
                                      type="button"
                                      onClick={() => playHistoryAudioItem(item)}
                                      className={`p-2 rounded-lg border shrink-0 transition-all cursor-pointer ${
                                        isCurrentlyPlaying
                                          ? 'bg-zinc-900 text-white border-transparent'
                                          : 'bg-white dark:bg-zinc-950 border-zinc-250 dark:border-zinc-850 text-zinc-550 dark:text-zinc-400 hover:text-zinc-855 dark:hover:text-zinc-200'
                                      }`}
                                    >
                                      {isCurrentlyPlaying ? (
                                        <Pause className="w-3 h-3 fill-current" />
                                      ) : (
                                        <Play className="w-3 h-3 fill-current translate-x-0.5" />
                                      )}
                                    </button>

                                    {item.audio_url && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          downloadFile(item.audio_url!, `trelvix-${item.id}.mp3`, 'audio/mpeg');
                                        }}
                                        className="p-2 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-150 rounded-lg text-zinc-450 hover:text-zinc-700"
                                      >
                                        <Download className="w-3 h-3" />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

        </div>

      </div>

      {/* Sliding Mobile Bottom Sheets */}
      <AnimatePresence>
        {activeMobileSheet && (
          <>
            {/* Dark translucent backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setActiveMobileSheet(null)}
              className="fixed inset-0 bg-black z-40 lg:hidden"
            />

            {/* Sliding sheet container */}
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 26, stiffness: 240 }}
              className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-zinc-950 rounded-t-3xl border-t border-zinc-200 dark:border-zinc-900 shadow-2xl flex flex-col max-h-[85vh] lg:hidden"
            >
              {/* Drag Handle representation */}
              <div 
                className="py-3 flex justify-center cursor-pointer shrink-0" 
                onClick={() => setActiveMobileSheet(null)}
              >
                <div className="w-12 h-1.5 bg-zinc-250 dark:bg-zinc-800 rounded-full" />
              </div>

              {/* Scrollable sheet body content */}
              <div className="overflow-y-auto px-6 pb-8 flex-1">
                
                {/* 1. VOICE SELECT SHEET */}
                {activeMobileSheet === 'voice' && (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center mb-1">
                      <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-widest">Select Voice</h3>
                      <button 
                        onClick={() => setActiveMobileSheet(null)} 
                        className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-full text-zinc-400 dark:text-zinc-550"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
                      {isLoadingVoices ? (
                        <div className="py-12 text-center text-xs text-zinc-400 flex flex-col items-center justify-center gap-2">
                          <RefreshCw className="w-4 h-4 animate-spin text-zinc-500" />
                          <span>Loading ElevenLabs voices...</span>
                        </div>
                      ) : voices.length === 0 ? (
                        <div className="py-12 text-center text-xs text-zinc-400">
                          No voices found. Please check your ElevenLabs configuration.
                        </div>
                      ) : (
                        voices.map((voice) => {
                          const isChosen = voice.voice_id === selectedVoice;
                          const voiceGender = voice.labels?.gender || voice.category || 'Premade';
                          const voiceLabelInfo = voice.labels?.description || voice.labels?.accent || 'ElevenLabs Voice';
                          const isCurrentlyPlayingPreview = playingPreviewId === voice.voice_id;

                          return (
                            <div
                              key={voice.voice_id}
                              onClick={() => {
                                setSelectedVoice(voice.voice_id);
                                setActiveMobileSheet(null);
                              }}
                              className={`p-3.5 border rounded-2xl flex items-center justify-between gap-3 text-xs cursor-pointer transition-all ${
                                isChosen 
                                  ? 'border-zinc-900 dark:border-zinc-100 bg-zinc-50 dark:bg-zinc-900/60 shadow-sm' 
                                  : 'border-zinc-200 dark:border-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-900'
                              }`}
                            >
                              <div className="min-w-0 flex-1 space-y-0.5">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-zinc-900 dark:text-zinc-100">{voice.name}</span>
                                  <span className="text-[9px] text-zinc-400 dark:text-zinc-600 font-bold uppercase tracking-wider bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded font-mono">({voiceGender})</span>
                                </div>
                                <p className="text-[10px] text-zinc-400 dark:text-zinc-500 truncate">{voiceLabelInfo}</p>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                {voice.preview_url && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      playVoicePreview(voice.voice_id);
                                    }}
                                    className={`p-2 border rounded-full transition-all cursor-pointer ${
                                      isCurrentlyPlayingPreview
                                        ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-transparent'
                                        : 'border-zinc-200 dark:border-zinc-850 hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-500 dark:text-zinc-400 hover:text-zinc-850 dark:hover:text-zinc-100'
                                    }`}
                                  >
                                    {isCurrentlyPlayingPreview ? (
                                      <span className="h-3 w-3 flex items-center justify-center font-bold text-[8px] animate-pulse">■</span>
                                    ) : (
                                      <Play className="w-3 h-3 fill-current translate-x-[0.5px]" />
                                    )}
                                  </button>
                                )}
                                {isChosen && <Check className="w-4 h-4 text-zinc-900 dark:text-zinc-100" />}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}

                {/* 2. SETTINGS SHEET (Mockup Image 2) */}
                {activeMobileSheet === 'settings' && (
                  <div className="space-y-5">
                    <div className="flex justify-between items-center">
                      <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-widest">Voice Settings</h3>
                      <button 
                        onClick={() => setActiveMobileSheet(null)} 
                        className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-full text-zinc-400 dark:text-zinc-555"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Model selector drop design */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider block">Model</label>
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setShowModelDropdown(!showModelDropdown)}
                          className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3.5 flex items-center justify-between text-xs font-semibold text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-850 cursor-pointer"
                        >
                          <span className="flex items-center gap-2">
                            <span className="text-[10px] font-bold px-1.5 py-0.5 border border-zinc-200 dark:border-zinc-855 bg-white dark:bg-zinc-955 rounded font-mono">V2</span>
                            {currentModelObj.name}
                          </span>
                          <ChevronDown className="w-4 h-4 text-zinc-400" />
                        </button>
                        {showModelDropdown && (
                          <div className="absolute bottom-[102%] left-0 right-0 bg-white dark:bg-zinc-950 border border-zinc-250 dark:border-zinc-850 rounded-xl shadow-2xl py-1 z-50">
                            {MODEL_OPTIONS.map((opt) => (
                              <div
                                key={opt.id}
                                onClick={() => {
                                  setSelectedModel(opt.id);
                                  setShowModelDropdown(false);
                                }}
                                className="px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-900 text-xs cursor-pointer flex justify-between items-center"
                              >
                                <div>
                                  <div className="font-bold text-zinc-900 dark:text-zinc-100">{opt.name}</div>
                                  <div className="text-[10px] text-zinc-400 mt-0.5">{opt.desc}</div>
                                </div>
                                {opt.id === selectedModel && <Check className="w-4 h-4 text-zinc-900 dark:text-zinc-100 shrink-0" />}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Try Eleven v3 spectrum rainbow banner (matching Image 2) */}
                      <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-purple-500/10 via-pink-500/10 to-amber-500/10 border border-purple-500/20 p-4 flex items-center justify-between gap-4 mt-2">
                        <div className="space-y-0.5">
                          <span className="text-[9px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest block">The most expressive Text to Speech</span>
                          <p className="text-[11px] text-zinc-700 dark:text-zinc-300 font-bold leading-none mt-1">Try Eleven v3</p>
                        </div>
                        <button 
                          onClick={() => {
                            onUpgradeClick?.();
                            setActiveMobileSheet(null);
                          }}
                          className="px-3 py-1.5 rounded-lg text-[10px] font-bold bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 shadow-sm whitespace-nowrap hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer"
                        >
                          Upgrade
                        </button>
                      </div>
                    </div>

                    {/* Range Faders */}
                    <div className="space-y-4 pt-2 border-t border-zinc-100 dark:border-zinc-900/60 max-h-[40vh] overflow-y-auto pr-1">
                      
                      {/* Speed */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-zinc-500 dark:text-zinc-450 uppercase tracking-wider block">Speed</span>
                          <span className="text-[11px] font-mono font-bold text-zinc-700 dark:text-zinc-300">{speed.toFixed(2)}x</span>
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
                        <div className="flex justify-between text-[10px] text-zinc-400 font-semibold">
                          <span>Slower</span>
                          <span>Faster</span>
                        </div>
                      </div>

                      {/* Stability */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-zinc-500 dark:text-zinc-455 uppercase tracking-wider block">Stability</span>
                          <span className="text-[11px] font-mono font-bold text-zinc-700 dark:text-zinc-300">{Math.round(stability * 100)}%</span>
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
                        <div className="flex justify-between text-[10px] text-zinc-400 font-semibold">
                          <span>More variable</span>
                          <span>More stable</span>
                        </div>
                      </div>

                      {/* Clarity / Similarity */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-zinc-500 dark:text-zinc-455 uppercase tracking-wider block">Clarity / Similarity</span>
                          <span className="text-[11px] font-mono font-bold text-zinc-700 dark:text-zinc-300">{Math.round(similarity * 100)}%</span>
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
                        <div className="flex justify-between text-[10px] text-zinc-400 font-semibold">
                          <span>Low</span>
                          <span>High</span>
                        </div>
                      </div>

                      {/* Style Exaggeration */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-zinc-500 dark:text-zinc-455 uppercase tracking-wider block">Style Exaggeration</span>
                          <span className="text-[11px] font-mono font-bold text-zinc-700 dark:text-zinc-300">{Math.round(styleExaggeration * 100)}%</span>
                        </div>
                        <input
                          type="range"
                          min="0.0"
                          max="1.0"
                          step="0.05"
                          value={styleExaggeration}
                          onChange={(e) => setStyleExaggeration(Number(e.target.value))}
                          className="w-full h-1 bg-zinc-200 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-zinc-900 dark:accent-zinc-100 focus:outline-none"
                        />
                        <div className="flex justify-between text-[10px] text-zinc-400 font-semibold">
                          <span>None</span>
                          <span>Exaggerated</span>
                        </div>
                      </div>

                    </div>
                  </div>
                )}

                {/* 3. HISTORY SHEET (Mockup Image 3) */}
                {activeMobileSheet === 'history' && (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-widest">Speech History</h3>
                      <button 
                        onClick={() => setActiveMobileSheet(null)} 
                        className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-full text-zinc-400 dark:text-zinc-555"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Search bar inside sheet */}
                    <div className="relative">
                      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                      <input
                        type="text"
                        placeholder="Search history..."
                        value={historySearch}
                        onChange={(e) => setHistorySearch(e.target.value)}
                        className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-xs focus:ring-0 focus:outline-none focus:border-zinc-400 text-zinc-800 dark:text-zinc-200"
                      />
                    </div>

                    {/* Search Filter Category Pills inside sheet (Mockup Image 3 Style) */}
                    <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar text-[10px] font-bold">
                      <button
                        onClick={() => {
                          if (historyVoiceFilter) setHistoryVoiceFilter(null);
                          else {
                            const uniqueVoices = Array.from(new Set(history.map(h => h.selected_voice)));
                            if (uniqueVoices.length > 0) setHistoryVoiceFilter(uniqueVoices[0]);
                          }
                        }}
                        className={`px-3 py-1.5 border rounded-full whitespace-nowrap transition-all cursor-pointer ${
                          historyVoiceFilter 
                            ? 'bg-zinc-900 text-white border-transparent' 
                            : 'border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900 text-zinc-550'
                        }`}
                      >
                        {historyVoiceFilter ? `Voice: ${historyVoiceFilter}` : '+ Voice'}
                      </button>

                      <button
                        onClick={() => {
                          if (historyModelFilter) setHistoryModelFilter(null);
                          else setHistoryModelFilter('eleven_multilingual_v2');
                        }}
                        className={`px-3 py-1.5 border rounded-full whitespace-nowrap transition-all cursor-pointer ${
                          historyModelFilter 
                            ? 'bg-zinc-900 text-white border-transparent' 
                            : 'border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900 text-zinc-550'
                        }`}
                      >
                        {historyModelFilter ? 'Model: HD' : '+ Model'}
                      </button>

                      {(historySearch || historyVoiceFilter || historyModelFilter) && (
                        <button
                          onClick={() => {
                            setHistorySearch('');
                            setHistoryVoiceFilter(null);
                            setHistoryModelFilter(null);
                          }}
                          className="px-3 py-1.5 border border-red-200/60 hover:bg-red-50 text-red-655 rounded-full cursor-pointer whitespace-nowrap font-bold"
                        >
                          Clear
                        </button>
                      )}
                    </div>

                    {/* Date-Grouped History List */}
                    <div className="space-y-4 max-h-[45vh] overflow-y-auto pr-1">
                      {Object.keys(groupedHistory).length === 0 ? (
                        <div className="py-12 text-center text-xs text-zinc-400 font-medium">
                          No matching records found.
                        </div>
                      ) : (
                        Object.entries(groupedHistory).map(([dateLabel, items]) => (
                          <div key={dateLabel} className="space-y-2">
                            <h4 className="text-[10px] font-bold text-zinc-450 dark:text-zinc-555 uppercase tracking-widest px-1">{dateLabel}</h4>
                            <div className="space-y-2">
                              {items.map((item) => {
                                const isActive = activeHistoryId === item.id;
                                const matchesVoiceObj = voices.find(v => v.voice_id === item.selected_voice) || { name: item.selected_voice };
                                const isItemPlaying = isActive && isPlaying;

                                return (
                                  <div
                                    key={item.id}
                                    className="p-3.5 border border-zinc-150 dark:border-zinc-900 rounded-xl bg-zinc-50/50 dark:bg-zinc-900/20 flex items-center justify-between gap-3 text-xs shadow-sm"
                                  >
                                    <div className="min-w-0 flex-1">
                                      <div className="font-bold text-zinc-850 dark:text-zinc-200 truncate capitalize text-[11px] mb-0.5">
                                        {matchesVoiceObj.name}
                                      </div>
                                      <p className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate leading-normal">
                                        "{item.text_snippet}"
                                      </p>
                                      <div className="flex gap-2 mt-1 text-[9px] text-zinc-400 dark:text-zinc-650 font-semibold uppercase tracking-wider font-mono">
                                        <span>{item.character_count} chars</span>
                                        <span>•</span>
                                        <span>{item.selected_model === 'eleven_multilingual_v2' ? 'HD' : 'Turbo'}</span>
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-2 shrink-0">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          playHistoryAudioItem(item);
                                          setActiveMobileSheet(null);
                                        }}
                                        className={`p-2 rounded-full border transition-all cursor-pointer ${
                                          isItemPlaying
                                            ? 'bg-zinc-955 text-white dark:bg-zinc-50 dark:text-zinc-955 border-transparent'
                                            : 'bg-white dark:bg-zinc-900 border-zinc-250 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-zinc-850 dark:hover:text-zinc-100'
                                        }`}
                                      >
                                        {isItemPlaying ? (
                                          <Pause className="w-3.5 h-3.5 fill-current" />
                                        ) : (
                                          <Play className="w-3.5 h-3.5 fill-current translate-x-0.5" />
                                        )}
                                      </button>

                                      {item.audio_url && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            downloadFile(item.audio_url!, `trelvix-${item.id}.mp3`, 'audio/mpeg');
                                          }}
                                          className="p-2 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-zinc-100 rounded-full text-zinc-455 hover:text-zinc-700"
                                        >
                                          <Download className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

    </div>
  );
};
