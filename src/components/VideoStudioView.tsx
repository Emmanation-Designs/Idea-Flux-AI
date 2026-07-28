import React, { useState, useEffect } from 'react';
import { 
  Video, 
  Film, 
  Sparkles, 
  Play, 
  Pause, 
  Download, 
  Lock, 
  Crown, 
  Zap, 
  Sliders, 
  Clock, 
  Monitor, 
  Maximize2, 
  ChevronDown, 
  Check, 
  ArrowLeft, 
  Copy, 
  RefreshCw, 
  Info, 
  X, 
  Clapperboard, 
  Wand2, 
  Share2,
  Trash2,
  Maximize,
  Volume2,
  VolumeX,
  Folder
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { Profile } from '../types';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { LibraryModal, MediaFileItem } from './LibraryModal';

interface VideoStudioViewProps {
  profile: Profile | null;
  onUpgradeClick?: () => void;
  onBack?: () => void;
}

interface VideoGenerationItem {
  id: string;
  created_at: string;
  prompt: string;
  model: string;
  duration: string;
  resolution: string;
  aspectRatio: string;
  status: 'completed' | 'generating' | 'failed';
  videoUrl?: string;
  thumbnailUrl?: string;
}

const SORA_MODELS = [
  { 
    id: 'sora-v1-hd', 
    name: 'OpenAI Sora v1.0', 
    badge: 'Cinematic HD',
    desc: 'Flagship model for highest physical accuracy, complex motion, and cinematic lighting.' 
  },
  { 
    id: 'sora-turbo', 
    name: 'OpenAI Sora Turbo', 
    badge: 'Fast Render',
    desc: 'Optimized for rapid generation and quick visual experimentation with lower latency.' 
  },
  { 
    id: 'sora-realism-pro', 
    name: 'OpenAI Sora Realism Pro', 
    badge: 'Photorealistic',
    desc: 'Ultra-high detail photorealism tailored for studio-grade landscape and character rendering.' 
  }
];

const ASPECT_RATIOS = [
  { id: '16:9', label: '16:9', name: 'Widescreen', iconClass: 'w-5 h-3 border-2 border-current rounded-sm' },
  { id: '9:16', label: '9:16', name: 'Portrait', iconClass: 'w-3 h-5 border-2 border-current rounded-sm' },
  { id: '1:1', label: '1:1', name: 'Square', iconClass: 'w-4 h-4 border-2 border-current rounded-sm' },
  { id: '21:9', label: '21:9', name: 'Cinematic', iconClass: 'w-6 h-2.5 border-2 border-current rounded-sm' },
];

const DURATIONS = ['5s', '10s', '15s', '20s'];
const RESOLUTIONS = ['720p', '1080p', '4K'];

const SAMPLE_PROMPTS = [
  'A neon-lit cyberpunk street in Tokyo during a rainstorm, reflections on wet pavement, cinematic 8k',
  'FPV drone flight through a dense golden autumn forest with morning mist drifting between trees',
  'Slow-motion macro shot of an intricate glass hummingbird hovering over a glowing lotus flower',
  'Futuristic electric sports car drifting smoothly around a mountain cliffside at sunset'
];

export const VideoStudioView: React.FC<VideoStudioViewProps> = ({
  profile,
  onUpgradeClick,
  onBack
}) => {
  const isPlusOrPro = profile?.plan === 'plus' || profile?.plan === 'pro';

  const [prompt, setPrompt] = useState('');
  const [selectedModel, setSelectedModel] = useState('sora-v1-hd');
  const [selectedDuration, setSelectedDuration] = useState('10s');
  const [selectedResolution, setSelectedResolution] = useState('1080p');
  const [selectedAspectRatio, setSelectedAspectRatio] = useState('16:9');
  
  // Advanced Settings
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [fps, setFps] = useState('24 fps');
  const [cameraMotion, setCameraMotion] = useState('Smooth Pan');
  const [motionStrength, setMotionStrength] = useState(0.7);

  // Dropdown states
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [showLibraryModal, setShowLibraryModal] = useState(false);

  // Generation & playback state
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationPhase, setGenerationPhase] = useState<string>('Initializing');
  
  const [activeVideo, setActiveVideo] = useState<VideoGenerationItem | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);

  // Mock initial history
  const [history, setHistory] = useState<VideoGenerationItem[]>([
    {
      id: 'v-1',
      created_at: new Date(Date.now() - 3600000).toISOString(),
      prompt: 'A majestic blue whale gliding gracefully through an etherial starry galaxy in deep space',
      model: 'sora-v1-hd',
      duration: '10s',
      resolution: '1080p',
      aspectRatio: '16:9',
      status: 'completed',
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4'
    }
  ]);

  // Load user's video generation history on mount
  useEffect(() => {
    let isMounted = true;
    async function loadGenerations() {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;
        if (!token) return;

        const res = await fetch('/api/tools/video-studio/generations', {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (data?.success && Array.isArray(data.videos) && data.videos.length > 0 && isMounted) {
          const apiVideos: VideoGenerationItem[] = data.videos.map((v: any) => ({
            id: v.id,
            created_at: v.createdAt || new Date().toISOString(),
            prompt: v.prompt,
            model: v.model || 'sora-v1-hd',
            duration: v.duration || '10s',
            resolution: v.resolution || '1080p',
            aspectRatio: v.aspectRatio || '16:9',
            status: 'completed',
            videoUrl: v.videoUrl
          }));

          setHistory(prev => {
            const existingIds = new Set(prev.map(p => p.id));
            const fresh = apiVideos.filter(v => !existingIds.has(v.id));
            return [...fresh, ...prev];
          });
        }
      } catch (err) {
        console.warn('Could not load video history:', err);
      }
    }
    loadGenerations();
    return () => { isMounted = false; };
  }, []);

  const handleEnhancePrompt = () => {
    if (!prompt.trim()) {
      setPrompt(SAMPLE_PROMPTS[Math.floor(Math.random() * SAMPLE_PROMPTS.length)]);
      toast.success('Sample prompt inserted');
      return;
    }
    setPrompt(prev => `${prev.trim()}, 8k resolution, photorealistic, cinematic volumetric lighting, dynamic camera angle, shallow depth of field`);
    toast.success('Prompt enhanced with cinematic keywords');
  };

  const handleGenerate = async () => {
    if (!isPlusOrPro) {
      onUpgradeClick?.();
      return;
    }

    if (!prompt.trim()) {
      toast.error('Please enter a prompt to generate video');
      return;
    }

    setIsGenerating(true);
    setGenerationProgress(10);
    setGenerationPhase('Authenticating & verifying AI Capacity...');

    const intervalTimer = setInterval(() => {
      setGenerationProgress(prev => {
        if (prev < 85) return prev + 12;
        return prev;
      });
    }, 1000);

    try {
      setGenerationPhase('Synthesizing motion vectors with OpenAI Sora...');
      const { data: sessionData } = await supabase.auth.getSession();
      const sessionToken = sessionData?.session?.access_token;

      if (!sessionToken) {
        throw new Error('Authentication session not found. Please log in.');
      }

      setGenerationPhase('Rendering high-definition neural frames...');
      const response = await fetch('/api/tools/video-studio', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify({
          prompt,
          model: selectedModel,
          duration: selectedDuration,
          resolution: selectedResolution,
          aspectRatio: selectedAspectRatio,
          fps: fps,
          cameraMotion,
          motionStrength
        })
      });

      clearInterval(intervalTimer);

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to generate video.');
      }

      setGenerationProgress(100);
      setGenerationPhase('Finalizing MP4 video container...');

      const newVideo: VideoGenerationItem = {
        id: data.video.id || `v-${Date.now()}`,
        created_at: data.video.createdAt || new Date().toISOString(),
        prompt: data.video.prompt || prompt,
        model: data.video.model || selectedModel,
        duration: data.video.duration || selectedDuration,
        resolution: data.video.resolution || selectedResolution,
        aspectRatio: data.video.aspectRatio || selectedAspectRatio,
        status: 'completed',
        videoUrl: data.video.videoUrl
      };

      setHistory(prev => [newVideo, ...prev]);
      setActiveVideo(newVideo);
      setIsPlaying(true);
      toast.success('Video generation complete! AI Capacity deducted.');
    } catch (err: any) {
      clearInterval(intervalTimer);
      console.error('[VideoStudio] Generation failed:', err);
      toast.error(err.message || 'An error occurred during video generation.');
    } finally {
      setIsGenerating(false);
    }
  };

  const currentModelObj = SORA_MODELS.find(m => m.id === selectedModel) || SORA_MODELS[0];

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 transition-colors">
      
      {/* HEADER BAR */}
      <header className="sticky top-0 z-30 flex items-center justify-between px-6 py-4 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800/80">
        <div className="flex items-center gap-4">
          {onBack && (
            <button
              onClick={onBack}
              className="p-2 -ml-2 rounded-xl text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all"
              title="Return to Chat"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                Video Studio
              </h1>
              <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-widest bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 rounded-full">
                Sora AI
              </span>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium mt-0.5">
              Create cinematic AI videos powered by OpenAI Sora.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowLibraryModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 rounded-xl text-xs font-semibold shadow-xs transition-all border border-zinc-200 dark:border-zinc-700/60"
            title="Open Media Library"
          >
            <Folder className="w-3.5 h-3.5 text-indigo-500" />
            <span>Library</span>
          </button>

          {!isPlusOrPro && (
            <button
              onClick={onUpgradeClick}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl text-xs font-semibold shadow-sm transition-all"
            >
              <Crown className="w-3.5 h-3.5" />
              <span>Upgrade to Plus</span>
            </button>
          )}

          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-800/60 text-xs font-semibold text-zinc-600 dark:text-zinc-300">
            <Clapperboard className="w-3.5 h-3.5 text-indigo-500" />
            <span>OpenAI Sora Integration</span>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT WORKSPACE */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-8">
        
        {/* FREE TIER UPGRADE BANNER (if free user) */}
        {!isPlusOrPro && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-6 rounded-2xl bg-gradient-to-r from-indigo-900/10 via-purple-900/10 to-pink-900/10 border border-indigo-500/20 dark:border-indigo-500/30 backdrop-blur-sm relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-6"
          >
            <div className="space-y-2 max-w-2xl z-10">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                <Crown className="w-3 h-3" />
                <span>Plus & Pro Exclusive Studio</span>
              </div>
              <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
                Unlock OpenAI Sora Cinematic Video Generation
              </h2>
              <p className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">
                Video Studio requires a <strong className="text-indigo-600 dark:text-indigo-400 font-semibold">Plus</strong> or <strong className="text-indigo-600 dark:text-indigo-400 font-semibold">Pro</strong> membership. You can explore the prompt interface below, but video synthesis is locked for Free accounts.
              </p>
            </div>

            <button
              onClick={onUpgradeClick}
              className="z-10 shrink-0 px-6 py-3 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 text-white font-semibold text-sm rounded-xl shadow-lg shadow-indigo-500/20 flex items-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              <Sparkles className="w-4 h-4" />
              <span>Upgrade Plan Now</span>
            </button>

            <div className="absolute -right-12 -bottom-12 w-48 h-48 bg-indigo-500/10 dark:bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
          </motion.div>
        )}

        {/* GOOGLE FLOW INSPIRED TWO-COLUMN LAYOUT */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* LEFT COLUMN: PROMPT & CONTROLS */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* PROMPT CONTAINER CARD */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 sm:p-6 shadow-sm hover:border-indigo-500/30 transition-all space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
                  <Wand2 className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Video Description Prompt</span>
                </label>

                <button
                  type="button"
                  onClick={handleEnhancePrompt}
                  className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Magic Enhance</span>
                </button>
              </div>

              <div className="relative">
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Describe the video you want to generate..."
                  rows={4}
                  className="w-full bg-zinc-50 dark:bg-zinc-950/80 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all resize-none leading-relaxed"
                />
              </div>

              {/* QUICK PROMPT SUGGESTIONS */}
              <div className="space-y-2 pt-1">
                <span className="text-[11px] font-semibold text-zinc-400 dark:text-zinc-500">
                  Quick Ideas:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {SAMPLE_PROMPTS.map((sample, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setPrompt(sample)}
                      className="text-[11px] px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800/80 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-zinc-600 dark:text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-300 transition-all text-left truncate max-w-[280px]"
                    >
                      {sample}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* CONTROLS CARD */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 sm:p-6 shadow-sm space-y-6">
              <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800/60 pb-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Sora Generation Parameters</span>
                </h3>
                <span className="text-xs text-zinc-400 font-mono">OpenAI Sora API</span>
              </div>

              {/* 1. SORA MODEL SELECTOR */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Model Engine
                </label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowModelDropdown(!showModelDropdown)}
                    className="w-full flex items-center justify-between p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-left hover:border-indigo-500/50 transition-all"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                          {currentModelObj.name}
                        </span>
                        <span className="px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-md">
                          {currentModelObj.badge}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                        {currentModelObj.desc}
                      </p>
                    </div>
                    <ChevronDown className="w-4 h-4 text-zinc-400 shrink-0 ml-2" />
                  </button>

                  <AnimatePresence>
                    {showModelDropdown && (
                      <motion.div
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 5 }}
                        className="absolute top-full left-0 right-0 mt-2 z-20 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl overflow-hidden p-1 space-y-1"
                      >
                        {SORA_MODELS.map((model) => (
                          <button
                            key={model.id}
                            type="button"
                            onClick={() => {
                              setSelectedModel(model.id);
                              setShowModelDropdown(false);
                            }}
                            className={`w-full text-left p-3 rounded-lg transition-all flex items-start justify-between ${
                              selectedModel === model.id
                                ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-100 font-medium'
                                : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
                            }`}
                          >
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold">{model.name}</span>
                                <span className="px-1.5 py-0.5 text-[8px] font-black uppercase bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 rounded">
                                  {model.badge}
                                </span>
                              </div>
                              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                                {model.desc}
                              </p>
                            </div>
                            {selectedModel === model.id && (
                              <Check className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-1" />
                            )}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* 2. ASPECT RATIO SELECTOR */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Aspect Ratio
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {ASPECT_RATIOS.map((ratio) => {
                    const isSelected = selectedAspectRatio === ratio.id;
                    return (
                      <button
                        key={ratio.id}
                        type="button"
                        onClick={() => setSelectedAspectRatio(ratio.id)}
                        className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all text-center ${
                          isSelected
                            ? 'bg-indigo-50/80 dark:bg-indigo-950/50 border-indigo-500 text-indigo-600 dark:text-indigo-400 shadow-sm'
                            : 'bg-zinc-50 dark:bg-zinc-950/60 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-700'
                        }`}
                      >
                        <div className={`${ratio.iconClass} mb-1.5 ${isSelected ? 'text-indigo-600 dark:text-indigo-400' : 'text-zinc-400'}`} />
                        <span className="text-xs font-bold">{ratio.id}</span>
                        <span className="text-[10px] text-zinc-400">{ratio.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 3. DURATION & RESOLUTION GRID */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* DURATION */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Duration</span>
                  </label>
                  <div className="grid grid-cols-4 gap-1.5 bg-zinc-50 dark:bg-zinc-950 p-1 rounded-xl border border-zinc-200 dark:border-zinc-800">
                    {DURATIONS.map((dur) => (
                      <button
                        key={dur}
                        type="button"
                        onClick={() => setSelectedDuration(dur)}
                        className={`py-1.5 text-xs font-bold rounded-lg transition-all ${
                          selectedDuration === dur
                            ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-sm'
                            : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'
                        }`}
                      >
                        {dur}
                      </button>
                    ))}
                  </div>
                </div>

                {/* RESOLUTION */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                    <Monitor className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Resolution</span>
                  </label>
                  <div className="grid grid-cols-3 gap-1.5 bg-zinc-50 dark:bg-zinc-950 p-1 rounded-xl border border-zinc-200 dark:border-zinc-800">
                    {RESOLUTIONS.map((res) => (
                      <button
                        key={res}
                        type="button"
                        onClick={() => setSelectedResolution(res)}
                        className={`py-1.5 text-xs font-bold rounded-lg transition-all ${
                          selectedResolution === res
                            ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-sm'
                            : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'
                        }`}
                      >
                        {res}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* ADVANCED COLLAPSIBLE CONTROLS */}
              <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/60">
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="flex items-center justify-between w-full text-xs font-semibold text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors py-1"
                >
                  <span className="flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5" />
                    <span>Advanced Camera & Frame Controls</span>
                  </span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
                </button>

                <AnimatePresence>
                  {showAdvanced && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden space-y-4 pt-4"
                    >
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
                            Frame Rate
                          </label>
                          <select
                            value={fps}
                            onChange={(e) => setFps(e.target.value)}
                            className="w-full mt-1 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg p-2 text-xs font-medium focus:outline-none"
                          >
                            <option value="24 fps">24 fps (Cinematic)</option>
                            <option value="30 fps">30 fps (Standard)</option>
                            <option value="60 fps">60 fps (Smooth)</option>
                          </select>
                        </div>

                        <div>
                          <label className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
                            Camera Motion
                          </label>
                          <select
                            value={cameraMotion}
                            onChange={(e) => setCameraMotion(e.target.value)}
                            className="w-full mt-1 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg p-2 text-xs font-medium focus:outline-none"
                          >
                            <option value="Smooth Pan">Smooth Pan</option>
                            <option value="FPV Flythrough">FPV Flythrough</option>
                            <option value="Slow Zoom In">Slow Zoom In</option>
                            <option value="Orbit Tracking">Orbit Tracking</option>
                            <option value="Static Tripod">Static Tripod</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 mb-1">
                          <span>Motion Strength</span>
                          <span className="font-mono text-indigo-500">{Math.round(motionStrength * 100)}%</span>
                        </div>
                        <input
                          type="range"
                          min="0.1"
                          max="1.0"
                          step="0.05"
                          value={motionStrength}
                          onChange={(e) => setMotionStrength(parseFloat(e.target.value))}
                          className="w-full accent-indigo-600"
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* GENERATE BUTTON */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  className={`w-full py-4 px-6 rounded-2xl font-bold text-sm shadow-xl flex items-center justify-center gap-2.5 transition-all ${
                    !isPlusOrPro
                      ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-300 dark:hover:bg-zinc-700 cursor-pointer'
                      : isGenerating
                      ? 'bg-indigo-600 text-white cursor-wait opacity-90'
                      : 'bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 text-white shadow-indigo-500/25 hover:shadow-indigo-500/35 hover:scale-[1.01] active:scale-[0.99]'
                  }`}
                >
                  {!isPlusOrPro ? (
                    <>
                      <Lock className="w-4 h-4 text-amber-500" />
                      <span>Upgrade to Plus/Pro to Generate</span>
                    </>
                  ) : isGenerating ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Generating Video ({generationProgress}%)</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Generate Cinematic Video</span>
                    </>
                  )}
                </button>
              </div>

              {/* GENERATION PROGRESS BAR */}
              {isGenerating && (
                <div className="space-y-2 pt-2">
                  <div className="flex justify-between text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                    <span className="animate-pulse">{generationPhase}</span>
                    <span className="font-mono">{generationProgress}%</span>
                  </div>
                  <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-2 rounded-full overflow-hidden">
                    <motion.div
                      className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 h-full rounded-full"
                      initial={{ width: '0%' }}
                      animate={{ width: `${generationProgress}%` }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                </div>
              )}

            </div>
          </div>

          {/* RIGHT COLUMN: PREVIEW & HISTORY SHOWCASE */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* CANVAS PREVIEW CARD */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800/60 pb-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
                  <Film className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Studio Player Canvas</span>
                </h3>
                {activeVideo && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    Ready
                  </span>
                )}
              </div>

              {/* VIDEO PLAYER CONTAINER */}
              <div className="relative aspect-video bg-zinc-950 rounded-xl overflow-hidden border border-zinc-800 flex items-center justify-center group">
                {activeVideo?.videoUrl ? (
                  <div className="relative w-full h-full flex items-center justify-center">
                    <video
                      src={activeVideo.videoUrl}
                      className="w-full h-full object-cover"
                      controls={false}
                      autoPlay={isPlaying}
                      loop
                      muted={isMuted}
                    />

                    {/* OVERLAY PLAY CONTROLS */}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                      <button
                        onClick={() => setIsPlaying(!isPlaying)}
                        className="p-3 rounded-full bg-white/20 backdrop-blur-md text-white hover:bg-white/40 transition-all hover:scale-110"
                      >
                        {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-0.5" />}
                      </button>

                      <button
                        onClick={() => setIsMuted(!isMuted)}
                        className="p-3 rounded-full bg-white/20 backdrop-blur-md text-white hover:bg-white/40 transition-all hover:scale-110"
                      >
                        {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                      </button>
                    </div>

                    {/* BADGES ON VIDEO */}
                    <div className="absolute top-3 left-3 px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-md text-[10px] font-bold text-white tracking-wider uppercase">
                      {activeVideo.resolution} • {activeVideo.aspectRatio}
                    </div>
                  </div>
                ) : (
                  <div className="text-center p-8 space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto text-zinc-600 dark:text-zinc-500">
                      <Video className="w-6 h-6" />
                    </div>
                    <p className="text-xs font-semibold text-zinc-400">
                      Generated video preview will appear here
                    </p>
                    <p className="text-[11px] text-zinc-600 max-w-xs mx-auto">
                      Enter a prompt and select your parameters to create a video with OpenAI Sora.
                    </p>
                  </div>
                )}
              </div>

              {/* ACTIVE VIDEO DETAILS & ACTIONS */}
              {activeVideo && (
                <div className="space-y-3 pt-2">
                  <p className="text-xs text-zinc-700 dark:text-zinc-300 font-medium leading-relaxed bg-zinc-50 dark:bg-zinc-950 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800/80">
                    &ldquo;{activeVideo.prompt}&rdquo;
                  </p>

                  <div className="flex items-center justify-between text-xs pt-1">
                    <span className="text-zinc-400 font-mono text-[11px]">
                      Sora v1.0 • {activeVideo.duration}
                    </span>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(activeVideo.prompt);
                          toast.success('Prompt copied to clipboard');
                        }}
                        className="p-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 transition-all"
                        title="Copy Prompt"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => {
                          toast.info('Downloading MP4 video file...');
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-all shadow-sm"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Export MP4</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* RECENT GENERATIONS HISTORY */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-indigo-500" />
                <span>Recent Studio Generations</span>
              </h3>

              <div className="space-y-2">
                {history.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => {
                      setActiveVideo(item);
                      setIsPlaying(true);
                    }}
                    className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center gap-3 ${
                      activeVideo?.id === item.id
                        ? 'bg-indigo-50/70 dark:bg-indigo-950/40 border-indigo-500/50'
                        : 'bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800/80 hover:border-zinc-300 dark:hover:border-zinc-700'
                    }`}
                  >
                    <div className="w-12 h-12 shrink-0 rounded-lg bg-zinc-900 flex items-center justify-center text-indigo-400 relative overflow-hidden">
                      <Film className="w-5 h-5" />
                      <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                        <Play className="w-3.5 h-3.5 text-white" />
                      </div>
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                        {item.prompt}
                      </p>
                      <div className="flex items-center gap-2 mt-1 text-[10px] text-zinc-500 dark:text-zinc-400">
                        <span>{item.duration}</span>
                        <span>•</span>
                        <span>{item.resolution}</span>
                        <span>•</span>
                        <span className="uppercase">{item.aspectRatio}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>

        </div>

      </main>

      {/* MEDIA LIBRARY MODAL */}
      <LibraryModal
        isOpen={showLibraryModal}
        onClose={() => setShowLibraryModal(false)}
        extraGeneratedFiles={history.map((item): MediaFileItem => ({
          id: item.id,
          name: item.prompt.slice(0, 40) + '...',
          type: 'video',
          category: 'generated',
          createdAt: item.created_at,
          url: item.videoUrl,
          duration: item.duration,
          resolution: item.resolution,
          fileFormat: 'MP4',
          modelUsed: 'OpenAI Sora',
          prompt: item.prompt
        }))}
        onSelectFile={(selected) => {
          if (selected.type === 'video' && selected.url) {
            setActiveVideo({
              id: selected.id,
              created_at: selected.createdAt,
              prompt: selected.prompt || selected.name,
              model: selected.modelUsed || 'Sora AI',
              duration: selected.duration || '10s',
              resolution: selected.resolution || '1080p',
              aspectRatio: '16:9',
              status: 'completed',
              videoUrl: selected.url
            });
            setIsPlaying(true);
          }
        }}
      />
    </div>
  );
};
