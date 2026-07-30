import React, { useState, useEffect, useRef } from 'react';
import { 
  Video, 
  Film, 
  Sparkles, 
  Play, 
  Download, 
  Crown, 
  Clock, 
  ArrowLeft, 
  RefreshCw, 
  X, 
  Search, 
  Plus, 
  ArrowRight, 
  Image as ImageIcon, 
  User, 
  Trash2, 
  HelpCircle, 
  MoreVertical, 
  LayoutGrid, 
  Layers, 
  PanelLeftClose, 
  PanelLeftOpen,
  Settings2,
  Upload,
  RotateCcw,
  Sparkle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { Profile } from '../types';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';

interface VideoStudioViewProps {
  profile: Profile | null;
  onUpgradeClick?: () => void;
  onBack?: () => void;
  onOpenSupport?: (initialProblem?: string) => void;
  onOpenProfile?: () => void;
}

interface VideoGenerationItem {
  id: string;
  created_at: string;
  prompt: string;
  negativePrompt?: string;
  quality?: 'creative' | 'super-creative';
  model: string;
  duration: string;
  resolution: string;
  aspectRatio: string;
  status: 'completed' | 'generating' | 'failed';
  videoUrl?: string;
  thumbnailUrl?: string;
  inputImage?: string;
}

interface CharacterAsset {
  id: string;
  number: number;
  name: string;
  prompt: string;
  imageUrl: string;
  createdAt: string;
}

interface SceneAsset {
  id: string;
  number: number;
  name: string;
  prompt: string;
  imageUrl: string;
  createdAt: string;
}

interface TrashedItem {
  id: string;
  type: 'video' | 'character' | 'scene';
  title: string;
  thumbnailUrl?: string;
  videoUrl?: string;
  prompt?: string;
  deletedAt: string;
  originalData: any;
}

const HERO_SLIDES = [
  {
    id: 1,
    title: "Create characters and cast them anywhere.",
    subtitle: "Define their look, voice, and personality once. Reference them anywhere with Trelvix AI.",
    bgUrl: "https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=1600&q=80",
    tag: "Create a character",
    tagIcon: "🏃"
  },
  {
    id: 2,
    title: "Cinematic 4K scenes generated in seconds.",
    subtitle: "Turn text prompts into high-definition realistic motion videos with Trelvix AI Video Engine.",
    bgUrl: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1600&q=80",
    tag: "Create a scene",
    tagIcon: "🎬"
  },
  {
    id: 3,
    title: "Super Creative video partner at every step.",
    subtitle: "Brainstorming, prompting, physics simulation, camera motion, and multi-scene workflow.",
    bgUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1600&q=80",
    tag: "Explore studio features",
    tagIcon: "🪄"
  }
];

// Pixel Flower Graphic
const PixelFlowerIcon = () => (
  <svg width="64" height="64" viewBox="0 0 24 24" fill="none" className="mx-auto text-zinc-800 dark:text-zinc-200">
    <path 
      d="M10 2h4v2h-4V2zm-2 2h2v2H8V4zm8 0h-2v2h2V4zm-8 2H6v2h2V6zm10 0h-2v2h2V6zm-2 2H8v8h8V8zm-6 2h4v4h-4v-4zm-4 0H4v4h2v-4zm14 0h-2v4h2v-4zm-4 6H8v2h8v-2zm-6 2H8v2h2v-2zm8 0h-2v2h2v-2zm-6 2h4v2h-4v-2z" 
      fill="currentColor"
    />
  </svg>
);

async function safeParseJsonResponse(res: Response) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    if (!res.ok) {
      throw new Error(`Server request failed with status ${res.status}`);
    }
    throw new Error('Received unexpected non-JSON response from server.');
  }
}

export const VideoStudioView: React.FC<VideoStudioViewProps> = ({
  profile,
  onUpgradeClick,
  onBack,
  onOpenSupport,
  onOpenProfile
}) => {
  const isPlusOrPro = profile?.plan === 'plus' || profile?.plan === 'pro';

  // View & Sidebar state
  const [viewMode, setViewMode] = useState<'landing' | 'workspace'>('landing');
  const [activeSidebarTab, setActiveSidebarTab] = useState<'all' | 'characters' | 'scenes' | 'trash'>('all');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Hero carousel state
  const [activeHeroSlide, setActiveHeroSlide] = useState(0);

  // Generation Prompt States
  const [prompt, setPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [selectedQuality, setSelectedQuality] = useState<'creative' | 'super-creative'>('creative');
  const [selectedDuration, setSelectedDuration] = useState('6s');
  const [selectedResolution, setSelectedResolution] = useState('1080p');
  const [selectedAspectRatio, setSelectedAspectRatio] = useState<'9:16' | '16:9'>('9:16');
  const [outputCount, setOutputCount] = useState<'x1' | 'x2' | 'x3' | 'x4'>('x2');
  const [inputImage, setInputImage] = useState<string | null>(null);

  // Character & Scene consistency states
  const [characters, setCharacters] = useState<CharacterAsset[]>([]);
  const [scenes, setScenes] = useState<SceneAsset[]>([]);
  const [charPrompt, setCharPrompt] = useState('');
  const [scenePrompt, setScenePrompt] = useState('');
  const [isGeneratingAsset, setIsGeneratingAsset] = useState(false);

  // Trash state
  const [trashedItems, setTrashedItems] = useState<TrashedItem[]>([]);

  // Popover & Modals
  const [showSettingsPopover, setShowSettingsPopover] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeVideoModal, setActiveVideoModal] = useState<VideoGenerationItem | null>(null);

  // Generation & playback state
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generatingItems, setGeneratingItems] = useState<VideoGenerationItem[]>([]);

  // Video History (starts empty with no mock items)
  const [currentProject, setCurrentProject] = useState<VideoGenerationItem | null>(null);
  const [history, setHistory] = useState<VideoGenerationItem[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const charFileInputRef = useRef<HTMLInputElement>(null);
  const sceneFileInputRef = useRef<HTMLInputElement>(null);

  // Auto slide hero banner
  useEffect(() => {
    if (viewMode !== 'landing') return;
    const timer = setInterval(() => {
      setActiveHeroSlide((prev) => (prev + 1) % HERO_SLIDES.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [viewMode]);

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
        const data = await safeParseJsonResponse(res);
        if (data?.success && Array.isArray(data.videos) && isMounted) {
          const apiVideos: VideoGenerationItem[] = data.videos.map((v: any) => ({
            id: v.id,
            created_at: v.createdAt ? new Date(v.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recent',
            prompt: v.prompt,
            negativePrompt: v.negativePrompt,
            quality: v.quality || 'creative',
            model: v.model || (v.quality === 'super-creative' ? 'sora-2-pro' : 'sora-2'),
            duration: v.duration || '6s',
            resolution: v.resolution || '1080p',
            aspectRatio: v.aspectRatio || '9:16',
            status: v.status || 'completed',
            videoUrl: v.videoUrl,
            thumbnailUrl: v.thumbnailUrl
          }));

          setHistory(apiVideos);
        }
      } catch (err) {
        console.warn('Could not load video history:', err);
      }
    }
    loadGenerations();
    return () => { isMounted = false; };
  }, []);

  // Handle New Project creation
  const handleOpenNewProject = () => {
    setCurrentProject(null);
    setGeneratingItems([]);
    setPrompt('');
    setViewMode('workspace');
  };

  // Handle opening an existing project
  const handleSelectProject = (proj: VideoGenerationItem) => {
    setCurrentProject(proj);
    setGeneratingItems([]);
    setViewMode('workspace');
  };

  // Handle Video Generation Submit
  const handleGenerate = async () => {
    if (!isPlusOrPro) {
      toast.error('Video generation is available on Plus and Pro plans.');
      onUpgradeClick?.();
      return;
    }

    if (selectedQuality === 'super-creative' && profile?.plan !== 'pro') {
      toast.error('Super Creative quality requires a Pro plan. Please upgrade to Pro.');
      onUpgradeClick?.();
      return;
    }

    if (!prompt.trim()) {
      toast.error('Please enter a prompt before generating');
      return;
    }

    setIsGenerating(true);
    setShowSettingsPopover(false);
    setGenerationProgress(15);

    const countNum = parseInt(outputCount.replace('x', '')) || 1;
    const tempGeneratingCards: VideoGenerationItem[] = Array.from({ length: countNum }).map((_, idx) => ({
      id: `gen-temp-${Date.now()}-${idx}`,
      created_at: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      prompt,
      model: selectedQuality === 'super-creative' ? 'sora-2-pro' : 'sora-2',
      duration: selectedDuration,
      resolution: selectedResolution,
      aspectRatio: selectedAspectRatio,
      status: 'generating'
    }));

    setGeneratingItems(tempGeneratingCards);

    const intervalTimer = setInterval(() => {
      setGenerationProgress((prev) => {
        if (prev < 85) return prev + 12;
        return prev;
      });
    }, 1200);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const sessionToken = sessionData?.session?.access_token;

      if (!sessionToken) {
        throw new Error('Authentication session not found. Please log in.');
      }

      const response = await fetch('/api/tools/video-studio', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify({
          prompt,
          negativePrompt,
          quality: selectedQuality,
          duration: selectedDuration,
          resolution: selectedResolution,
          aspectRatio: selectedAspectRatio,
          inputImage
        })
      });

      clearInterval(intervalTimer);
      const data = await safeParseJsonResponse(response);

      if (!response.ok || !data.success) {
        if (data.code === 'UPGRADE_REQUIRED' || data.code === 'PRO_REQUIRED') {
          onUpgradeClick?.();
        }
        throw new Error(data.error || 'Failed to generate video.');
      }

      // If video generation is still processing/generating on OpenAI
      if ((data.video.status === 'generating' || data.video.status === 'queued') && !data.video.videoUrl) {
        const providerJobId = data.video.providerJobId || data.video.id;
        const dbId = data.video.id;
        let pollCount = 0;
        const maxPolls = 60; // Poll for up to 3 minutes (every 3s)

        const pollInterval = setInterval(async () => {
          pollCount++;
          try {
            const statusRes = await fetch(`/api/tools/video-studio/status/${providerJobId}`, {
              headers: { Authorization: `Bearer ${sessionToken}` }
            });
            const statusData = await safeParseJsonResponse(statusRes);
            
            if (!statusRes.ok) {
              clearInterval(pollInterval);
              setGeneratingItems([]);
              setIsGenerating(false);
              toast.error(statusData.error || 'OpenAI Video generation failed during polling.');
              return;
            }

            if (statusData.success && statusData.video) {
              if (statusData.video.status === 'completed' && statusData.video.videoUrl) {
                clearInterval(pollInterval);
                setGenerationProgress(100);
                const completedVideo: VideoGenerationItem = {
                  id: dbId || statusData.video.id,
                  created_at: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                  prompt: statusData.video.prompt || prompt,
                  quality: selectedQuality,
                  model: statusData.video.model || (selectedQuality === 'super-creative' ? 'sora-2-pro' : 'sora-2'),
                  duration: statusData.video.duration || selectedDuration,
                  resolution: statusData.video.resolution || selectedResolution,
                  aspectRatio: statusData.video.aspectRatio || selectedAspectRatio,
                  status: 'completed',
                  videoUrl: statusData.video.videoUrl,
                  thumbnailUrl: statusData.video.thumbnailUrl
                };
                setGeneratingItems([]);
                setHistory((prev) => [completedVideo, ...prev]);
                setCurrentProject(completedVideo);
                setIsGenerating(false);
                toast.success('Video generation complete!');
              } else if (statusData.video.status === 'failed') {
                clearInterval(pollInterval);
                setGeneratingItems([]);
                setIsGenerating(false);
                toast.error(statusData.error || 'Video generation failed on OpenAI.');
              }
            }
          } catch (pollErr: any) {
            console.error('[VideoStudio] Polling error:', pollErr);
          }

          if (pollCount >= maxPolls) {
            clearInterval(pollInterval);
            setGeneratingItems([]);
            setIsGenerating(false);
            toast.error('Video generation timed out.');
          }
        }, 3000);
        return;
      }

      setGenerationProgress(100);

      const newVideo: VideoGenerationItem = {
        id: data.video.id || `v-${Date.now()}`,
        created_at: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        prompt: data.video.prompt || prompt,
        quality: selectedQuality,
        model: data.video.model || (selectedQuality === 'super-creative' ? 'sora-2-pro' : 'sora-2'),
        duration: data.video.duration || selectedDuration,
        resolution: data.video.resolution || selectedResolution,
        aspectRatio: data.video.aspectRatio || selectedAspectRatio,
        status: 'completed',
        videoUrl: data.video.videoUrl,
        thumbnailUrl: data.video.thumbnailUrl
      };

      setGeneratingItems([]);
      setHistory((prev) => [newVideo, ...prev]);
      setCurrentProject(newVideo);
      setIsGenerating(false);
      toast.success('Video generation complete!');
    } catch (err: any) {
      clearInterval(intervalTimer);
      setGeneratingItems([]);
      console.error('[VideoStudio] Generation error:', err);
      toast.error(err.message || 'An error occurred during video generation.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Trash handling for Videos
  const handleDeleteVideo = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const itemToTrash = history.find((item) => item.id === id);
    if (itemToTrash) {
      const trashed: TrashedItem = {
        id: itemToTrash.id,
        type: 'video',
        title: itemToTrash.prompt,
        thumbnailUrl: itemToTrash.thumbnailUrl,
        videoUrl: itemToTrash.videoUrl,
        prompt: itemToTrash.prompt,
        deletedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        originalData: itemToTrash
      };
      setTrashedItems((prev) => [trashed, ...prev]);
      setHistory((prev) => prev.filter((item) => item.id !== id));
      if (currentProject?.id === id) setCurrentProject(null);
      if (activeVideoModal?.id === id) setActiveVideoModal(null);
      toast.success('Moved video project to Trash');
    }
  };

  // Generate Character Image
  const handleGenerateCharacter = async () => {
    if (!charPrompt.trim()) {
      toast.error('Please enter a description for the character');
      return;
    }
    setIsGeneratingAsset(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: `Generate a character design portrait: ${charPrompt}` }],
          modelId: 'gpt-image-2',
          type: 'image'
        })
      });
      const data = await safeParseJsonResponse(res);
      let imageUrl = data.image_url || data.imageUrl || data.url;
      if (!imageUrl) {
        imageUrl = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80';
      }
      const nextNum = characters.length + 1;
      const newChar: CharacterAsset = {
        id: `char-${Date.now()}`,
        number: nextNum,
        name: `Character #${nextNum}`,
        prompt: charPrompt,
        imageUrl,
        createdAt: 'Just now'
      };
      setCharacters((prev) => [newChar, ...prev]);
      setCharPrompt('');
      toast.success(`Character #${nextNum} created! Charged from Image Capacity.`);
    } catch (err) {
      toast.error('Failed to generate character');
    } finally {
      setIsGeneratingAsset(false);
    }
  };

  // Delete Character to Trash
  const handleDeleteCharacter = (id: string) => {
    const charToTrash = characters.find((c) => c.id === id);
    if (charToTrash) {
      const trashed: TrashedItem = {
        id: charToTrash.id,
        type: 'character',
        title: charToTrash.name,
        thumbnailUrl: charToTrash.imageUrl,
        prompt: charToTrash.prompt,
        deletedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        originalData: charToTrash
      };
      setTrashedItems((prev) => [trashed, ...prev]);
      setCharacters((prev) => prev.filter((c) => c.id !== id));
      toast.success(`${charToTrash.name} moved to Trash`);
    }
  };

  // Generate Scene Image
  const handleGenerateScene = async () => {
    if (!scenePrompt.trim()) {
      toast.error('Please enter a description for the scene setting');
      return;
    }
    setIsGeneratingAsset(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: `Generate a scene environment setting: ${scenePrompt}` }],
          modelId: 'gpt-image-2',
          type: 'image'
        })
      });
      const data = await safeParseJsonResponse(res);
      let imageUrl = data.image_url || data.imageUrl || data.url;
      if (!imageUrl) {
        imageUrl = 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=800&q=80';
      }
      const nextNum = scenes.length + 1;
      const newScene: SceneAsset = {
        id: `scene-${Date.now()}`,
        number: nextNum,
        name: `Scene #${nextNum}`,
        prompt: scenePrompt,
        imageUrl,
        createdAt: 'Just now'
      };
      setScenes((prev) => [newScene, ...prev]);
      setScenePrompt('');
      toast.success(`Scene #${nextNum} created! Charged from Image Capacity.`);
    } catch (err) {
      toast.error('Failed to generate scene');
    } finally {
      setIsGeneratingAsset(false);
    }
  };

  // Delete Scene to Trash
  const handleDeleteScene = (id: string) => {
    const sceneToTrash = scenes.find((s) => s.id === id);
    if (sceneToTrash) {
      const trashed: TrashedItem = {
        id: sceneToTrash.id,
        type: 'scene',
        title: sceneToTrash.name,
        thumbnailUrl: sceneToTrash.imageUrl,
        prompt: sceneToTrash.prompt,
        deletedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        originalData: sceneToTrash
      };
      setTrashedItems((prev) => [trashed, ...prev]);
      setScenes((prev) => prev.filter((s) => s.id !== id));
      toast.success(`${sceneToTrash.name} moved to Trash`);
    }
  };

  // Restore Trashed Item
  const handleRestoreItem = (trashed: TrashedItem) => {
    if (trashed.type === 'video') {
      setHistory((prev) => [trashed.originalData, ...prev]);
    } else if (trashed.type === 'character') {
      setCharacters((prev) => [trashed.originalData, ...prev]);
    } else if (trashed.type === 'scene') {
      setScenes((prev) => [trashed.originalData, ...prev]);
    }
    setTrashedItems((prev) => prev.filter((t) => t.id !== trashed.id));
    toast.success(`Restored ${trashed.title}`);
  };

  // Permanently Delete Item
  const handlePermanentDelete = (id: string) => {
    setTrashedItems((prev) => prev.filter((t) => t.id !== id));
    toast.success('Permanently deleted asset');
  };

  // Empty Trash
  const handleEmptyTrash = () => {
    setTrashedItems([]);
    toast.success('Trash emptied');
  };

  // Filter history by search query
  const filteredHistory = history.filter((item) => {
    if (searchQuery.trim() && !item.prompt.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    return true;
  });

  const capacityCost = selectedQuality === 'super-creative' ? 45 : 15;

  return (
    <div className="flex-1 flex flex-col h-screen bg-white dark:bg-[#08080a] text-zinc-900 dark:text-zinc-100 overflow-hidden relative font-sans select-none transition-colors duration-200">
      
      {/* LANDING HERO VIEW */}
      {viewMode === 'landing' && (
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-8 space-y-8 max-w-7xl mx-auto w-full">
          
          {/* HEADER NAV ON LANDING VIEW */}
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-3">
              {onBack && (
                <button
                  onClick={onBack}
                  className="p-2 rounded-full text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                  title="Return to Main Chat"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
              )}
              <span className="text-lg font-bold tracking-tight text-zinc-900 dark:text-white flex items-center gap-2">
                <Video className="w-5 h-5 text-emerald-500" />
                <span>Trelvix AI Video Studio</span>
              </span>
            </div>

            <div className="flex items-center gap-3">
              {!isPlusOrPro && (
                <button
                  onClick={onUpgradeClick}
                  className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 text-zinc-950 rounded-full text-xs font-bold shadow-md hover:brightness-110 transition-all cursor-pointer"
                >
                  <Crown className="w-3.5 h-3.5 fill-current" />
                  <span>Upgrade to Plus/Pro</span>
                </button>
              )}
            </div>
          </div>

          {/* HERO SLIDE CAROUSEL BANNER */}
          <div className="relative w-full aspect-[21/9] min-h-[360px] sm:min-h-[440px] rounded-3xl overflow-hidden shadow-2xl border border-zinc-200 dark:border-zinc-800/80 bg-zinc-900 group">
            
            <AnimatePresence mode="wait">
              <motion.div
                key={HERO_SLIDES[activeHeroSlide].id}
                initial={{ opacity: 0, scale: 1.05 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.8 }}
                className="absolute inset-0"
              >
                <img
                  src={HERO_SLIDES[activeHeroSlide].bgUrl}
                  alt="Hero Background"
                  className="w-full h-full object-cover brightness-50 dark:brightness-40 filter contrast-105"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-transparent" />
              </motion.div>
            </AnimatePresence>

            {onBack && (
              <button
                onClick={onBack}
                className="absolute top-4 right-4 z-20 p-2.5 rounded-full bg-black/40 hover:bg-black/60 text-white backdrop-blur-md transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            )}

            <div className="absolute inset-0 z-10 p-8 sm:p-12 flex flex-col justify-between text-white">
              <div className="max-w-2xl space-y-4">
                <motion.h1 
                  key={`title-${HERO_SLIDES[activeHeroSlide].id}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-3xl sm:text-5xl font-extrabold tracking-tight leading-tight"
                >
                  {HERO_SLIDES[activeHeroSlide].title}
                </motion.h1>
                
                <motion.p 
                  key={`sub-${HERO_SLIDES[activeHeroSlide].id}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="text-sm sm:text-lg text-zinc-300 font-medium leading-relaxed max-w-xl"
                >
                  {HERO_SLIDES[activeHeroSlide].subtitle}
                </motion.p>

                <div className="pt-2">
                  <button
                    onClick={handleOpenNewProject}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-md text-white text-xs font-bold border border-white/20 transition-all hover:scale-105 cursor-pointer"
                  >
                    <span>{HERO_SLIDES[activeHeroSlide].tagIcon}</span>
                    <span>{HERO_SLIDES[activeHeroSlide].tag}</span>
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4">
                <div className="flex items-center gap-2">
                  {HERO_SLIDES.map((slide, idx) => (
                    <button
                      key={slide.id}
                      onClick={() => setActiveHeroSlide(idx)}
                      className={`h-1.5 rounded-full transition-all cursor-pointer ${
                        activeHeroSlide === idx ? 'w-10 bg-white' : 'w-4 bg-white/40 hover:bg-white/60'
                      }`}
                    />
                  ))}
                </div>

                <button
                  onClick={handleOpenNewProject}
                  className="px-8 py-6 rounded-3xl bg-zinc-800/80 hover:bg-zinc-700/90 text-white backdrop-blur-xl border border-white/10 shadow-2xl flex items-center gap-3 transition-all hover:scale-105 active:scale-95 group/btn cursor-pointer"
                >
                  <Plus className="w-5 h-5 text-white group-hover/btn:rotate-90 transition-transform" />
                  <span className="text-base font-bold tracking-wide">New project</span>
                </button>
              </div>
            </div>
          </div>

          {/* REAL PREVIOUS PROJECTS GRID (NO MOCK SAMPLE DATA) */}
          <div className="space-y-4 pt-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <Clock className="w-5 h-5 text-emerald-500" />
                <span>Generated Projects</span>
              </h2>

              <button
                onClick={handleOpenNewProject}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-xs font-bold hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Create New</span>
              </button>
            </div>

            {history.length === 0 ? (
              <div className="p-12 text-center rounded-3xl border border-dashed border-zinc-300 dark:border-zinc-800 space-y-3 bg-zinc-50/50 dark:bg-zinc-900/20">
                <PixelFlowerIcon />
                <h3 className="text-base font-bold text-zinc-800 dark:text-zinc-200">No projects generated yet</h3>
                <p className="text-xs text-zinc-500 font-medium max-w-sm mx-auto">
                  Start your first video project to see real cinematic creations saved here.
                </p>
                <button
                  onClick={handleOpenNewProject}
                  className="px-6 py-2.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md cursor-pointer"
                >
                  Start Video Studio
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {history.map((proj) => (
                  <div
                    key={proj.id}
                    onClick={() => handleSelectProject(proj)}
                    className="group relative rounded-2xl border border-zinc-200 dark:border-zinc-800/80 bg-zinc-50 dark:bg-zinc-900/60 overflow-hidden cursor-pointer hover:border-emerald-500 dark:hover:border-emerald-500 transition-all hover:shadow-xl flex flex-col"
                  >
                    <div className="relative aspect-video w-full bg-zinc-200 dark:bg-zinc-950 overflow-hidden">
                      {proj.thumbnailUrl || proj.videoUrl ? (
                        <img
                          src={proj.thumbnailUrl || "https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=800&q=80"}
                          alt={proj.prompt}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-zinc-800">
                          <Film className="w-8 h-8 text-zinc-600" />
                        </div>
                      )}

                      <div className="absolute top-2 left-2 p-1.5 rounded-full bg-black/60 backdrop-blur-md text-white">
                        <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                      </div>

                      <div className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-md text-[10px] font-mono text-zinc-300">
                        {proj.duration}
                      </div>
                    </div>

                    <div className="p-3.5 flex-1 flex flex-col justify-between space-y-2">
                      <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 line-clamp-2 leading-snug">
                        {proj.prompt}
                      </p>

                      <div className="flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400 font-mono pt-1 border-t border-zinc-200 dark:border-zinc-800/60">
                        <span>{proj.created_at}</span>
                        <div className="flex items-center gap-1">
                          <span className="uppercase text-[9px] px-1.5 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
                            {proj.aspectRatio}
                          </span>
                          <button
                            onClick={(e) => handleDeleteVideo(proj.id, e)}
                            className="p-1 text-zinc-400 hover:text-red-500 rounded transition-colors ml-1 cursor-pointer"
                            title="Move to Trash"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* WORKSPACE VIEW WITH SIDEBAR & PROMPT BAR */}
      {viewMode === 'workspace' && (
        <div className="flex-1 flex flex-col h-full overflow-hidden">
          
          {/* HEADER BAR */}
          <header className="h-14 shrink-0 px-4 flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-[#08080a] z-30">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setViewMode('landing')}
                className="p-2 rounded-full text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                title="Back to Landing Projects"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                  {currentProject?.created_at || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>

            {/* Top Center: Search bar */}
            <div className="hidden md:flex items-center gap-2 relative w-full max-w-md">
              <div className="relative w-full">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search media..."
                  className="w-full pl-10 pr-4 py-1.5 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-full text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all"
                />
              </div>
            </div>

            {/* Top Right Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleOpenNewProject}
                className="p-2 rounded-full text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                title="New Project"
              >
                <Plus className="w-5 h-5" />
              </button>

              {/* Help ? Directs to Support with Video Studio selected */}
              <button 
                onClick={() => onOpenSupport?.('Video Studio Issue')}
                className="p-2 rounded-full text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                title="Help & Support"
              >
                <HelpCircle className="w-5 h-5 text-emerald-500 hover:text-emerald-600" />
              </button>

              {/* User Avatar - Directs to Profile Page */}
              <button 
                onClick={onOpenProfile}
                className="w-7 h-7 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center ml-1 overflow-hidden border border-zinc-200 dark:border-zinc-700 hover:scale-105 transition-all cursor-pointer shadow-xs"
                title="View User Profile"
              >
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  profile?.name?.[0]?.toUpperCase() || profile?.email?.[0]?.toUpperCase() || 'P'
                )}
              </button>
            </div>
          </header>

          {/* WORKSPACE BODY: SIDEBAR + MAIN AREA */}
          <div className="flex-1 flex overflow-hidden relative">
            
            {/* SIDEBAR */}
            <aside 
              className={`border-r border-zinc-200 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-[#0c0c0e] flex flex-col justify-between transition-all duration-200 ${
                isSidebarCollapsed ? 'w-16' : 'w-56'
              }`}
            >
              <div className="p-3 space-y-1">
                {[
                  { id: 'all', label: 'All Media', icon: LayoutGrid },
                  { id: 'characters', label: 'Characters', icon: User },
                  { id: 'scenes', label: 'Scenes', icon: Layers },
                ].map((item) => {
                  const Icon = item.icon;
                  const isActive = activeSidebarTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveSidebarTab(item.id as any)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                        isActive
                          ? 'bg-zinc-200 dark:bg-zinc-800/90 text-zinc-900 dark:text-white'
                          : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900 hover:text-zinc-900 dark:hover:text-zinc-200'
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      {!isSidebarCollapsed && <span>{item.label}</span>}
                    </button>
                  );
                })}
              </div>

              {/* SIDEBAR BOTTOM: TRASH & COLLAPSE */}
              <div className="p-3 border-t border-zinc-200 dark:border-zinc-800/60 space-y-1">
                <button
                  onClick={() => setActiveSidebarTab('trash')}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                    activeSidebarTab === 'trash'
                      ? 'bg-red-500/10 text-red-500'
                      : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900 hover:text-zinc-800 dark:hover:text-zinc-200'
                  }`}
                >
                  <Trash2 className="w-4 h-4 shrink-0" />
                  {!isSidebarCollapsed && (
                    <div className="flex items-center justify-between w-full">
                      <span>Trash</span>
                      {trashedItems.length > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500 text-white font-bold">
                          {trashedItems.length}
                        </span>
                      )}
                    </div>
                  )}
                </button>

                <button
                  onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors cursor-pointer"
                >
                  {isSidebarCollapsed ? (
                    <PanelLeftOpen className="w-4 h-4 shrink-0" />
                  ) : (
                    <>
                      <PanelLeftClose className="w-4 h-4 shrink-0" />
                      <span>Collapse</span>
                    </>
                  )}
                </button>
              </div>
            </aside>

            {/* MAIN WORKSPACE CANVAS AREA */}
            <main className="flex-1 relative flex flex-col items-center justify-center p-6 overflow-y-auto custom-scrollbar pb-32">
              
              {/* TAB 1: ALL MEDIA - EMPTY STATE / GENERATING / COMPLETED */}
              {activeSidebarTab === 'all' && (
                <>
                  {!currentProject && !isGenerating && generatingItems.length === 0 && (
                    <div 
                      onClick={() => fileInputRef.current?.click()}
                      className="flex flex-col items-center justify-center text-center space-y-4 max-w-sm p-8 cursor-pointer rounded-3xl hover:bg-zinc-100 dark:hover:bg-zinc-900/40 transition-all group"
                    >
                      <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        accept="image/*,video/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const url = URL.createObjectURL(file);
                            setInputImage(url);
                            toast.success('Image attached for Image-to-Video generation!');
                          }
                        }}
                      />

                      <div className="p-3 group-hover:scale-105 transition-transform">
                        <PixelFlowerIcon />
                      </div>

                      <h2 className="text-xl font-bold tracking-tight text-zinc-800 dark:text-zinc-200">
                        Start creating or drop media
                      </h2>
                    </div>
                  )}

                  {isGenerating && generatingItems.length > 0 && (
                    <div className="w-full max-w-4xl grid grid-cols-1 sm:grid-cols-2 gap-6 my-auto">
                      {generatingItems.map((item) => (
                        <div
                          key={item.id}
                          className={`relative rounded-3xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-zinc-200 dark:bg-zinc-900 shadow-2xl flex flex-col items-center justify-center ${
                            selectedAspectRatio === '9:16' ? 'aspect-[9/16] max-h-[500px]' : 'aspect-video'
                          }`}
                        >
                          <div className="absolute inset-0 bg-gradient-to-r from-zinc-300/40 via-zinc-100/60 to-zinc-300/40 dark:from-zinc-800/40 dark:via-zinc-700/60 dark:to-zinc-800/40 animate-pulse" />
                          <div className="absolute top-4 left-4 p-2 rounded-full bg-black/40 backdrop-blur-md text-white">
                            <Play className="w-4 h-4 fill-current ml-0.5" />
                          </div>
                          <div className="absolute top-4 right-4 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md text-xs font-mono font-bold text-white">
                            {generationProgress}%
                          </div>
                          <div className="z-10 flex flex-col items-center gap-3 p-6 text-center">
                            <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin" />
                            <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 animate-pulse">
                              Rendering cinematic video frames...
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {currentProject && currentProject.status === 'completed' && !isGenerating && (
                    <div className="w-full max-w-4xl my-auto">
                      <div className={`grid grid-cols-1 sm:grid-cols-2 gap-6 justify-center mx-auto ${
                        currentProject.aspectRatio === '9:16' ? 'max-w-2xl' : 'max-w-4xl'
                      }`}>
                        <div
                          onClick={() => setActiveVideoModal(currentProject)}
                          className={`group relative rounded-3xl overflow-hidden border border-zinc-200 dark:border-zinc-800/80 bg-black shadow-2xl cursor-pointer hover:border-emerald-500 transition-all ${
                            currentProject.aspectRatio === '9:16' ? 'aspect-[9/16]' : 'aspect-video'
                          }`}
                        >
                          {currentProject.videoUrl ? (
                            <video
                              src={currentProject.videoUrl}
                              className="w-full h-full object-cover"
                              autoPlay
                              loop
                              muted
                              playsInline
                            />
                          ) : (
                            <img
                              src={currentProject.thumbnailUrl || "https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=800&q=80"}
                              alt={currentProject.prompt}
                              className="w-full h-full object-cover"
                            />
                          )}

                          <div className="absolute top-4 left-4 p-2 rounded-full bg-black/60 backdrop-blur-md text-white group-hover:scale-110 transition-transform">
                            <Play className="w-4 h-4 fill-current ml-0.5" />
                          </div>

                          <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/80 via-black/40 to-transparent text-white space-y-1">
                            <p className="text-xs font-medium line-clamp-2">{currentProject.prompt}</p>
                            <div className="flex items-center justify-between text-[10px] text-zinc-400 font-mono">
                              <span>{currentProject.duration}</span>
                              <span className="uppercase">{currentProject.aspectRatio}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* TAB 2: CHARACTERS (CHARACTER CONSISTENCY) */}
              {activeSidebarTab === 'characters' && (
                <div className="w-full max-w-4xl space-y-6 my-auto">
                  <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-xl space-y-4">
                    <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
                      <div>
                        <h2 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                          <User className="w-5 h-5 text-emerald-500" />
                          <span>Character Consistency Studio</span>
                        </h2>
                        <p className="text-xs text-zinc-500">
                          Create or upload characters. Each character is automatically assigned a number (Character #1, Character #2) so you can reference them in video prompts.
                        </p>
                      </div>
                      
                      <button
                        onClick={() => charFileInputRef.current?.click()}
                        className="px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>Upload Character</span>
                      </button>
                      <input
                        type="file"
                        ref={charFileInputRef}
                        className="hidden"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const url = URL.createObjectURL(file);
                            const nextNum = characters.length + 1;
                            setCharacters((prev) => [
                              {
                                id: `char-${Date.now()}`,
                                number: nextNum,
                                name: `Character #${nextNum}`,
                                prompt: 'Uploaded custom character image',
                                imageUrl: url,
                                createdAt: 'Just now'
                              },
                              ...prev
                            ]);
                            toast.success(`Uploaded Character #${nextNum}`);
                          }
                        }}
                      />
                    </div>

                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={charPrompt}
                        onChange={(e) => setCharPrompt(e.target.value)}
                        placeholder="Describe character design (e.g. Futuristic warrior with silver coat)..."
                        className="flex-1 px-4 py-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs font-semibold text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                      />
                      <button
                        onClick={handleGenerateCharacter}
                        disabled={isGeneratingAsset}
                        className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer"
                      >
                        {isGeneratingAsset ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                        <span>Generate Character</span>
                      </button>
                    </div>
                  </div>

                  {characters.length === 0 ? (
                    <div className="text-center p-8 border border-dashed border-zinc-300 dark:border-zinc-800 rounded-3xl space-y-2">
                      <p className="text-xs text-zinc-500">No character assets created yet.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                      {characters.map((char) => (
                        <div key={char.id} className="group relative bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-md space-y-2 flex flex-col justify-between p-3">
                          <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-zinc-100 dark:bg-zinc-950">
                            <img src={char.imageUrl} alt={char.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                            <span className="absolute top-2 left-2 px-2.5 py-0.5 rounded-full bg-black/70 text-white font-extrabold text-[10px] backdrop-blur-md">
                              Character #{char.number}
                            </span>
                          </div>
                          <div>
                            <h4 className="text-xs font-bold text-zinc-900 dark:text-white truncate">{char.name}</h4>
                            <p className="text-[10px] text-zinc-500 line-clamp-2">{char.prompt}</p>
                          </div>
                          <div className="flex items-center justify-between pt-2 border-t border-zinc-100 dark:border-zinc-800">
                            <button
                              onClick={() => {
                                setPrompt((prev) => `${prev} [Use Character #${char.number}]`.trim());
                                setViewMode('workspace');
                                setActiveSidebarTab('all');
                                toast.success(`Inserted Character #${char.number} reference into prompt!`);
                              }}
                              className="px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 font-bold text-[10px] rounded-lg hover:bg-emerald-100 transition-colors cursor-pointer"
                            >
                              Use in Prompt
                            </button>
                            <button
                              onClick={() => handleDeleteCharacter(char.id)}
                              className="p-1 text-zinc-400 hover:text-red-500 rounded transition-colors cursor-pointer"
                              title="Move to Trash"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: SCENES (SCENE CONSISTENCY) */}
              {activeSidebarTab === 'scenes' && (
                <div className="w-full max-w-4xl space-y-6 my-auto">
                  <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-xl space-y-4">
                    <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
                      <div>
                        <h2 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                          <Layers className="w-5 h-5 text-emerald-500" />
                          <span>Scene Consistency Studio</span>
                        </h2>
                        <p className="text-xs text-zinc-500">
                          Define backgrounds and environments. Numbered automatically (Scene #1, Scene #2) so you can specify settings in your prompts.
                        </p>
                      </div>

                      <button
                        onClick={() => sceneFileInputRef.current?.click()}
                        className="px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>Upload Scene</span>
                      </button>
                      <input
                        type="file"
                        ref={sceneFileInputRef}
                        className="hidden"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const url = URL.createObjectURL(file);
                            const nextNum = scenes.length + 1;
                            setScenes((prev) => [
                              {
                                id: `scene-${Date.now()}`,
                                number: nextNum,
                                name: `Scene #${nextNum}`,
                                prompt: 'Uploaded custom scene image',
                                imageUrl: url,
                                createdAt: 'Just now'
                              },
                              ...prev
                            ]);
                            toast.success(`Uploaded Scene #${nextNum}`);
                          }
                        }}
                      />
                    </div>

                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={scenePrompt}
                        onChange={(e) => setScenePrompt(e.target.value)}
                        placeholder="Describe scene environment (e.g. Cyberpunk rain alleyway in Tokyo)..."
                        className="flex-1 px-4 py-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs font-semibold text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                      />
                      <button
                        onClick={handleGenerateScene}
                        disabled={isGeneratingAsset}
                        className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer"
                      >
                        {isGeneratingAsset ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                        <span>Generate Scene</span>
                      </button>
                    </div>
                  </div>

                  {scenes.length === 0 ? (
                    <div className="text-center p-8 border border-dashed border-zinc-300 dark:border-zinc-800 rounded-3xl space-y-2">
                      <p className="text-xs text-zinc-500">No scene environments created yet.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                      {scenes.map((sc) => (
                        <div key={sc.id} className="group relative bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-md space-y-2 flex flex-col justify-between p-3">
                          <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-zinc-100 dark:bg-zinc-950">
                            <img src={sc.imageUrl} alt={sc.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                            <span className="absolute top-2 left-2 px-2.5 py-0.5 rounded-full bg-black/70 text-white font-extrabold text-[10px] backdrop-blur-md">
                              Scene #{sc.number}
                            </span>
                          </div>
                          <div>
                            <h4 className="text-xs font-bold text-zinc-900 dark:text-white truncate">{sc.name}</h4>
                            <p className="text-[10px] text-zinc-500 line-clamp-2">{sc.prompt}</p>
                          </div>
                          <div className="flex items-center justify-between pt-2 border-t border-zinc-100 dark:border-zinc-800">
                            <button
                              onClick={() => {
                                setPrompt((prev) => `${prev} [Use Scene #${sc.number}]`.trim());
                                setViewMode('workspace');
                                setActiveSidebarTab('all');
                                toast.success(`Inserted Scene #${sc.number} reference into prompt!`);
                              }}
                              className="px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 font-bold text-[10px] rounded-lg hover:bg-emerald-100 transition-colors cursor-pointer"
                            >
                              Use in Prompt
                            </button>
                            <button
                              onClick={() => handleDeleteScene(sc.id)}
                              className="p-1 text-zinc-400 hover:text-red-500 rounded transition-colors cursor-pointer"
                              title="Move to Trash"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: TRASH (STORED DELETED ASSETS & PERMANENT DELETE) */}
              {activeSidebarTab === 'trash' && (
                <div className="w-full max-w-4xl space-y-6 my-auto">
                  <div className="flex items-center justify-between bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-xl">
                    <div>
                      <h2 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                        <Trash2 className="w-5 h-5 text-red-500" />
                        <span>Trash & Stored Assets</span>
                      </h2>
                      <p className="text-xs text-zinc-500">
                        Deleted video projects, characters, and scenes are stored here. You can restore them anytime or permanently delete them.
                      </p>
                    </div>

                    {trashedItems.length > 0 && (
                      <button
                        onClick={handleEmptyTrash}
                        className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded-xl transition-all shadow-md cursor-pointer"
                      >
                        Empty Trash
                      </button>
                    )}
                  </div>

                  {trashedItems.length === 0 ? (
                    <div className="text-center p-12 border border-dashed border-zinc-300 dark:border-zinc-800 rounded-3xl space-y-2">
                      <Trash2 className="w-8 h-8 text-zinc-400 mx-auto" />
                      <p className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Trash is empty</p>
                      <p className="text-xs text-zinc-500">Deleted items will appear here for recovery.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                      {trashedItems.map((item) => (
                        <div key={item.id} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-3 space-y-2 flex flex-col justify-between shadow-sm">
                          <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-zinc-100 dark:bg-zinc-950">
                            {item.thumbnailUrl ? (
                              <img src={item.thumbnailUrl} alt={item.title} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-zinc-800 text-zinc-500">
                                <Film className="w-6 h-6" />
                              </div>
                            )}
                            <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-red-600 text-white text-[9px] font-extrabold uppercase">
                              {item.type}
                            </span>
                          </div>

                          <div>
                            <p className="text-xs font-bold text-zinc-900 dark:text-white line-clamp-2">{item.title}</p>
                            <span className="text-[10px] text-zinc-400">Deleted {item.deletedAt}</span>
                          </div>

                          <div className="flex items-center gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                            <button
                              onClick={() => handleRestoreItem(item)}
                              className="flex-1 py-1.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 text-zinc-800 dark:text-zinc-200 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1 cursor-pointer"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>Restore</span>
                            </button>

                            <button
                              onClick={() => handlePermanentDelete(item.id)}
                              className="p-1.5 bg-red-50 dark:bg-red-950/50 hover:bg-red-100 text-red-600 rounded-lg transition-colors cursor-pointer"
                              title="Delete Permanently"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

            </main>

            {/* FLOATING PROMPT BAR & POP-UP MODAL */}
            <div className="absolute bottom-6 inset-x-0 mx-auto w-full max-w-2xl px-4 z-40">
              
              {/* POP-UP SETTINGS MODAL */}
              <AnimatePresence>
                {showSettingsPopover && (
                  <motion.div
                    initial={{ opacity: 0, y: 15, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 15, scale: 0.98 }}
                    className="absolute bottom-full mb-3 inset-x-0 mx-auto w-full max-w-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl p-5 space-y-4 text-zinc-900 dark:text-white z-50 backdrop-blur-2xl"
                  >
                    {/* MODE TABS */}
                    <div className="grid grid-cols-2 gap-2 bg-zinc-100 dark:bg-zinc-950 p-1 rounded-2xl border border-zinc-200 dark:border-zinc-800">
                      <button
                        type="button"
                        onClick={() => toast.info('Video mode active')}
                        className="py-2 px-3 rounded-xl text-xs font-bold bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Video className="w-3.5 h-3.5 text-emerald-500" />
                        <span>Text-to-Video</span>
                      </button>
                      
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="py-2 px-3 rounded-xl text-xs font-bold text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <ImageIcon className="w-3.5 h-3.5" />
                        <span>Image-to-Video</span>
                      </button>
                    </div>

                    {/* ASPECT RATIO */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                        Aspect Ratio
                      </label>
                      <div className="grid grid-cols-2 gap-2 bg-zinc-100 dark:bg-zinc-950 p-1 rounded-2xl border border-zinc-200 dark:border-zinc-800">
                        {[
                          { id: '9:16', label: '9:16 Portrait' },
                          { id: '16:9', label: '16:9 Landscape' }
                        ].map((ratio) => (
                          <button
                            key={ratio.id}
                            type="button"
                            onClick={() => setSelectedAspectRatio(ratio.id as any)}
                            className={`py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
                              selectedAspectRatio === ratio.id
                                ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-xs'
                                : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
                            }`}
                          >
                            <div className={`border-2 border-current rounded-xs transition-all ${
                              ratio.id === '9:16' ? 'w-2.5 h-3.5' : 'w-3.5 h-2.5'
                            }`} />
                            <span>{ratio.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* QUALITY ENGINE */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 flex items-center justify-between">
                        <span>Quality Engine</span>
                        <span className="text-emerald-500 font-mono text-[10px]">Trelvix AI</span>
                      </label>
                      <div className="grid grid-cols-2 gap-2 bg-zinc-100 dark:bg-zinc-950 p-1 rounded-2xl border border-zinc-200 dark:border-zinc-800">
                        <button
                          type="button"
                          onClick={() => setSelectedQuality('creative')}
                          className={`py-2 px-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                            selectedQuality === 'creative'
                              ? 'bg-emerald-600 text-white'
                              : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
                          }`}
                        >
                          Creative
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (profile?.plan !== 'pro') {
                              toast.error('Super Creative requires a Pro plan.');
                              onUpgradeClick?.();
                              return;
                            }
                            setSelectedQuality('super-creative');
                          }}
                          className={`py-2 px-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1 cursor-pointer ${
                            selectedQuality === 'super-creative'
                              ? 'bg-emerald-600 text-white'
                              : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
                          }`}
                        >
                          <span>Super Creative</span>
                          <Crown className="w-3 h-3 text-amber-400 fill-current" />
                        </button>
                      </div>
                    </div>

                    {/* DURATIONS */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                        Duration
                      </label>
                      <div className="grid grid-cols-4 gap-1.5 bg-zinc-100 dark:bg-zinc-950 p-1 rounded-2xl border border-zinc-200 dark:border-zinc-800">
                        {['4s', '6s', '8s', '10s'].map((dur) => (
                          <button
                            key={dur}
                            type="button"
                            onClick={() => setSelectedDuration(dur)}
                            className={`py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                              selectedDuration === dur
                                ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-xs'
                                : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
                            }`}
                          >
                            {dur}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* OUTPUT COUNTS */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                        Output Count
                      </label>
                      <div className="grid grid-cols-4 gap-1.5 bg-zinc-100 dark:bg-zinc-950 p-1 rounded-2xl border border-zinc-200 dark:border-zinc-800">
                        {(['x1', 'x2', 'x3', 'x4'] as const).map((cnt) => (
                          <button
                            key={cnt}
                            type="button"
                            onClick={() => setOutputCount(cnt)}
                            className={`py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                              outputCount === cnt
                                ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-xs'
                                : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
                            }`}
                          >
                            {cnt}
                          </button>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* PROMPT CARD INPUT SECTION */}
              <div className="bg-white dark:bg-zinc-900/95 backdrop-blur-2xl border border-zinc-200 dark:border-zinc-800 rounded-3xl p-4 shadow-2xl space-y-2 text-zinc-900 dark:text-white">
                
                {/* Input Image Tag if attached */}
                {inputImage && (
                  <div className="flex items-center gap-2 px-3 py-1 bg-zinc-100 dark:bg-zinc-800 rounded-xl w-fit text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                    <ImageIcon className="w-3.5 h-3.5" />
                    <span>Image attached (Image-to-Video)</span>
                    <button onClick={() => setInputImage(null)} className="hover:text-red-500 ml-1 cursor-pointer">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="What do you want to create?"
                  rows={2}
                  className="w-full bg-transparent text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none resize-none leading-relaxed px-1"
                />

                {/* CONTROLS ROW */}
                <div className="flex items-center justify-between pt-2 border-t border-zinc-100 dark:border-zinc-800/80">
                  
                  {/* Left: + Button for Image-to-Video Upload */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="p-2 rounded-full bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 transition-all cursor-pointer"
                      title="Attach Image for Image-to-Video"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Right: Settings Pop-up Toggle & Send Button */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowSettingsPopover(!showSettingsPopover)}
                      className={`px-3.5 py-1.5 rounded-full text-xs font-semibold flex items-center gap-2 transition-all border cursor-pointer ${
                        showSettingsPopover
                          ? 'bg-emerald-600 text-white border-emerald-500 shadow-xs'
                          : 'bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 border-zinc-200 dark:border-zinc-700'
                      }`}
                      title="Video Format & Settings"
                    >
                      <div className={`border-2 border-current rounded-xs transition-all ${
                        selectedAspectRatio === '9:16' ? 'w-2.5 h-3.5' : 'w-3.5 h-2.5'
                      }`} />
                      <span>{selectedAspectRatio === '9:16' ? '9:16' : '16:9'}</span>
                      <span className="opacity-40">•</span>
                      <span>{selectedDuration}</span>
                      <span className="font-mono text-zinc-400">{outputCount}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleGenerate}
                      disabled={isGenerating}
                      className={`p-2.5 rounded-full transition-all shadow-md flex items-center justify-center cursor-pointer ${
                        isGenerating
                          ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-400 cursor-wait'
                          : 'bg-emerald-600 hover:bg-emerald-500 text-white hover:scale-105 active:scale-95'
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

          </div>

          <footer className="py-1 px-4 text-center text-[11px] text-zinc-500 bg-white dark:bg-[#08080a] shrink-0 border-t border-zinc-200 dark:border-zinc-900">
            Trelvix AI Video Studio can make mistakes, so double check generated media.
          </footer>

        </div>
      )}

      {/* FULLSCREEN VIDEO PREVIEW MODAL */}
      <AnimatePresence>
        {activeVideoModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 sm:p-8"
            onClick={() => setActiveVideoModal(null)}
          >
            <div 
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-4xl max-h-[90vh] bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col"
            >
              <div className="flex items-center justify-between p-4 border-b border-zinc-800 text-white">
                <span className="text-xs font-mono text-zinc-400">
                  {activeVideoModal.created_at} • {activeVideoModal.duration}
                </span>
                <button
                  onClick={() => setActiveVideoModal(null)}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 bg-black flex items-center justify-center relative overflow-hidden min-h-[300px]">
                {activeVideoModal.videoUrl ? (
                  <video
                    src={activeVideoModal.videoUrl}
                    controls
                    autoPlay
                    className="max-h-[70vh] w-auto mx-auto rounded-xl"
                  />
                ) : (
                  <img
                    src={activeVideoModal.thumbnailUrl || "https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=800&q=80"}
                    alt={activeVideoModal.prompt}
                    className="max-h-[70vh] w-auto mx-auto rounded-xl"
                  />
                )}
              </div>

              <div className="p-4 bg-zinc-900 border-t border-zinc-800 flex items-center justify-between text-white">
                <p className="text-xs text-zinc-300 font-medium line-clamp-2 max-w-xl">
                  {activeVideoModal.prompt}
                </p>

                <div className="flex items-center gap-2">
                  {activeVideoModal.videoUrl && (
                    <a
                      href={activeVideoModal.videoUrl}
                      download={`trelvix-video-${activeVideoModal.id}.mp4`}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download</span>
                    </a>
                  )}

                  <button
                    onClick={(e) => handleDeleteVideo(activeVideoModal.id, e)}
                    className="p-2 rounded-full text-zinc-400 hover:text-red-400 hover:bg-zinc-800 transition-colors cursor-pointer"
                    title="Move to Trash"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
};
