import React, { useState, useEffect, useRef } from 'react';
import { 
  Video, 
  Film, 
  Sparkles, 
  Play, 
  Pause, 
  Download, 
  Lock, 
  Crown, 
  Clock, 
  ChevronDown, 
  Check, 
  ArrowLeft, 
  RefreshCw, 
  X, 
  Folder,
  Search,
  Plus,
  ArrowRight,
  SlidersHorizontal,
  Image as ImageIcon,
  Music,
  Settings2,
  Volume2,
  VolumeX
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
  { id: '16:9', label: '16:9', name: 'Widescreen', icon: '🖥️' },
  { id: '9:16', label: '9:16', name: 'Portrait', icon: '📱' },
  { id: '1:1', label: '1:1', name: 'Square', icon: '⏹️' },
  { id: '21:9', label: '21:9', name: 'Cinematic', icon: '🎬' },
];

const DURATIONS = ['5s', '6s', '10s', '15s', '20s'];
const RESOLUTIONS = ['720p', '1080p', '4K'];
const OUTPUT_COUNTS = ['x1', 'x2', 'x4'];

// Pixel Flower Graphic inspired by Google Flow AI
const PixelFlowerIcon = () => (
  <svg width="64" height="64" viewBox="0 0 24 24" fill="none" className="mx-auto text-zinc-100 dark:text-zinc-200">
    <path 
      d="M10 2h4v2h-4V2zm-2 2h2v2H8V4zm8 0h-2v2h2V4zm-8 2H6v2h2V6zm10 0h-2v2h2V6zm-2 2H8v8h8V8zm-6 2h4v4h-4v-4zm-4 0H4v4h2v-4zm14 0h-2v4h2v-4zm-4 6H8v2h8v-2zm-6 2H8v2h2v-2zm8 0h-2v2h2v-2zm-6 2h4v2h-4v-2z" 
      fill="currentColor"
    />
  </svg>
);

export const VideoStudioView: React.FC<VideoStudioViewProps> = ({
  profile,
  onUpgradeClick,
  onBack
}) => {
  const isPlusOrPro = profile?.plan === 'plus' || profile?.plan === 'pro';

  const [prompt, setPrompt] = useState('');
  const [selectedModel, setSelectedModel] = useState('sora-v1-hd');
  const [selectedDuration, setSelectedDuration] = useState('6s');
  const [selectedResolution, setSelectedResolution] = useState('1080p');
  const [selectedAspectRatio, setSelectedAspectRatio] = useState('9:16');
  const [creationType, setCreationType] = useState<'video' | 'image' | 'audio'>('video');
  const [outputCount, setOutputCount] = useState('x2');

  // UI Popover & Modal States
  const [showFlowSettingsPopover, setShowFlowSettingsPopover] = useState(false);
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);
  const [showLibraryModal, setShowLibraryModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Advanced camera settings
  const [fps] = useState('24 fps');
  const [cameraMotion] = useState('Smooth Pan');
  const [motionStrength] = useState(0.7);

  // Generation & playback state
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationPhase, setGenerationPhase] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Video History & Active Video
  const [activeVideo, setActiveVideo] = useState<VideoGenerationItem | null>(null);

  const [history, setHistory] = useState<VideoGenerationItem[]>([
    {
      id: 'sora-demo-1',
      created_at: new Date().toISOString(),
      prompt: 'A neon-lit cyberpunk street in Tokyo during a rainstorm, reflections on wet pavement, cinematic 8k',
      model: 'sora-v1-hd',
      duration: '6s',
      resolution: '1080p',
      aspectRatio: '9:16',
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
            duration: v.duration || '6s',
            resolution: v.resolution || '1080p',
            aspectRatio: v.aspectRatio || '9:16',
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

  const handleGenerate = async () => {
    if (!isPlusOrPro) {
      onUpgradeClick?.();
      return;
    }

    if (!prompt.trim()) {
      toast.error('Please enter a prompt before generating');
      return;
    }

    setIsGenerating(true);
    setShowFlowSettingsPopover(false);
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

  const getAspectIcon = (ratio: string) => {
    switch (ratio) {
      case '9:16': return '📱';
      case '16:9': return '🖥️';
      case '1:1': return '⏹️';
      case '21:9': return '🎬';
      default: return '📱';
    }
  };

  return (
    <div className="flex-1 flex flex-col h-screen bg-zinc-950 text-zinc-100 overflow-hidden relative font-sans select-none">
      
      {/* 1. TOP HEADER BAR (Google Flow Style) */}
      <header className="sticky top-0 z-40 flex items-center justify-between px-6 py-4 bg-zinc-950/90 backdrop-blur-md border-b border-zinc-900/60">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="p-2.5 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-900 transition-all"
              title="Return to Chat"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}

          <div className="flex items-center gap-2">
            <span className="text-sm font-bold tracking-tight text-white">
              Google Flow Studio
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              Sora AI
            </span>
          </div>
        </div>

        {/* SEARCH BAR CENTER */}
        <div className="hidden md:flex items-center relative w-full max-w-sm">
          <Search className="w-4 h-4 absolute left-3.5 text-zinc-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search prompts..."
            className="w-full pl-10 pr-4 py-2 bg-zinc-900 border border-zinc-800 rounded-full text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-700 transition-all"
          />
        </div>

        {/* TOP RIGHT CONTROLS */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setShowHistoryDrawer(!showHistoryDrawer)}
            className="p-2.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded-full transition-all border border-zinc-800"
            title="Generations History"
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>

          {!isPlusOrPro && (
            <button
              onClick={onUpgradeClick}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 text-zinc-950 rounded-full text-xs font-bold shadow-sm transition-all hover:brightness-110"
            >
              <Crown className="w-3.5 h-3.5 fill-current" />
              <span>Upgrade</span>
            </button>
          )}
        </div>
      </header>

      {/* 2. MAIN STAGE / CANVAS AREA */}
      <main className="flex-1 relative flex flex-col items-center justify-center p-6 overflow-hidden">
        
        {activeVideo?.videoUrl ? (
          /* ACTIVE VIDEO CANVAS PLAYER */
          <div className="relative w-full max-w-2xl aspect-video rounded-3xl bg-black border border-zinc-800/80 overflow-hidden shadow-2xl flex items-center justify-center group">
            <video
              src={activeVideo.videoUrl}
              className="w-full h-full object-cover"
              controls={false}
              autoPlay={isPlaying}
              loop
              muted={isMuted}
            />

            {/* OVERLAY PLAYBACK CONTROLS */}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4 backdrop-blur-xs">
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className="p-4 rounded-full bg-white/20 backdrop-blur-md text-white hover:bg-white/30 transition-all hover:scale-110"
              >
                {isPlaying ? <Pause className="w-7 h-7" /> : <Play className="w-7 h-7 ml-0.5" />}
              </button>

              <button
                onClick={() => setIsMuted(!isMuted)}
                className="p-4 rounded-full bg-white/20 backdrop-blur-md text-white hover:bg-white/30 transition-all hover:scale-110"
              >
                {isMuted ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
              </button>
            </div>

            {/* TOP METADATA BADGE */}
            <div className="absolute top-4 left-4 px-3 py-1 rounded-xl bg-black/60 backdrop-blur-md text-[11px] font-bold text-zinc-200 border border-white/10 uppercase tracking-wider flex items-center gap-2">
              <span>{activeVideo.duration}</span>
              <span>•</span>
              <span>{getAspectIcon(activeVideo.aspectRatio)} {activeVideo.aspectRatio}</span>
              <span>•</span>
              <span className="text-indigo-400 font-mono">{activeVideo.resolution}</span>
            </div>

            {/* TOP RIGHT CLOSE / DESELECT */}
            <button
              onClick={() => setActiveVideo(null)}
              className="absolute top-4 right-4 p-2 rounded-xl bg-black/60 hover:bg-black/80 backdrop-blur-md text-zinc-400 hover:text-white transition-colors"
              title="Clear Canvas"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          /* EMPTY STAGE: GOOGLE FLOW PIXEL GRAPHIC & DROP AREA */
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center justify-center text-center space-y-4 max-w-md p-8 cursor-pointer rounded-3xl hover:bg-zinc-900/30 transition-all group"
          >
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              multiple
              accept="video/*,image/*,audio/*"
              onChange={() => toast.success('Media added to Library!')}
            />

            <div className="p-4 rounded-3xl bg-transparent group-hover:scale-105 transition-transform">
              <PixelFlowerIcon />
            </div>

            <div className="space-y-1">
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-200 group-hover:text-white transition-colors">
                Start creating or drop media
              </h2>
            </div>
          </div>
        )}

      </main>

      {/* 3. FLOATING BOTTOM PROMPT BAR & SETTINGS PILL (EXACT GOOGLE FLOW STYLE) */}
      <div className="sticky bottom-6 z-40 px-4 sm:px-6 max-w-2xl mx-auto w-full">
        
        {/* GOOGLE FLOW SETTINGS POPOVER DROPDOWN MENU */}
        <AnimatePresence>
          {showFlowSettingsPopover && (
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              className="absolute bottom-full mb-3 left-0 right-0 mx-auto w-full max-w-md bg-zinc-900/95 border border-zinc-800 rounded-3xl shadow-2xl p-5 space-y-4 z-50 text-zinc-100 backdrop-blur-xl"
            >
              <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2.5">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                  <Settings2 className="w-4 h-4 text-indigo-400" />
                  <span>Google Flow Settings</span>
                </span>
                <button
                  onClick={() => setShowFlowSettingsPopover(false)}
                  className="p-1 text-zinc-500 hover:text-zinc-200 rounded-lg transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* 1. CREATION TYPE */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                  Type
                </label>
                <div className="grid grid-cols-3 gap-1.5 bg-zinc-950 p-1 rounded-2xl border border-zinc-800/80">
                  {[
                    { id: 'video', label: 'Video', icon: Film },
                    { id: 'image', label: 'Image', icon: ImageIcon },
                    { id: 'audio', label: 'Audio', icon: Music },
                  ].map((item) => {
                    const Icon = item.icon;
                    const isSelected = creationType === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setCreationType(item.id as any)}
                        className={`flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-xl transition-all ${
                          isSelected
                            ? 'bg-zinc-800 text-white shadow-sm'
                            : 'text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. DURATION & ASPECT RATIO */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                
                {/* DURATION */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider flex items-center justify-between">
                    <span>Duration</span>
                    <span className="text-indigo-400 font-mono">{selectedDuration}</span>
                  </label>
                  <div className="grid grid-cols-5 gap-1 bg-zinc-950 p-1 rounded-2xl border border-zinc-800/80">
                    {DURATIONS.map((dur) => (
                      <button
                        key={dur}
                        type="button"
                        onClick={() => setSelectedDuration(dur)}
                        className={`py-1.5 text-[11px] font-bold rounded-xl transition-all ${
                          selectedDuration === dur
                            ? 'bg-indigo-600 text-white shadow-sm'
                            : 'text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        {dur}
                      </button>
                    ))}
                  </div>
                </div>

                {/* ASPECT RATIO */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider flex items-center justify-between">
                    <span>Aspect Ratio</span>
                    <span className="text-indigo-400 font-mono">{selectedAspectRatio}</span>
                  </label>
                  <div className="grid grid-cols-4 gap-1 bg-zinc-950 p-1 rounded-2xl border border-zinc-800/80">
                    {ASPECT_RATIOS.map((ratio) => (
                      <button
                        key={ratio.id}
                        type="button"
                        onClick={() => setSelectedAspectRatio(ratio.id)}
                        className={`py-1.5 text-[10px] font-bold rounded-xl transition-all flex items-center justify-center gap-1 ${
                          selectedAspectRatio === ratio.id
                            ? 'bg-indigo-600 text-white shadow-sm'
                            : 'text-zinc-400 hover:text-zinc-200'
                        }`}
                        title={ratio.name}
                      >
                        <span>{ratio.icon}</span>
                        <span>{ratio.id}</span>
                      </button>
                    ))}
                  </div>
                </div>

              </div>

              {/* 3. OUTPUT GENERATIONS & RESOLUTION */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                
                {/* OUTPUT COUNT */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                    Output Count
                  </label>
                  <div className="grid grid-cols-3 gap-1 bg-zinc-950 p-1 rounded-2xl border border-zinc-800/80">
                    {OUTPUT_COUNTS.map((cnt) => (
                      <button
                        key={cnt}
                        type="button"
                        onClick={() => setOutputCount(cnt)}
                        className={`py-1.5 text-xs font-bold rounded-xl transition-all ${
                          outputCount === cnt
                            ? 'bg-zinc-800 text-white shadow-sm'
                            : 'text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        {cnt}
                      </button>
                    ))}
                  </div>
                </div>

                {/* RESOLUTION */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                    Resolution
                  </label>
                  <div className="grid grid-cols-3 gap-1 bg-zinc-950 p-1 rounded-2xl border border-zinc-800/80">
                    {RESOLUTIONS.map((res) => (
                      <button
                        key={res}
                        type="button"
                        onClick={() => setSelectedResolution(res)}
                        className={`py-1.5 text-[11px] font-bold rounded-xl transition-all ${
                          selectedResolution === res
                            ? 'bg-zinc-800 text-white shadow-sm'
                            : 'text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        {res}
                      </button>
                    ))}
                  </div>
                </div>

              </div>

              {/* 4. MODEL SELECTION */}
              <div className="space-y-1.5 pt-1 border-t border-zinc-800/80">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                  Model Engine
                </label>
                <div className="grid grid-cols-1 gap-1">
                  {SORA_MODELS.map((model) => (
                    <button
                      key={model.id}
                      type="button"
                      onClick={() => setSelectedModel(model.id)}
                      className={`p-2 rounded-xl border text-left transition-all flex items-center justify-between ${
                        selectedModel === model.id
                          ? 'bg-indigo-950/40 border-indigo-500/60 text-white'
                          : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                      }`}
                    >
                      <div>
                        <div className="text-xs font-bold flex items-center gap-2">
                          <span>{model.name}</span>
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-zinc-800 text-indigo-400 font-mono uppercase">
                            {model.badge}
                          </span>
                        </div>
                      </div>
                      {selectedModel === model.id && <Check className="w-3.5 h-3.5 text-indigo-400 shrink-0" />}
                    </button>
                  ))}
                </div>
              </div>

            </motion.div>
          )}
        </AnimatePresence>

        {/* FLOATING PROMPT CARD CONTAINER */}
        <div className="bg-zinc-900/90 backdrop-blur-xl border border-zinc-800/90 rounded-3xl p-4 shadow-2xl flex flex-col space-y-3 relative group focus-within:border-zinc-700 transition-all">
          
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="What do you want to create?"
            rows={2}
            className="w-full bg-transparent text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none resize-none leading-relaxed px-2"
          />

          {/* PROGRESS BAR IF GENERATING */}
          {isGenerating && (
            <div className="space-y-1.5 px-2">
              <div className="flex justify-between text-[11px] font-semibold text-zinc-400">
                <span className="animate-pulse">{generationPhase}</span>
                <span className="font-mono text-indigo-400">{generationProgress}%</span>
              </div>
              <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                <motion.div
                  className="bg-gradient-to-r from-indigo-500 to-purple-500 h-full rounded-full"
                  animate={{ width: `${generationProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* BOTTOM CONTROLS ROW */}
          <div className="flex items-center justify-between pt-1 border-t border-zinc-800/50">
            
            {/* LEFT CONTROLS: + Attachment & Agent Pill */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-2.5 rounded-full bg-zinc-800/80 hover:bg-zinc-700/80 text-zinc-300 hover:text-white transition-all"
                title="Attach or Drop Media"
              >
                <Plus className="w-4 h-4" />
              </button>

              <div className="px-3.5 py-1.5 rounded-full bg-zinc-800/80 text-zinc-300 text-xs font-semibold flex items-center gap-1.5">
                <span>Agent</span>
              </div>
            </div>

            {/* RIGHT CONTROLS: GOOGLE FLOW SETTINGS PILL & SUBMIT ARROW */}
            <div className="flex items-center gap-2">
              
              {/* GOOGLE FLOW SETTINGS PILL BUTTON: "Video · 6s  📱 x2" */}
              <button
                type="button"
                onClick={() => setShowFlowSettingsPopover(!showFlowSettingsPopover)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all border ${
                  showFlowSettingsPopover
                    ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm'
                    : 'bg-zinc-800/90 hover:bg-zinc-700/90 text-zinc-200 border-zinc-700/60'
                }`}
              >
                <span className="capitalize">Video</span>
                <span>•</span>
                <span>{selectedDuration}</span>
                <span className="text-sm">{getAspectIcon(selectedAspectRatio)}</span>
                <span className="text-zinc-400 font-mono text-[11px]">{outputCount}</span>
              </button>

              {/* SUBMIT ARROW BUTTON */}
              <button
                type="button"
                onClick={handleGenerate}
                disabled={isGenerating}
                className={`p-2.5 rounded-full transition-all shadow-md flex items-center justify-center ${
                  isGenerating
                    ? 'bg-zinc-800 text-zinc-500 cursor-wait'
                    : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white hover:scale-105 active:scale-95'
                }`}
                title="Generate Video"
              >
                {isGenerating ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <ArrowRight className="w-4 h-4" />
                )}
              </button>

            </div>

          </div>

        </div>

      </div>

      {/* RECENT HISTORY DRAWER (SIDE OVERLAY) */}
      <AnimatePresence>
        {showHistoryDrawer && (
          <motion.div
            initial={{ opacity: 0, x: 300 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 300 }}
            className="fixed top-0 right-0 bottom-0 w-80 bg-zinc-900 border-l border-zinc-800 p-6 z-50 overflow-y-auto shadow-2xl flex flex-col space-y-4"
          >
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-indigo-400" />
                <span>Generations History</span>
              </h3>
              <button
                onClick={() => setShowHistoryDrawer(false)}
                className="p-1 text-zinc-400 hover:text-white rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 flex-1">
              {history.map((item) => (
                <div
                  key={item.id}
                  onClick={() => {
                    setActiveVideo(item);
                    setIsPlaying(true);
                    setShowHistoryDrawer(false);
                  }}
                  className={`p-3 rounded-2xl border transition-all cursor-pointer space-y-1.5 ${
                    activeVideo?.id === item.id
                      ? 'bg-indigo-950/40 border-indigo-500/50 text-white'
                      : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                  }`}
                >
                  <p className="text-xs font-semibold line-clamp-2">{item.prompt}</p>
                  <div className="flex items-center justify-between text-[10px] text-zinc-500 font-mono">
                    <span>{item.duration} • {item.resolution}</span>
                    <span className="uppercase">{item.aspectRatio}</span>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
};
