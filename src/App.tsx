import { useState, useEffect, useRef } from 'react';
import { 
  Plus, 
  History as HistoryIcon, 
  Settings as SettingsIcon, 
  Send, 
  Moon, 
  Sun, 
  Menu, 
  Download, 
  Zap, 
  ChevronRight,
  ChevronDown,
  User,
  ExternalLink,
  Copy,
  ThumbsUp,
  ThumbsDown,
  FileDown,
  MessageSquare,
  Image as ImageIcon,
  Edit2,
  Trash2,
  Globe,
  Maximize2,
  X,
  Paperclip,
  File as FileIcon,
  Film,
  FileText,
  Sparkles,
  Clock,
  Loader2,
  ZoomIn,
  ZoomOut,
  RotateCcw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Toaster, toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { clsx, type ClassValue } from 'clsx';
import { SplashScreen } from './components/SplashScreen';

const supportsLookbehind = (() => {
  try {
    new RegExp('(?<=a)b');
    return true;
  } catch (e) {
    return false;
  }
})();
import { twMerge } from 'tailwind-merge';
import { supabase } from './lib/supabase';
import { applyWatermark } from './utils/watermark';
import { downloadFile, openExternalLink } from './utils/nativeCompat';

import type { Message, ConversationType, Profile } from './types';

const safeUUID = (): string => {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.randomUUID) {
    try {
      return window.crypto.randomUUID();
    } catch (e) {}
  }
  return 'msg-' + Math.random().toString(36).substring(2, 15) + '-' + Date.now();
};

const preprocessMath = (content: string): string => {
  if (!content) return "";
  
  // Split by code blocks to avoid replacing math delimiters inside coding regions
  const parts = content.split(/(```[\s\S]*?```)/g);
  
  const processedParts = parts.map((part) => {
    if (part.startsWith('```')) {
      return part;
    }
    
    // Replace block math delimiters \[ ... \] or \\[ ... \\] with $$ ... $$
    let sub = part.replace(/(?:\\{1,2})\[([\s\S]*?)(?:\\{1,2})\]/g, (_, equation) => {
      return `\n$$\n${equation.trim()}\n$$\n`;
    });
    
    // Replace inline math delimiters \( ... \) or \\( ... \\) with $ ... $
    sub = sub.replace(/(?:\\{1,2})\(([\s\S]*?)(?:\\{1,2})\)/g, (_, equation) => {
      return `$${equation.trim()}$`;
    });
    
    return sub;
  });
  
  return processedParts.join('');
};

// --- Components ---
import { Sidebar } from './components/Sidebar';
import { TrelvixLogo } from './components/TrelvixLogo';

const ImageWithLoader = ({ src, alt, className, onClick, skipWatermark = false }: { src: string, alt: string, className?: string, onClick?: (e: React.MouseEvent) => void, skipWatermark?: boolean }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [displaySrc, setDisplaySrc] = useState('');

  const getProxyUrl = (url: string) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return `/api/proxy-image?url=${encodeURIComponent(url)}`;
    }
    return url;
  };

  useEffect(() => {
    let active = true;
    setIsLoaded(false);
    setHasError(false);

    if (src === 'expired') {
      setHasError(true);
      setDisplaySrc('');
      return;
    }
    if (src.startsWith('db:')) {
      const imgId = src.split(':')[1];
      supabase.from('images').select('image_url').eq('id', imgId).single()
        .then(
          ({ data, error }) => {
            if (!active) return;
            if (error || !data?.image_url) {
              console.error("Error fetching lazy image:", error);
              setHasError(true);
            } else {
              const proxiedUrl = getProxyUrl(data.image_url);
              if (skipWatermark) {
                if (active) setDisplaySrc(proxiedUrl);
              } else {
                applyWatermark(proxiedUrl).then(watermarked => {
                  if (active) setDisplaySrc(watermarked);
                });
              }
            }
          },
          () => {
            if (active) setHasError(true);
          }
        );
    } else {
      const proxiedUrl = getProxyUrl(src);
      if (skipWatermark) {
        if (active) setDisplaySrc(proxiedUrl);
      } else {
        applyWatermark(proxiedUrl).then(watermarked => {
          if (active) setDisplaySrc(watermarked);
        });
      }
    }

    return () => {
      active = false;
    };
  }, [src, skipWatermark]);
  
  return (
    <div className={cn("relative overflow-hidden bg-zinc-100 dark:bg-zinc-800 focus-within:ring-2 focus-within:ring-zinc-500", className)} onClick={onClick}>
      {!isLoaded && !hasError && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-zinc-300 dark:border-zinc-600 border-t-zinc-900 dark:border-t-white rounded-full animate-spin" />
        </div>
      )}
      {hasError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center">
          <ImageIcon className="w-8 h-8 text-zinc-400 mb-2" />
          <p className="text-xs text-zinc-500">Image failed to load</p>
        </div>
      )}
      {displaySrc && (
        <img 
          src={displaySrc} 
          alt={alt} 
          className={cn(
            "w-full h-auto transition-all duration-700 ease-out",
            isLoaded ? "opacity-100 scale-100 blur-0" : "opacity-0 scale-105 blur-lg",
            hasError && "hidden"
          )}
          onLoad={() => setIsLoaded(true)}
          onError={() => setHasError(true)}
          referrerPolicy="no-referrer"
        />
      )}
    </div>
  );
};

import { WelcomeScreen } from './components/WelcomeScreen';
import { ContextForm } from './components/ContextForm';
import { Settings } from './components/Settings';
import { Auth } from './components/Auth';
import { LegalModal } from './components/Legal';
import { CodeBlock } from './components/CodeBlock';
import { DocumentExportCard } from './components/DocumentExportCard';
import { UpgradeModal } from './components/UpgradeModal';
import { AppsView } from './components/AppsView';
import { TextToSpeechView } from './components/TextToSpeechView';

const PLAN_LIMITS = {
  free: { messages: 15, analysis: 5, images: 5 },
  pro: { messages: 100, analysis: Infinity, images: 20 },
  plus: { messages: Infinity, analysis: Infinity, images: Infinity }
};

// --- Utils ---
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Main App ---

export default function App() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth > 1024);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved ? saved === 'dark' : true;
  });
  const [isSplashing, setIsSplashing] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [conversations, setConversations] = useState<any[]>([]);
  const [currentConversation, setCurrentConversation] = useState<any | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showContextForm, setShowContextForm] = useState<ConversationType | null>(null);
  const [showLegal, setShowLegal] = useState<'about' | 'privacy' | 'terms' | null>(null);

  // Sync state with URL path
  useEffect(() => {
    const handleLocationChange = () => {
      const path = window.location.pathname.toLowerCase().replace(/\/$/, "");
      if (path === '/privacy') {
        setShowLegal('privacy');
      } else if (path === '/terms') {
        setShowLegal('terms');
      } else if (path === '/about') {
        setShowLegal('about');
      } else {
        setShowLegal(null);
      }
    };
    // Check on mount
    handleLocationChange();

    window.addEventListener('popstate', handleLocationChange);
    return () => window.removeEventListener('popstate', handleLocationChange);
  }, []);

  const handleShowLegal = (type: 'about' | 'privacy' | 'terms') => {
    setShowLegal(type);
    window.history.pushState({}, document.title, `/${type}`);
  };

  const handleCloseLegal = () => {
    setShowLegal(null);
    window.history.pushState({}, document.title, '/');
  };
  const [selectedAttachment, setSelectedAttachment] = useState<{ file: File, preview: string, type: 'image' | 'video' | 'document' | 'other' } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [expandedImage, setExpandedImage] = useState<{url: string, title: string} | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [zoomScale, setZoomScale] = useState(1);
  const [zoomPosition, setZoomPosition] = useState({ x: 0, y: 0 });
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const touchStartDistRef = useRef<number | null>(null);
  const touchStartScaleRef = useRef<number>(1);

  useEffect(() => {
    if (!expandedImage) {
      setZoomScale(1);
      setZoomPosition({ x: 0, y: 0 });
      setIsDraggingImage(false);
    }
  }, [expandedImage]);

  const [streamingMessage, setStreamingMessage] = useState('');
  const [activeView, setActiveView] = useState<'chat' | 'history' | 'apps' | 'images' | 'settings' | 'tts'>('chat');
  const [imageSpeed, setImageSpeed] = useState<'fast' | 'quality'>(() => {
    return (localStorage.getItem('image_speed') as 'fast' | 'quality') || 'quality';
  });
  const handleToggleImageSpeed = () => {
    setImageSpeed(prev => {
      const next = prev === 'fast' ? 'quality' : 'fast';
      localStorage.setItem('image_speed', next);
      toast.info(`Visual engine set to ${next === 'fast' ? 'Turbo Speed' : 'HD Quality'}`);
      return next;
    });
  };

  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [currentImagePrompt, setCurrentImagePrompt] = useState('');
  const [timerCount, setTimerCount] = useState(0);
  const [currentStageText, setCurrentStageText] = useState('Initializing Trelvix Visual Engine...');

  // Dynamically resolve absolute URL paths for OpenGraph & Twitter crawler compatibility
  useEffect(() => {
    try {
      const origin = window.location.origin;
      const absoluteLogoUrl = `${origin}/trelvixlogo.png`;
      
      const ogImage = document.querySelector('meta[property="og:image"]');
      if (ogImage) {
        ogImage.setAttribute('content', absoluteLogoUrl);
      }
      
      const twitterImage = document.querySelector('meta[name="twitter:image"]');
      if (twitterImage) {
        twitterImage.setAttribute('content', absoluteLogoUrl);
      }
    } catch (e) {
      console.warn('Failed to dynamically inject direct preview meta path:', e);
    }
  }, []);



  // Timer & stage text controller for ChatGPT-style image generation loading UI
  useEffect(() => {
    let timerId: any = null;
    if (isGeneratingImage && isLoading) {
      setTimerCount(0);
      setCurrentStageText('Initializing Trelvix Visual Engine...');
      
      timerId = setInterval(() => {
        setTimerCount(prev => {
          const next = prev + 1;
          if (next === 2) {
            setCurrentStageText('Parsing composition guidelines...');
          } else if (next === 4) {
            setCurrentStageText('Initializing pixel canvas layout...');
          } else if (next === 8) {
            setCurrentStageText('Synthesizing high-fidelity lighting model...');
          } else if (next === 12) {
            setCurrentStageText('Rendering volumetric details & colors...');
          } else if (next === 16) {
            setCurrentStageText('Finalizing rendering & noise reduction...');
          } else if (next === 22) {
            setCurrentStageText('Applying 8K upscaling filters...');
          }
          return next;
        });
      }, 1000);
    } else {
      setTimerCount(0);
    }

    return () => {
      if (timerId) clearInterval(timerId);
    };
  }, [isGeneratingImage, isLoading]);

  // Persist the current active conversation ID to localStorage to survive page reloads gracefully
  useEffect(() => {
    if (currentConversation?.id) {
      localStorage.setItem('last_conversation_id', currentConversation.id);
    } else {
      localStorage.removeItem('last_conversation_id');
    }
  }, [currentConversation?.id]);

  // Tab-Focus recovery & Background Sync:
  // If the user leaves the tab and comes back, and we were generating an image or loading,
  // sync the conversation from the database instantly to fetch any completed output from the background!
  useEffect(() => {
    const handleVisibilitySync = async () => {
      if (document.visibilityState === 'visible' && user && currentConversation?.id) {
        console.log('[VisibilitySync] Tab focused. Refreshing current conversation state to sync background progress...');
        try {
          const { data, error } = await supabase
            .from('conversations')
            .select('*')
            .eq('id', currentConversation.id)
            .single();

          if (error) {
            console.warn('[VisibilitySync] Could not pull current conversation snapshot:', error);
            return;
          }

          if (data) {
            // Update the sidebar conversations list
            setConversations(prev => prev.map(c => c.id === data.id ? data : c));
            
            // Re-sync messages
            const uniqueMessages = (data.messages || []).reduce((acc: any[], curr: any, idx: number) => {
              const messageId = curr.id || `msg-legacy-${idx}`;
              if (!acc.find(m => m.id === messageId)) {
                acc.push({ ...curr, id: messageId });
              }
              return acc;
            }, []);

            // Check if been updated (e.g. image has been saved by server)
            const hasNewImage = uniqueMessages.some((m: any) => m.role === 'assistant' && m.image_url && !messages.find((oldM: any) => oldM.id === m.id));
            if (hasNewImage || isGeneratingImage) {
              console.log('[VisibilitySync] Found new synchronized background data. Updating active UI state...');
              setMessages(uniqueMessages);
              setCurrentConversation(data);
              
              if (isGeneratingImage && uniqueMessages.some((m: any) => m.role === 'assistant' && m.image_url)) {
                setIsGeneratingImage(false);
                setIsLoading(false);
              }
            }
          }
        } catch (syncErr) {
          console.error('[VisibilitySync] Background synchronization routine failed:', syncErr);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilitySync);
    window.addEventListener('focus', handleVisibilitySync);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilitySync);
      window.removeEventListener('focus', handleVisibilitySync);
    };
  }, [user, currentConversation?.id, messages, isGeneratingImage]);
  const [activeMessageId, setActiveMessageId] = useState<string | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [upgradeReason, setUpgradeReason] = useState<'usage' | 'images' | 'manual'>('usage');
  const [hasError, setHasError] = useState(false);
  const [lastFailedRequest, setLastFailedRequest] = useState<{content: string, conv?: any} | null>(null);
  const [viewportHeight, setViewportHeight] = useState<string>('100%');
  const [loadedRemarkGfm, setLoadedRemarkGfm] = useState<any>(null);

  // Screen Wake Lock controller to prevent mobile screen sleep during model generation
  const wakeLockRef = useRef<any>(null);
  const shouldKeepAwake = isLoading || isGeneratingImage;

  useEffect(() => {
    const acquireLock = async () => {
      if (shouldKeepAwake && 'wakeLock' in navigator) {
        try {
          // Check if already active
          if (!wakeLockRef.current) {
            wakeLockRef.current = await (navigator.wakeLock as any).request('screen');
            console.log('[WakeLock] Screen Wake Lock acquired successfully (active state)');
          }
        } catch (err) {
          console.warn('[WakeLock] Screen Wake Lock acquisition failed:', err);
        }
      }
    };

    const releaseLock = async () => {
      if (wakeLockRef.current) {
        try {
          await wakeLockRef.current.release();
          console.log('[WakeLock] Screen Wake Lock released');
        } catch (err) {
          console.error('[WakeLock] Error releasing Wake Lock:', err);
        }
        wakeLockRef.current = null;
      }
    };

    if (shouldKeepAwake) {
      acquireLock();
    } else {
      releaseLock();
    }

    const handleVisibilityChange = async () => {
      if (shouldKeepAwake && document.visibilityState === 'visible' && 'wakeLock' in navigator) {
        try {
          wakeLockRef.current = await (navigator.wakeLock as any).request('screen');
          console.log('[WakeLock] Screen Wake Lock re-acquired on visibility change');
        } catch (err) {
          console.warn('[WakeLock] Re-acquisition failed:', err);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      releaseLock();
    };
  }, [shouldKeepAwake]);

  useEffect(() => {
    if (supportsLookbehind) {
      import('remark-gfm').then((mod) => {
        setLoadedRemarkGfm(() => mod.default);
      }).catch((e) => {
        console.warn("[Markdown] Dynamic load of remark-gfm failed:", e);
      });
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const updateHeight = () => {
      if (window.visualViewport) {
        setViewportHeight(`${window.visualViewport.height}px`);
      } else {
        setViewportHeight('100%');
      }
    };

    updateHeight();
    
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', updateHeight);
      window.visualViewport.addEventListener('scroll', updateHeight);
    }
    window.addEventListener('resize', updateHeight);

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', updateHeight);
        window.visualViewport.removeEventListener('scroll', updateHeight);
      }
      window.removeEventListener('resize', updateHeight);
    };
  }, []);
  const loadingIntervalRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (isLoading) {
      if (loadingIntervalRef.current) clearInterval(loadingIntervalRef.current);
    } else {
      if (loadingIntervalRef.current) clearInterval(loadingIntervalRef.current);
    }
    return () => {
      if (loadingIntervalRef.current) clearInterval(loadingIntervalRef.current);
    };
  }, [isLoading]);

  // Quiet background synchronization / session recovery effect
  useEffect(() => {
    let active = true;
    let timerId: any = null;
    
    const checkConversationHistory = async () => {
      if (!currentConversation?.id) return;
      
      // Only check if the last local state message is from 'user' and the UI is NOT actively streaming
      if (messages.length > 0 && messages[messages.length - 1].role === 'user' && !streamingMessage) {
        try {
          console.log("[Auto-Sync] Checking if server background worker completed reply...");
          const { data, error } = await supabase
            .from('conversations')
            .select('messages')
            .eq('id', currentConversation.id)
            .single();
            
          if (error) {
            console.error("[Auto-Sync] Error checking:", error);
            return;
          }
          
          if (data && data.messages && data.messages.length > messages.length) {
            const lastMsg = data.messages[data.messages.length - 1];
            if (lastMsg.role === 'assistant') {
              console.log("[Auto-Sync] Found background reply! Healing conversation locally.");
              
              // Filter out duplicates and stabilize
              const uniqueMessages = (data.messages || []).reduce((acc: any[], curr: any, idx: number) => {
                const messageId = curr.id || `msg-legacy-${idx}`;
                if (!acc.find(m => m.id === messageId)) {
                  acc.push({ ...curr, id: messageId });
                }
                return acc;
              }, []);
              
              if (active) {
                setMessages(uniqueMessages);
                setConversations(prev => prev.map(c => c.id === currentConversation.id ? { ...c, messages: uniqueMessages, updated_at: new Date().toISOString() } : c));
                setCurrentConversation(prev => prev ? { ...prev, messages: uniqueMessages } : null);
                setHasError(false);
              }
              return; 
            }
          }
        } catch (err) {
          console.error("[Auto-Sync] Check exception:", err);
        }
      }
    };

    checkConversationHistory();

    if (messages.length > 0 && messages[messages.length - 1].role === 'user' && !streamingMessage) {
      timerId = setInterval(() => {
        checkConversationHistory();
      }, 4000);
    }

    return () => {
      active = false;
      if (timerId) clearInterval(timerId);
    };
  }, [currentConversation?.id, messages, streamingMessage]);

  // Self-healing startup & reload state resume logic
  useEffect(() => {
    if (messages.length > 0 && messages[messages.length - 1].role === 'user') {
      const lastMsg = messages[messages.length - 1];
      const lowerContent = (lastMsg.content || '').toLowerCase();
      const docFilter = /\b(pdf|docx|xlsx|word|excel|spreadsheet|csv|document|resume|report|cv|curriculum\s*vitae|invoice|presentation|budget|letter|email|cover\s*letter|essay|article|post|text|contract|agreement|outline|syllabus|proposal|workbook|chart|table|schema|blueprint|database)\b/i;
      const isImg = (currentConversation?.type === 'image' || 
        ((/generate|create|make|draw|design|show me|give me|i want|produce|paint|illustrate|visualize|render/i.test(lowerContent)) && 
         (/image|picture|photo|logo|flyer|poster|illustration|drawing|sketch|graphic|art|realistic|scene|portrait|landscape/i.test(lowerContent))) ||
        /\b(logo|flyer|poster|art|sketch|drawing)\b/i.test(lowerContent) ||
        /image of|picture of|photo of|generate an image|create an image|make an image|generate a picture|create a picture/i.test(lowerContent) ||
        /^realistic |^photorealistic /i.test(lowerContent)) && 
        !docFilter.test(lowerContent);
        
      setIsLoading(true);
      if (isImg) {
        setIsGeneratingImage(true);
        setCurrentImagePrompt(lastMsg.content || '');
      } else {
        setIsGeneratingImage(false);
        setCurrentImagePrompt('');
      }
    } else {
      setIsLoading(false);
      setIsGeneratingImage(false);
    }
  }, [currentConversation?.id, messages.length]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const generationAbortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  useEffect(() => {
    // Auth Listener
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      fetchProfile();
      fetchConversations();
    } else {
      setProfile(null);
      setConversations([]);
      setCurrentConversation(null);
      setMessages([]);
    }
  }, [user]);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      document.documentElement.style.colorScheme = 'dark';
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.style.colorScheme = 'light';
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingMessage]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!user) return;
    
    // Only send valid columns as per DB schema
    const validKeys = [
      'name', 
      'avatar_url',
      'plan', 
      'personality',
      'subscription_expires_at', 
      'messages_used_today', 
      'analysis_used_today', 
      'images_used_today', 
      'last_usage_reset'
    ];
    
    const filteredUpdates: any = {};
    Object.keys(updates).forEach(key => {
      if (validKeys.includes(key)) {
        filteredUpdates[key] = (updates as any)[key];
      }
    });

    if (Object.keys(filteredUpdates).length === 0) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .update(filteredUpdates)
        .eq('id', user.id)
        .select()
        .single();

      if (error) throw error;
      if (data) setProfile(data);
      return data;
    } catch (error) {
      console.error("Error updating profile:", error);
      // Don't toast here as it might be a background update, but do throw for callers who care
      throw error;
    }
  };

  const fetchProfile = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    
    // Check for daily reset
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    
    if (error && error.code === 'PGRST116') {
      // Create profile if not exists
      const newProfile = {
        id: user.id,
        name: user.user_metadata?.full_name || null,
        avatar_url: user.user_metadata?.avatar_url || null,
        messages_used_today: 0,
        analysis_used_today: 0,
        images_used_today: 0,
        last_usage_reset: now.toISOString(),
        plan: 'free',
        subscription_expires_at: null,
        personality: 'creative'
      };
      const { data: created } = await supabase.from('profiles').insert(newProfile).select().single();
      setProfile(created);
    } else if (data) {
      let lastReset = '';
      try {
        if (data.last_usage_reset) {
          // Robustly handle string or Date objects
          const dateStr = typeof data.last_usage_reset === 'string' 
            ? data.last_usage_reset 
            : (data.last_usage_reset instanceof Date ? data.last_usage_reset.toISOString() : String(data.last_usage_reset));
          lastReset = dateStr.split('T')[0];
        }
      } catch (err) {
        console.error("Error parsing last_usage_reset:", err);
      }
      
      if (lastReset && lastReset !== today) {
        // Reset counters for a new day
        await updateProfile({
          messages_used_today: 0,
          analysis_used_today: 0,
          images_used_today: 0,
          last_usage_reset: now.toISOString()
        });
      } else {
        // Standard profile fetch
        setProfile(data);
      }
    }
  };

  const fetchConversations = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      
      // Filter out duplicates by ID and ensure every conversation has an ID
      const uniqueConversations = (data || []).reduce((acc: any[], curr: any) => {
        if (curr.id && !acc.find(c => c.id === curr.id)) {
          acc.push(curr);
        }
        return acc;
      }, []);
      
      setConversations(uniqueConversations);

      const lastId = localStorage.getItem('last_conversation_id');
      if (lastId) {
        const lastConv = uniqueConversations.find((c: any) => c.id === lastId);
        if (lastConv) {
          console.log("[Chat] Auto-restoring last active conversation on startup:", lastId);
          setCurrentConversation(lastConv);
          
          const uniqueMessages = (lastConv.messages || []).reduce((acc: any[], curr: any, idx: number) => {
            const messageId = curr.id || `msg-legacy-${idx}`;
            if (!acc.find(m => m.id === messageId)) {
              acc.push({ ...curr, id: messageId });
            }
            return acc;
          }, []);
          
          setMessages(uniqueMessages);
          setStreamingMessage('');
          setActiveView('chat');
        }
      }

      // Auto-migrate/heal expiring images in the background after the UI starts rendering to keep chat loading incredibly fast
      setTimeout(() => {
        uniqueConversations.forEach(async (conv: any) => {
          const messages = conv.messages || [];
          let updated = false;
          const newMessages = await Promise.all(messages.map(async (m: any) => {
            if (m.image_url && !m.image_url.startsWith('db:') && !m.image_url.startsWith('data:') && m.image_url !== 'expired') {
              try {
                const proxyResp = await fetch('/api/proxy-image', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ url: m.image_url })
                });
                if (proxyResp.ok) {
                  const blob = await proxyResp.blob();
                  const reader = new FileReader();
                  const base64 = await new Promise<string>((resolve) => {
                    reader.onloadend = () => resolve(reader.result as string);
                    reader.readAsDataURL(blob);
                  });
                  
                  const { data: imgData } = await supabase.from('images').insert({
                    user_id: user.id,
                    prompt: m.content || "Migrated Image",
                    image_url: base64
                  }).select().single();
                  
                  if (imgData) {
                    updated = true;
                    return { ...m, image_url: `db:${imgData.id}` };
                  }
                } else {
                  // If it fails to fetch (e.g. 403, 404, or 500 because of an expired OpenAI URL),
                  // mark it as 'expired' so we do not attempt to proxy it again on subsequent reloads.
                  console.warn(`[Auto-Migrate] Found expired image url, marking as expired: ${m.image_url.substring(0, 100)}`);
                  updated = true;
                  return { ...m, image_url: 'expired' };
                }
              } catch (e) {
                console.error("Migration failed:", e);
              }
            }
            return m;
          }));

          if (updated) {
            await updateConversationMessages(conv.id, newMessages);
            setConversations(prev => prev.map(c => c.id === conv.id ? { ...c, messages: newMessages } : c));
            setCurrentConversation(prev => (prev && prev.id === conv.id) ? { ...prev, messages: newMessages } : prev);
          }
        });
      }, 1000);
    } catch (error) {
      console.error("Error fetching history:", error);
    }
  };

  const handleNewChat = () => {
    setCurrentConversation(null);
    setMessages([]);
    setStreamingMessage('');
    setActiveView('chat');
    if (window.innerWidth < 1024) setIsSidebarOpen(false);
  };

  const updateConversationMessages = async (id: string, newMessages: Message[]) => {
    try {
      const { error } = await supabase
        .from('conversations')
        .update({ 
          messages: newMessages, 
          updated_at: new Date().toISOString() 
        })
        .eq('id', id);
      
      if (error) throw error;
      return true;
    } catch (err) {
      console.error("[Chat] Failed to update history:", err);
      // We don't toast error here to avoid interrupting the flow, 
      // but the log will help debugging.
      return false;
    }
  };

  const handleSelectConversation = (id: string) => {
    const conv = conversations.find(c => c.id === id);
    if (conv) {
      setCurrentConversation(conv);
      
      // Filter out duplicate messages by ID and ensure every message has a unique ID
      const uniqueMessages = (conv.messages || []).reduce((acc: any[], curr: any, idx: number) => {
        const messageId = curr.id || `msg-legacy-${idx}`;
        if (!acc.find(m => m.id === messageId)) {
          acc.push({ ...curr, id: messageId });
        }
        return acc;
      }, []);
      
      setMessages(uniqueMessages);
      setStreamingMessage('');
      setActiveView('chat');
      if (window.innerWidth < 1024) setIsSidebarOpen(false);
    }
  };

  const handleDeleteConversation = (id: string) => {
    setDeleteConfirmId(id);
  };

  const confirmDeleteConversation = async () => {
    if (!deleteConfirmId) return;
    const id = deleteConfirmId;
    setDeleteConfirmId(null);
    try {
      const { error } = await supabase.from('conversations').delete().eq('id', id);
      if (error) throw error;
      setConversations(prev => prev.filter(c => c.id !== id));
      if (currentConversation?.id === id) {
        handleNewChat();
      }
      toast.success('Conversation deleted');
    } catch (err) {
      console.error("Error deleting conversation:", err);
      toast.error('Failed to delete conversation');
    }
  };

  const handleContextSubmit = async (data: any) => {
    const type = showContextForm!;
    setShowContextForm(null);
    
    let prompt = "";
    let title = "";

    if (type === 'idea') {
      prompt = `Generate 5 viral content ideas for ${data.topic} on ${data.platform} with a ${data.tone} tone.`;
      title = `${data.topic} Ideas`;
    } else if (type === 'script') {
      prompt = `Write a ${data.length} script for ${data.platform} about ${data.topic}.`;
      title = `${data.topic} Script`;
    } else if (type === 'hashtag') {
      prompt = `Generate ${data.count || 15} trending hashtags for ${data.topic} on ${data.platform}.`;
      title = `${data.topic} Hashtags`;
    } else if (type === 'image') {
      prompt = `Generate a ${data.style} image of: ${data.prompt}`;
      title = `${data.prompt.slice(0, 20)}... Image`;
    }

    await startConversation(type, title, prompt, data);
  };

  const conversationLockRef = useRef<Promise<any> | null>(null);

  const startConversation = async (
    type: ConversationType, 
    title: string, 
    initialPrompt: string, 
    metadata: any = {}, 
    shouldClearMessages = true
  ) => {
    if (!user) return null;

    // Guard to avoid duplicate conversation creation in React StrictMode
    if (conversationLockRef.current) {
      console.log("[Chat] Deduplicating dynamic startConversation call...");
      return conversationLockRef.current;
    }

    const newConversation = {
      user_id: user.id,
      title: title || 'New Chat',
      type: type,
      messages: [],
      metadata: metadata,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const creationPromise = (async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('conversations')
          .insert(newConversation)
          .select()
          .single();

        if (error) {
          console.error("Supabase insert error:", error);
          toast.error(`Failed to create conversation history`);
          setIsLoading(false);
          return null;
        }

        console.log("[Chat] Conversation created:", data.id);
        setCurrentConversation(data);
        setConversations(prev => {
          if (prev.some(c => c.id === data.id)) return prev;
          return [data, ...prev];
        });
        if (shouldClearMessages) {
          setMessages([]); // Ensure messages are cleared for new chat
        }
        
        return data;
      } catch (err) {
        console.error("Error in startConversation:", err);
        setIsLoading(false);
        return null;
      } finally {
        // Clear active lock after a thin grace period so future chats can trigger smoothly
        setTimeout(() => {
          conversationLockRef.current = null;
        }, 1000);
      }
    })();

    conversationLockRef.current = creationPromise;
    return creationPromise;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 20 * 1024 * 1024) { // 20MB limit
        toast.error('File too large. Please select a file under 20MB');
        return;
      }

      let type: 'image' | 'video' | 'document' | 'other' = 'other';
      if (file.type.startsWith('image/')) type = 'image';
      else if (file.type.startsWith('video/')) type = 'video';
      else if (file.type === 'application/pdf' || file.type.includes('word') || file.type.includes('text')) type = 'document';
      
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedAttachment({
          file,
          preview: reader.result as string,
          type
        });
      };
      reader.readAsDataURL(file);
    }
  };

  useEffect(() => {
    // Check for stripe success
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('success') === 'true') {
      toast.success('Payment successful! Your plan has been activated.');
      // Clean up the URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const clearAttachment = () => {
    setSelectedAttachment(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const sendMessage = async (content: string, convOverride?: any) => {
    let conv = convOverride || currentConversation;
    const trimmed = content.trim();

    if (!trimmed && !selectedAttachment) return;
    
    if (isLoading && !convOverride) {
      console.warn("[Chat] Busy generating previous response");
      return;
    }

    const userMessage: Message = {
      id: safeUUID(),
      role: 'user',
      content,
      image_url: selectedAttachment?.type === 'image' ? selectedAttachment.preview : undefined,
      attachment_name: selectedAttachment?.file.name,
      attachment_type: selectedAttachment?.type,
      created_at: new Date().toISOString()
    };

    // Smart Image Intent Detection
    const lowerContent = content.toLowerCase();
    const hasImageUpload = (selectedAttachment?.type === 'image') || messages.some((m: any) => m.image_url);
    const docExclusionFilter = /\b(pdf|docx|xlsx|word|excel|spreadsheet|csv|document|resume|report|cv|curriculum\s*vitae|invoice|presentation|budget|letter|email|cover\s*letter|essay|article|post|text|contract|agreement|outline|syllabus|proposal|workbook|chart|table|schema|blueprint|database)\b/i;
    const isImageIntent = 
      ((conv?.type === 'image') ||
       ((/generate|create|make|draw|design|show me|give me|i want|produce|paint|illustrate|visualize|render/i.test(lowerContent)) && 
        (/image|picture|photo|logo|flyer|poster|illustration|drawing|sketch|graphic|art|realistic|scene|portrait|landscape/i.test(lowerContent))) ||
       /\b(logo|flyer|poster|art|sketch|drawing)\b/i.test(lowerContent) ||
       /image of|picture of|photo of|generate an image|create an image|make an image|generate a picture|create a picture/i.test(lowerContent) ||
       /^realistic |^photorealistic /i.test(lowerContent) ||
       (hasImageUpload && /edit|modify|change|more professional|add text|similar style|re-create|recreate/i.test(lowerContent))) &&
      !docExclusionFilter.test(lowerContent);

    const isAnalysisIntent = !!selectedAttachment;

    // Check for usage limits
    if (profile) {
      const limits = PLAN_LIMITS[profile.plan as keyof typeof PLAN_LIMITS] || PLAN_LIMITS.free;
      
      if (isImageIntent) {
        if (profile.images_used_today >= limits.images) {
          toast.error('DAILY IMAGE LIMIT REACHED', {
            description: 'You have used all your image generation credits for today.'
          });
          setUpgradeReason('images');
          setShowUpgradeModal(true);
          return;
        }
      } else if (isAnalysisIntent) {
        if (profile.analysis_used_today >= (limits.analysis || 0)) {
          toast.error('ANALYSIS LIMIT REACHED', {
            description: 'You have reached your daily limit for file analysis.'
          });
          setUpgradeReason('usage');
          setShowUpgradeModal(true);
          return;
        }
      } else {
        if (profile.messages_used_today >= limits.messages) {
          toast.error('DAILY MESSAGE LIMIT REACHED', {
            description: 'Upgrade for unlimited conversations and faster responses.'
          });
          setUpgradeReason('usage');
          setShowUpgradeModal(true);
          return;
        }
      }
    }

    // INSTANT FEEDBACK AND CLEAR INPUTS IMMEDIATELY
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    const lastInput = content;
    setInput('');
    const currentAttachment = selectedAttachment; 
    clearAttachment(); 
    setIsLoading(true);
    if (isImageIntent) {
      setIsGeneratingImage(true);
      setCurrentImagePrompt(content);
    } else {
      setIsGeneratingImage(false);
      setCurrentImagePrompt('');
    }
    setStreamingMessage('');
    setHasError(false);
    setLastFailedRequest(null);

    if (generationAbortControllerRef.current) {
      generationAbortControllerRef.current.abort();
    }
    const controller = new AbortController();
    generationAbortControllerRef.current = controller;

    const timeoutId = setTimeout(() => {
      controller.abort();
      console.warn("[Chat] Timeout reached");
    }, 120000); // 2 minutes is safer for multi-fallback image generation and advanced searches

    try {
      // Lazy-create conversation history context if not already established (avoids blocking input on cold/slow database inserts)
      if (!conv) {
        console.log("[Chat] Lazily creating new conversation in background...");
        const type = currentAttachment ? 'general' : (isImageIntent ? 'image' : 'script');
        const rawTitle = content.trim() || (isImageIntent ? 'Image Generation' : (currentAttachment ? 'File Analysis' : 'New Chat'));
        const title = rawTitle.length > 50 ? rawTitle.slice(0, 47) + '...' : rawTitle;
        
        const newConv = await startConversation(type, title, content, {}, false);
        if (!newConv) {
          throw new Error("Failed to set up secure conversation channel. Please check your network connection.");
        }
        conv = newConv;
      }

      // Persist the newly sent user message to DB immediately so that on closure/refresh it is visible
      await updateConversationMessages(conv.id, updatedMessages);
      setConversations(prev => prev.map(c => c.id === conv.id ? { ...c, messages: updatedMessages, updated_at: new Date().toISOString() } : c));

      const lowerInput = content.toLowerCase();
      const searchKeywords = [
        "news", "weather", "price", "today", "latest", "current", "2024", "2025", "2026",
        "politics", "who is", "what happened", "stock", "dollar", "usd", "ngn", "naira",
        "exchange rate", "score", "match", "result", "live", "now", "crypto",
        "happening", "event", "bitcoin", "forecast", "market", "president", 
        "how much is", "price of", "time in", "update on", "current time", "inflation",
        "election", "winner of", "standings in", "scheduled for", "rate in", "worth in",
        "who won", "yesterday", "tonight", "who is currently", "latest on"
      ];
      const isSearchIntent = searchKeywords.some(k => lowerInput.includes(k)) || 
                           (lowerInput.includes("?") && (lowerInput.includes("who") || lowerInput.includes("how much") || lowerInput.includes("is there") || lowerInput.includes("what happened"))) ||
                           (lowerInput.includes("2024") || lowerInput.includes("2025") || lowerInput.includes("2026"));
      
      let activeModel = 'trelvix-mini';
      if (isImageIntent) activeModel = 'trelvix-visual';
      else if (isSearchIntent) activeModel = 'trelvix-ultra';

      console.log(`%c[Model Used] ${activeModel}`, 'color: #3b82f6; font-weight: bold; background: #eff6ff; padding: 2px 4px; border-radius: 4px;');
      console.log(`[Chat] Sending to /api/generate as type: ${isImageIntent ? 'image' : (conv.type || 'chat')}`);
      
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: isImageIntent ? 'image' : (conv.type || 'chat'),
          model: activeModel,
          prompt: content,
          messages: updatedMessages.map(m => ({
            role: m.role,
            content: m.content,
            image_url: m.image_url
          })),
          ready_to_copy: conv.metadata?.ready_to_copy || false,
          personality: profile?.personality || 'creative',
          conversationId: conv.id,
          userId: user?.id,
          image_speed: imageSpeed
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        let errorMessage = 'Failed to generate';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          const text = await response.text().catch(() => '');
          errorMessage = text || `Server Error ${response.status}`;
        }
        throw new Error(errorMessage);
      }

      if (isImageIntent) {
        const data = await response.json();
        const { image_url, filename, error: backendError } = data;
        
        if (backendError) throw new Error(backendError);
        if (!image_url) throw new Error("Image generation failed - no URL produced. Please try a simpler prompt.");

        // Save to dedicated images table
        const { data: imageData, error: imageError } = await supabase.from('images').insert({
          user_id: user.id,
          prompt: content,
          image_url: image_url
        }).select().single();

        if (imageError) {
          console.error("[Chat] Image save error:", imageError);
        }

        const assistantMessage: Message = {
          id: safeUUID(),
          role: 'assistant',
          content: data.description || "Here is your generated image:",
          image_url: imageData ? `db:${imageData.id}` : image_url,
          filename: filename || `trelvix-${Date.now()}.png`,
          model: activeModel,
          created_at: new Date().toISOString()
        };
        
        const finalMessages = [...updatedMessages, assistantMessage];
        setMessages(finalMessages);
        
        await updateConversationMessages(conv.id, finalMessages);
        
        if (profile) {
          await updateProfile({ images_used_today: (profile?.images_used_today || 0) + 1 });
        }
        
        setIsLoading(false);
        setIsGeneratingImage(false);
        return;
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';

      if (!reader) {
        throw new Error('Streaming response not available');
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        fullContent += chunk;
        setStreamingMessage(prev => prev + chunk);
      }

      const assistantMessage: Message = {
        id: safeUUID(),
        role: 'assistant',
        content: fullContent,
        model: activeModel,
        created_at: new Date().toISOString()
      };

      const finalMessages = [...updatedMessages, assistantMessage];
      setMessages(finalMessages);
      setStreamingMessage('');

      await updateConversationMessages(conv.id, finalMessages);
      
      if (profile) {
        const usageField = currentAttachment ? 'analysis_used_today' : 'messages_used_today';
        await updateProfile({ [usageField]: (profile?.[usageField as keyof Profile] as number || 0) + 1 });
      }

      setIsLoading(false);
    } catch (error: any) {
      clearTimeout(timeoutId);
      setIsGeneratingImage(false);
      
      const isAbortError = error.name === 'AbortError' || 
                           error.message?.includes('aborted') || 
                           error.message?.includes('AbortError') ||
                           error.message?.includes('signal is aborted');
                           
      if (isAbortError) {
        console.log("[Chat] Request aborted gracefully.");
        setIsLoading(false);
        return;
      }
      
      console.error("[Chat] Request Error:", error);
      
      setHasError(true);
      setLastFailedRequest({ content: lastInput, conv });
      toast.error(error.message || 'Connection failed. Please try again.');
      
      setIsLoading(false);
    }
  };

  const handleRetry = async (messageId?: string) => {
    if (messageId) {
      // Find the user's message just before this assistant message
      const msgIdx = messages.findIndex(m => m.id === messageId);
      if (msgIdx > 0) {
        const userMsg = messages[msgIdx - 1];
        if (userMsg.role === 'user') {
          // Remove all messages from this idx onwards
          const truncatedMessages = messages.slice(0, msgIdx);
          setMessages(truncatedMessages);
          if (currentConversation?.id) {
            await updateConversationMessages(currentConversation.id, truncatedMessages);
          }
          
          // Re-send
          sendMessage(userMsg.content);
          return;
        }
      }
    }

    if (lastFailedRequest) {
      // Remove last message from state and DB first to prevent duplication
      const truncated = messages.slice(0, messages.length - 1);
      setMessages(truncated);
      if (lastFailedRequest.conv?.id) {
        await updateConversationMessages(lastFailedRequest.conv.id, truncated);
      }
      sendMessage(lastFailedRequest.content, lastFailedRequest.conv);
    } else if (messages.length > 0 && messages[messages.length - 1].role === 'user') {
      const lastUserMsg = messages[messages.length - 1];
      const truncated = messages.slice(0, messages.length - 1);
      setMessages(truncated);
      if (currentConversation?.id) {
        await updateConversationMessages(currentConversation.id, truncated);
      }
      sendMessage(lastUserMsg.content, currentConversation);
    }
  };

  const handleDownload = () => {
    if (messages.length === 0) return;
    const text = messages.map(m => `${m.role.toUpperCase()}: ${m.content}\n\n`).join('---\n\n');
    const blob = new Blob([text], { type: 'text/plain' });
    downloadFile(blob, `trelvix-chat-${currentConversation?.title || 'export'}.txt`, 'text/plain');
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success('Logged out successfully');
  };

  const handleRenameConversation = async (id: string, newTitle: string) => {
    try {
      const { error } = await supabase
        .from('conversations')
        .update({ title: newTitle, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;

      setConversations(prev => prev.map(c => c.id === id ? { ...c, title: newTitle } : c));
      if (currentConversation?.id === id) {
        setCurrentConversation({ ...currentConversation, title: newTitle });
      }
      toast.success('Conversation renamed');
    } catch (error) {
      console.error("Error renaming:", error);
      toast.error('Failed to rename conversation');
    }
  };

  const handleApplyKey = async (key: string) => {
    if (!user || !profile) return;
    
    if (profile.plan === 'pro') {
      toast.info('You are already on the PRO plan');
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://wxezfzhhzlauggufecmm.supabase.co';
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind4ZXpmemhoemxhdWdndWZlY21tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyNTQxMjcsImV4cCI6MjA4OTgzMDEyN30.2nsDSFhOtm1Xs3RuZNDo74jGbBwd05E7lPP-FN5cd1Q';

      // We use fetch directly and avoid the 'apikey' header which is causing CORS issues
      // Supabase Edge Functions accept Authorization: Bearer <token>
      const response = await fetch(`${supabaseUrl}/functions/v1/activate-pro`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || supabaseAnonKey}`
        },
        body: JSON.stringify({ key })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        // Handle specific error cases for better UX
        if (response.status === 401 || response.status === 403) {
          throw new Error('Session expired. Please sign in again.');
        }
        throw new Error(errorData.error || `Activation failed (Status: ${response.status})`);
      }

      const data = await response.json();

      if (data?.success) {
        await fetchProfile();
        toast.success('Pro activated successfully for 30 days!');
      } else {
        // Show clear messages like "Invalid or expired key"
        const errorMessage = data?.error || 'Invalid or expired activation key. Please check and try again.';
        toast.error(errorMessage);
      }
    } catch (error: any) {
      console.error("Activation error details:", error);
      // Handle CORS/Network errors specifically
      if (error.message?.includes('Failed to fetch') || error.message?.includes('CORS')) {
        toast.error('Connection error: The activation server is currently unreachable. Please try again later.');
      } else {
        toast.error(error.message || 'Failed to activate Pro. Please try again.');
      }
    }
  };

  const handleFeedback = async (messageId: string, feedback: 'like' | 'dislike') => {
    if (!currentConversation) return;

    const updatedMessages = messages.map(m => {
      if (m.id === messageId) {
        // Toggle feedback
        return { ...m, feedback: m.feedback === feedback ? undefined : feedback };
      }
      return m;
    });

    setMessages(updatedMessages);

    try {
      await updateConversationMessages(currentConversation.id, updatedMessages);
      
      const isRemoving = messages.find(m => m.id === messageId)?.feedback === feedback;
      if (!isRemoving) {
        toast.success(feedback === 'like' ? 'Response Liked' : 'Response Disliked');
      }
    } catch (error) {
      console.error("Error saving feedback:", error);
      toast.error('Failed to save feedback');
    }
  };

  const handleShareMessage = async (m: Message) => {
    try {
      if (m.image_url) {
        // If it's an image, let's try to share the actual file if browser supports it
        let shareUrl = m.image_url;
        
        // If it's a supabase-stored image, fetch its real URL
        if (shareUrl.startsWith('db:')) {
          const imgId = shareUrl.split(':')[1];
          const { data, error } = await supabase.from('images').select('image_url').eq('id', imgId).single();
          if (!error && data?.image_url) {
            shareUrl = data.image_url;
          }
        }

        if (navigator.share && navigator.canShare) {
          try {
            const response = await fetch(shareUrl);
            const blob = await response.blob();
            const file = new File([blob], m.filename || 'trelvix-image.png', { type: blob.type });
            
            if (navigator.canShare({ files: [file] })) {
              await navigator.share({
                title: 'Trelvix AI Image',
                text: m.content || 'Check out this AI-generated image from Trelvix',
                files: [file],
                url: window.location.href
              });
              return;
            }
          } catch (fileErr) {
            console.warn("File sharing failed, falling back to text:", fileErr);
          }
        }
      }

      if (navigator.share) {
        await navigator.share({
          title: 'Trelvix AI Response',
          text: m.content,
          url: window.location.href
        });
      } else {
        const shareText = `Check out this AI response from Trelvix:\n\n${m.content}\n\nGenerated by Trelvix AI`;
        copyToClipboard(shareText);
        toast.success('Link copied to clipboard');
      }
    } catch (err) {
      console.error("Share failed:", err);
    }
  };

  const handleDownloadMessage = (content: string, id: string) => {
    const blob = new Blob([content], { type: 'text/plain' });
    downloadFile(blob, `trelvix-answer-${id.slice(0, 8)}.txt`, 'text/plain');
    toast.success('Download started');
  };

  const handleExpandImage = async (url: string, title: string) => {
    setZoomScale(1);
    setZoomPosition({ x: 0, y: 0 });
    if (!url) return;
    
    // Resolve DB reference immediately so the modal shows the full image without another loader delay
    if (url.startsWith('db:')) {
      const imgId = url.split(':')[1];
      const { data } = await supabase.from('images').select('image_url').eq('id', imgId).single();
      if (data?.image_url) {
        setExpandedImage({ url: data.image_url, title });
        return;
      }
    }
    
    setExpandedImage({ url, title });
  };

  const handleImageWheel = (e: React.WheelEvent) => {
    const zoomIntensity = 0.08;
    const delta = e.deltaY < 0 ? 1 : -1;
    const newScale = Math.min(Math.max(zoomScale + delta * zoomIntensity * zoomScale, 0.5), 6.0);
    
    setZoomScale(newScale);
    if (newScale <= 1.01) {
      setZoomPosition({ x: 0, y: 0 });
    }
  };

  const handleImageMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingImage(true);
    dragStartRef.current = {
      x: e.clientX - zoomPosition.x,
      y: e.clientY - zoomPosition.y
    };
  };

  const handleImageMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingImage) return;
    e.preventDefault();
    e.stopPropagation();
    
    if (zoomScale > 1) {
      const newX = e.clientX - dragStartRef.current.x;
      const newY = e.clientY - dragStartRef.current.y;
      setZoomPosition({ x: newX, y: newY });
    }
  };

  const handleImageMouseUpOrLeave = () => {
    setIsDraggingImage(false);
  };

  const handleImageTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      touchStartDistRef.current = dist;
      touchStartScaleRef.current = zoomScale;
      setIsDraggingImage(false);
    } else if (e.touches.length === 1) {
      const t = e.touches[0];
      setIsDraggingImage(true);
      dragStartRef.current = {
        x: t.clientX - zoomPosition.x,
        y: t.clientY - zoomPosition.y
      };
    }
  };

  const handleImageTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && touchStartDistRef.current !== null) {
      e.preventDefault();
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      
      const factor = dist / touchStartDistRef.current;
      const newScale = Math.min(Math.max(touchStartScaleRef.current * factor, 0.5), 6.0);
      
      setZoomScale(newScale);
      if (newScale <= 1.01) {
        setZoomPosition({ x: 0, y: 0 });
      }
    } else if (e.touches.length === 1 && isDraggingImage) {
      if (zoomScale > 1) {
        e.preventDefault();
        const t = e.touches[0];
        const newX = t.clientX - dragStartRef.current.x;
        const newY = t.clientY - dragStartRef.current.y;
        setZoomPosition({ x: newX, y: newY });
      }
    }
  };

  const handleImageTouchEnd = () => {
    touchStartDistRef.current = null;
    setIsDraggingImage(false);
  };

  const handleDownloadImage = async (url: string, filename: string) => {
    try {
      setIsDownloading(true);
      toast.loading('Preparing download...', { id: 'img-dl' });
      
      let downloadUrl = url;

      // If it's a DB reference, fetch the actual data first
      if (url.startsWith('db:')) {
        const imgId = url.split(':')[1];
        const { data, error } = await supabase.from('images').select('image_url').eq('id', imgId).single();
        if (error || !data?.image_url) throw new Error("Could not find image in database");
        downloadUrl = data.image_url;
      }

      // If it's a data URI, download directly with watermark (or without if Pro/Plus)
      const isProOrPlus = profile?.plan === 'pro' || profile?.plan === 'plus';

      if (downloadUrl.startsWith('data:')) {
        const watermarkedUrl = isProOrPlus ? downloadUrl : await applyWatermark(downloadUrl);
        await downloadFile(watermarkedUrl, filename.endsWith('.png') ? filename : `${filename}.png`, 'image/png');
        toast.success('Image download started', { id: 'img-dl' });
        return;
      }

      // Proxy fallback for remote URLs
      const response = await fetch('/api/proxy-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: downloadUrl })
      });
      
      if (!response.ok) throw new Error('Proxy fetch failed');
      
      const blob = await response.blob();
      
      // Convert blob to DataURL so we can watermark it in canvas
      const base64FromBlob = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      
      const watermarkedUrl = isProOrPlus ? base64FromBlob : await applyWatermark(base64FromBlob);
      
      await downloadFile(watermarkedUrl, filename.endsWith('.png') ? filename : `${filename}.png`, 'image/png');
      toast.success('Image download started', { id: 'img-dl' });
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Failed to download image. It may have expired.', { id: 'img-dl' });
    } finally {
      setIsDownloading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  if (!user) return (
    <div className={cn(isDarkMode && "dark")}>
      <AnimatePresence>
        {isSplashing && (
          <SplashScreen 
            isDarkMode={isDarkMode} 
            onComplete={() => setIsSplashing(false)} 
          />
        )}
      </AnimatePresence>
      <Auth onAuthSuccess={() => {}} isDarkMode={isDarkMode} />
      <button 
        onClick={() => setIsDarkMode(!isDarkMode)}
        className="fixed bottom-4 right-4 p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-full shadow-lg z-50"
      >
        {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
      </button>
      <Toaster 
        position="top-center" 
        theme={isDarkMode ? 'dark' : 'light'} 
        toastOptions={{
          style: {
            background: isDarkMode ? '#09090b' : 'white',
            color: isDarkMode ? '#f4f4f5' : '#18181b',
            border: `1px solid ${isDarkMode ? '#27272a' : '#e4e4e7'}`,
            borderRadius: '12px',
            fontSize: '13px',
            fontWeight: '600',
            boxShadow: isDarkMode ? '0 10px 30px -10px rgba(0,0,0,0.5)' : '0 10px 30px -10px rgba(0,0,0,0.1)'
          }
        }}
      />
    </div>
  );

  return (
    <div 
      style={{ height: viewportHeight }}
      className={cn("fixed inset-0 w-full flex bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans overflow-hidden", isDarkMode && "dark")}
    >
      <AnimatePresence>
        {isSplashing && (
          <SplashScreen 
            isDarkMode={isDarkMode} 
            onComplete={() => setIsSplashing(false)} 
          />
        )}
        {isSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 z-30 bg-black/40 backdrop-blur-[2px] lg:hidden cursor-pointer"
          />
        )}
      </AnimatePresence>
      <Sidebar 
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
        onNewChat={handleNewChat}
        onOpenSettings={() => {
          setShowSettings(true);
        }}
        onOpenApps={() => setActiveView('apps')}
        onOpenImages={() => setActiveView('images')}
        onOpenTTS={() => setActiveView('tts')}
        activeView={activeView}
        onLogout={handleLogout}
        profile={profile}
        conversations={conversations}
        currentConversationId={currentConversation?.id}
        onSelectConversation={(id) => {
          handleSelectConversation(id);
          setActiveView('chat');
        }}
        onDeleteConversation={handleDeleteConversation}
        onRenameConversation={handleRenameConversation}
      />

      <main className="flex-1 flex flex-col relative overflow-hidden">
        {/* Only show standard header for chat */}
        {activeView === 'chat' && (
          <header className="h-16 flex items-center justify-between px-4 border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md sticky top-0 z-30">
            <div className="flex items-center gap-2 md:gap-3">
              {!isSidebarOpen && (
                <button onClick={() => setIsSidebarOpen(true)} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-lg">
                  <Menu className="w-5 h-5" />
                </button>
              )}
              {!isSidebarOpen && (messages.length > 0 || streamingMessage) && (
                <TrelvixLogo className="w-6 h-6" glow={false} />
              )}
              <h1 className="font-bold text-lg hidden md:block">
                {currentConversation 
                  ? (currentConversation.title.split(' ').slice(0, 2).join(' ') + (currentConversation.title.split(' ').length > 2 ? '...' : '')) 
                  : 'Trelvix AI'}
              </h1>
              <h1 className="font-bold text-sm md:hidden block max-w-[150px] truncate">
                {currentConversation 
                  ? (currentConversation.title.split(' ').slice(0, 2).join(' ') + (currentConversation.title.split(' ').length > 2 ? '...' : '')) 
                  : 'Trelvix AI'}
              </h1>
            </div>

            <div className="flex items-center gap-2">
              <button 
                onClick={() => setActiveView('history')}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-500"
              >
                History
              </button>
              {messages.length > 0 && (
                <button 
                  onClick={handleDownload}
                  className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-lg transition-colors"
                  title="Download conversation"
                >
                  <Download className="w-5 h-5" />
                </button>
              )}
            </div>
          </header>
        )}

        {/* Content Area */}
        <div className={cn(
          "flex-1 flex flex-col min-h-0",
          (activeView === 'chat' || activeView === 'history') ? "overflow-y-auto overscroll-y-contain" : "overflow-hidden"
        )}>
          {activeView === 'apps' ? (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="px-6 pt-6 flex items-center justify-between md:hidden">
                <button 
                  onClick={() => setActiveView('chat')}
                  className="px-4 py-2 bg-zinc-100 dark:bg-zinc-900 rounded-xl text-xs font-bold"
                >
                  Back
                </button>
              </div>
              <AppsView 
                onBack={() => setActiveView('chat')}
                onSelectApp={(type) => {
                  if (type === 'tts') {
                    setActiveView('tts');
                  } else {
                    setShowContextForm(type);
                  }
                }} 
              />
            </div>
          ) : activeView === 'tts' ? (
            <TextToSpeechView 
              profile={profile}
              onUpgradeClick={() => setShowUpgradeModal(true)}
              onBack={() => setActiveView('chat')}
            />
          ) : activeView === 'images' ? (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center space-y-8 relative">
              <button 
                onClick={() => setActiveView('chat')}
                className="absolute top-6 left-6 px-4 py-2 bg-zinc-100 dark:bg-zinc-900 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-all"
              >
                Return to Chat
              </button>
              <ImageIcon className="w-16 h-16 text-orange-500" />
              <div className="space-y-4">
                <h2 className="text-4xl font-bold tracking-tight">Image Studio</h2>
                <p className="text-zinc-500 font-medium max-w-sm mx-auto mt-4 leading-relaxed">Generate high-fidelity AI images with proprietary studio quality.</p>
              </div>
              <button 
                onClick={() => {
                  setShowContextForm('image');
                }}
                className="px-8 py-4 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-2xl font-bold shadow-xl active:scale-[0.98] transition-all hover:shadow-orange-500/20"
              >
                Generate New Image
              </button>
            </div>
          ) : activeView === 'history' ? (
            <div className="max-w-4xl mx-auto w-full p-6 space-y-4">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-bold tracking-tight">Chat History</h2>
                <button 
                  onClick={() => setActiveView('chat')}
                  className="px-4 py-2 bg-zinc-100 dark:bg-zinc-900 rounded-xl text-xs font-semibold hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-all text-zinc-600 dark:text-zinc-400"
                >
                  Back to Chat
                </button>
              </div>
              {conversations.length === 0 ? (
                <div className="text-center py-20 opacity-50 flex flex-col items-center gap-4">
                  <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-900 rounded-full flex items-center justify-center">
                    <HistoryIcon className="w-8 h-8 opacity-20" />
                  </div>
                  <div className="font-bold">No chats yet. Start a new one!</div>
                </div>
              ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-12">
                    {conversations.map((conv, index) => (
                      <div
                        key={`history-conv-${conv.id || index}`}
                        className="p-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl text-left hover:border-zinc-400 dark:hover:border-zinc-600 transition-all group relative hover:shadow-xl"
                      >
                      <div onClick={() => {
                        handleSelectConversation(conv.id);
                        setActiveView('chat');
                      }} className="cursor-pointer">
                        <div className="flex items-center justify-between mb-4">
                          <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg">{conv.type}</span>
                          <span className="text-[10px] font-bold opacity-40 uppercase tracking-widest">{new Date(conv.created_at).toLocaleDateString()}</span>
                        </div>
                        <h3 className="font-bold mb-2 group-hover:text-zinc-900 dark:group-hover:text-white transition-colors">{conv.title}</h3>
                        <p className="text-xs opacity-60 line-clamp-2 leading-relaxed">
                          {conv.messages?.[0]?.content || 'No messages yet'}
                        </p>
                      </div>
                      
                      <div className="mt-6 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => {
                            const newTitle = prompt('Rename conversation:', conv.title);
                            if (newTitle) handleRenameConversation(conv.id, newTitle);
                          }}
                          className="flex-1 py-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                        >
                          Rename
                        </button>
                        <button 
                          onClick={() => handleDeleteConversation(conv.id)}
                          className="flex-1 py-2 bg-red-50 dark:bg-red-950/20 hover:bg-red-100 text-red-500 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <>
              {messages.length === 0 && !streamingMessage ? (
                <WelcomeScreen />
              ) : (
                <div className="max-w-3xl mx-auto w-full px-4 py-8 md:py-12 space-y-10 pb-36">
                  {messages.map((m, index) => (
                    <div 
                      key={`chat-msg-${m.id || index}`} 
                      onClick={() => setActiveMessageId(activeMessageId === m.id ? null : m.id)}
                      className={cn(
                        "flex w-full cursor-pointer md:cursor-default",
                        m.role === 'user' ? "justify-end" : "justify-start"
                      )}
                    >
                      <div className={cn(
                        "flex flex-col group relative transition-all duration-200",
                        m.role === 'user' ? "max-w-[85%] md:max-w-[75%] items-end" : "w-full"
                      )}>
                        <div className={cn(
                          "w-full text-sm md:text-base transition-all duration-200",
                          m.role === 'user' 
                            ? "bg-emerald-500/10 dark:bg-emerald-900/20 border border-emerald-500/20 dark:border-emerald-800/30 rounded-2xl md:rounded-[1.75rem] px-5 py-3.5 shadow-sm text-zinc-900 dark:text-zinc-50"
                            : "bg-transparent text-zinc-900 dark:text-zinc-100 border-none shadow-none px-0 py-1"
                        )}>
                          <div className={cn(
                            "prose dark:prose-invert max-w-none leading-relaxed prose-headings:font-normal prose-strong:font-normal prose-th:font-normal",
                            m.role === 'user' 
                              ? "font-normal text-zinc-800 dark:text-zinc-200 text-sm md:text-base md:leading-normal tracking-tight" 
                              : "prose-sm md:prose-base text-zinc-750 dark:text-zinc-300"
                          )}>
                            <ReactMarkdown 
                              remarkPlugins={[remarkMath, ...(loadedRemarkGfm ? [loadedRemarkGfm] : [])]}
                              rehypePlugins={[rehypeKatex]}
                              components={{
                                code({ node, inline, className, children, ...props }: any) {
                                  const isJsonFileData = !inline && (className?.includes('json-file-data') || className?.includes('language-json-file-data'));
                                  if (isJsonFileData) {
                                    return <DocumentExportCard jsonData={String(children)} isPro={profile?.plan === 'pro' || profile?.plan === 'plus'} />;
                                  }
                                  return (
                                    <CodeBlock inline={inline} className={className}>
                                      {children}
                                    </CodeBlock>
                                  );
                                },
                                strong({ children }) {
                                  return <span className="font-normal text-zinc-900 dark:text-zinc-100 inline">{children}</span>;
                                },
                                b({ children }) {
                                  return <span className="font-normal text-zinc-900 dark:text-zinc-100 inline">{children}</span>;
                                },
                                h1({ children }) {
                                  return <span className="block text-xl font-normal text-zinc-900 dark:text-zinc-100 mt-4 mb-2">{children}</span>;
                                },
                                h2({ children }) {
                                  return <span className="block text-lg font-normal text-zinc-900 dark:text-zinc-100 mt-4 mb-2">{children}</span>;
                                },
                                h3({ children }) {
                                  return <span className="block text-base font-normal text-zinc-900 dark:text-zinc-100 mt-3 mb-1">{children}</span>;
                                },
                                h4({ children }) {
                                  return <span className="block text-sm font-normal text-zinc-900 dark:text-zinc-100 mt-3 mb-1">{children}</span>;
                                }
                              }}
                            >
                              {preprocessMath(m.content)}
                            </ReactMarkdown>
                          </div>

                          {/* Generic Attachment Display */}
                          {m.attachment_type && m.attachment_type !== 'image' && (
                            <div className="mt-3 mb-2 p-3 bg-zinc-50 dark:bg-zinc-800/30 border border-zinc-200/60 dark:border-zinc-800/40 rounded-2xl flex items-center gap-3 w-fit min-w-[200px] max-w-full overflow-hidden shadow-sm">
                              <div className="w-10 h-10 shrink-0 rounded-lg bg-zinc-200/60 dark:bg-zinc-800 flex items-center justify-center text-zinc-600 dark:text-zinc-400">
                                {m.attachment_type === 'video' ? <Film className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold truncate text-zinc-900 dark:text-zinc-100">{m.attachment_name || 'Attached file'}</p>
                                <p className="text-[10px] opacity-50 uppercase tracking-wider font-extrabold">{m.attachment_type}</p>
                              </div>
                            </div>
                          )}

                          {m.image_url && (
                            <div className="mt-4 max-w-xl rounded-2xl overflow-hidden border border-zinc-200/80 dark:border-zinc-800/60 bg-zinc-50 dark:bg-zinc-900/40">
                              <div 
                                className="relative group/img cursor-zoom-in"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  handleExpandImage(m.image_url!, m.content);
                                }}
                              >
                                <ImageWithLoader 
                                  src={m.image_url} 
                                  alt="Generated" 
                                  className="w-full"
                                  skipWatermark={profile?.plan === 'pro' || profile?.plan === 'plus'}
                                />
                                <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover/img:opacity-100">
                                  <Maximize2 className="w-8 h-8 text-white drop-shadow-lg" />
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="mt-2.5 flex items-center justify-between w-full">
                          <div className="text-[10px] opacity-40 flex items-center gap-2">
                            <span>{new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                          <div className={cn(
                            "flex items-center gap-1.5 md:gap-2 transition-all duration-200",
                            activeMessageId === m.id ? "opacity-100 translate-y-0" : "opacity-0 md:group-hover:opacity-100 translate-y-1 md:translate-y-0"
                          )}>
                            <button 
                              onClick={(e) => { e.stopPropagation(); copyToClipboard(m.content); }}
                              className="p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors shrink-0"
                              title="Copy to clipboard"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                            
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleShareMessage(m); }}
                              className="p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-lg text-zinc-500 hover:text-zinc-500 dark:hover:text-zinc-400 transition-colors shrink-0"
                              title="Share message"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </button>

                            {m.role === 'assistant' && (
                              <>
                                <div className="h-4 w-[1px] bg-zinc-200 dark:bg-zinc-800 mx-0.5 shrink-0" />
                                
                                <button 
                                  onClick={(e) => { e.stopPropagation(); handleFeedback(m.id, 'like'); }}
                                  className={cn(
                                    "p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-lg transition-colors shrink-0",
                                    m.feedback === 'like' ? "text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20" : "text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
                                  )}
                                  title="Like response"
                                >
                                  <ThumbsUp className="w-3.5 h-3.5" />
                                </button>
                                
                                <button 
                                  onClick={(e) => { e.stopPropagation(); handleFeedback(m.id, 'dislike'); }}
                                  className={cn(
                                    "p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-lg transition-colors shrink-0",
                                    m.feedback === 'dislike' ? "text-rose-600 bg-rose-50 dark:bg-rose-950/20" : "text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
                                  )}
                                  title="Dislike response"
                                >
                                  <ThumbsDown className="w-3.5 h-3.5" />
                                </button>

                                <button 
                                  onClick={(e) => { e.stopPropagation(); handleRetry(m.id); }}
                                  className="p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors shrink-0"
                                  title="Retry response"
                                >
                                  <Plus className="w-4 h-4 rotate-45" />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Consolidated simple error UI */}
                  {((hasError || (messages.length > 0 && messages[messages.length - 1].role === 'user')) && !isLoading && !streamingMessage) && (
                    <motion.div 
                      key="error-state"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex justify-start py-4"
                    >
                      <div className="flex flex-col gap-2 p-4 bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm max-w-sm">
                        <div className="flex items-center gap-3">
                          <div className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                          </div>
                          <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                            Checking background generation...
                          </span>
                        </div>
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                          The server continues running in the background if your screen went off or was interrupted. We will retrieve and display your response the instant it finishes.
                        </p>
                        <div className="flex items-center gap-4 mt-2 pt-2 border-t border-zinc-200/50 dark:border-zinc-800/80">
                          <button 
                            onClick={() => handleRetry()}
                            className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline active:scale-95 flex items-center gap-1.5 transition-all"
                          >
                            <span>Force Retry</span>
                            <Plus className="w-3.5 h-3.5 rotate-45 text-emerald-600 dark:text-emerald-400" />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                  {(isLoading || streamingMessage) && (
                    <div className="flex justify-start w-full">
                      <div className="w-full bg-transparent text-zinc-900 dark:text-zinc-100 border-none shadow-none px-0 py-1 relative">
                        {streamingMessage ? (
                          <div className="prose dark:prose-invert prose-sm md:prose-base max-w-none leading-relaxed prose-headings:font-normal prose-strong:font-normal prose-th:font-normal">
                            <ReactMarkdown 
                              remarkPlugins={[remarkMath, ...(loadedRemarkGfm ? [loadedRemarkGfm] : [])]}
                              rehypePlugins={[rehypeKatex]}
                              components={{
                                code({ node, inline, className, children, ...props }: any) {
                                  const isJsonFileData = !inline && (className?.includes('json-file-data') || className?.includes('language-json-file-data'));
                                  if (isJsonFileData) {
                                    return <DocumentExportCard jsonData={String(children)} isPro={profile?.plan === 'pro' || profile?.plan === 'plus'} />;
                                  }
                                  return (
                                    <CodeBlock inline={inline} className={className}>
                                      {children}
                                    </CodeBlock>
                                  );
                                },
                                strong({ children }) {
                                  return <span className="font-normal text-zinc-900 dark:text-zinc-100 inline">{children}</span>;
                                },
                                b({ children }) {
                                  return <span className="font-normal text-zinc-900 dark:text-zinc-100 inline">{children}</span>;
                                },
                                h1({ children }) {
                                  return <span className="block text-xl font-normal text-zinc-900 dark:text-zinc-100 mt-4 mb-2">{children}</span>;
                                },
                                h2({ children }) {
                                  return <span className="block text-lg font-normal text-zinc-900 dark:text-zinc-100 mt-4 mb-2">{children}</span>;
                                },
                                h3({ children }) {
                                  return <span className="block text-base font-normal text-zinc-900 dark:text-zinc-100 mt-3 mb-1">{children}</span>;
                                },
                                h4({ children }) {
                                  return <span className="block text-sm font-normal text-zinc-900 dark:text-zinc-100 mt-3 mb-1">{children}</span>;
                                }
                              }}
                            >
                              {preprocessMath(streamingMessage)}
                            </ReactMarkdown>
                            <span className="inline-block w-2.5 h-4.5 ml-1 bg-zinc-900 dark:bg-white animate-pulse rounded-sm align-middle" />
                          </div>
                        ) : isGeneratingImage ? (
                          <motion.div 
                            initial={{ opacity: 0, scale: 0.98 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0 }}
                            className="mt-4 flex flex-col items-start gap-2"
                          >
                            <div className="relative w-72 h-72 sm:w-80 sm:h-80 aspect-square rounded-[24px] overflow-hidden bg-zinc-100/70 dark:bg-zinc-900/40 border border-zinc-200/50 dark:border-zinc-800/40 flex flex-col items-center justify-center shadow-inner animate-pulse">
                              <div className="flex flex-col items-center gap-3">
                                <Loader2 className="w-5 h-5 text-zinc-400 dark:text-zinc-500 animate-spin" />
                                <span className="text-zinc-400 dark:text-zinc-500 text-xs font-medium tracking-tight">
                                  Generating image...
                                </span>
                              </div>
                            </div>
                          </motion.div>
                        ) : (
                          <div className="flex items-center gap-3 py-2 px-1">
                            <div className="flex gap-1 items-center">
                              <span className="w-1.5 h-1.5 bg-zinc-400 dark:bg-zinc-500 rounded-full animate-bounce" />
                              <span className="w-1.5 h-1.5 bg-zinc-400 dark:bg-zinc-500 rounded-full animate-bounce [animation-delay:0.2s]" />
                              <span className="w-1.5 h-1.5 bg-zinc-400 dark:bg-zinc-500 rounded-full animate-bounce [animation-delay:0.4s]" />
                            </div>
                            <p className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">
                              fetching response
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>
              )}
            </>
          )}
        </div>

        {/* Input Area */}
        {activeView === 'chat' && (
          <div className="relative p-3 pb-4 sm:p-6 md:p-8 bg-white dark:bg-zinc-950 border-t border-zinc-100 dark:border-zinc-900/50">
            <div className="max-w-4xl mx-auto space-y-2 md:space-y-6">
              <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700/80 rounded-[2rem] md:rounded-[2.5rem] shadow-xl md:shadow-2xl focus-within:ring-2 focus-within:ring-zinc-900/5 dark:focus-within:ring-white/15 dark:focus-within:border-zinc-500 transition-all relative z-20 overflow-hidden shadow-zinc-500/5 dark:shadow-black/60">
                <AnimatePresence>
                  {selectedAttachment && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-100/50 dark:bg-zinc-800/30 p-2 md:p-4"
                    >
                      <div className="relative group/preview w-24 h-20 md:w-32 md:h-24 rounded-xl md:rounded-2xl overflow-hidden bg-white dark:bg-zinc-800 flex items-center justify-center border border-zinc-200 dark:border-zinc-700 shadow-sm">
                        {selectedAttachment.type === 'image' ? (
                          <img src={selectedAttachment.preview} alt="Upload Preview" className="w-full h-full object-cover" />
                        ) : (
                          <div className="flex flex-col items-center gap-1 md:gap-2 text-zinc-400">
                            {selectedAttachment.type === 'video' ? <Film className="w-5 h-5 md:w-6 md:h-6" /> : <FileText className="w-5 h-5 md:w-6 md:h-6" />}
                            <span className="text-[8px] md:text-[10px] font-black truncate max-w-[80px] md:max-w-[100px] uppercase tracking-widest">{selectedAttachment.file.name}</span>
                          </div>
                        )}
                        <button 
                          onClick={clearAttachment}
                          className="absolute top-1 right-1 md:top-2 md:right-2 p-1 md:p-1.5 bg-black/50 text-white rounded-full hover:bg-black transition-all opacity-100 md:opacity-0 md:group-hover/preview:opacity-100 scale-90 md:group-hover/preview:scale-100"
                        >
                          <X className="w-3.5 h-3.5 md:w-4 md:h-4" />
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="relative flex items-center px-1 md:px-2">
                  <input 
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  
                  <div className="flex-shrink-0">
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="p-3 md:p-4 text-zinc-400 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white hover:bg-white dark:hover:bg-zinc-800 transition-all rounded-2xl md:rounded-3xl"
                    >
                      <Paperclip className="w-4 h-4 md:w-5 md:h-5" />
                    </button>
                  </div>
 
                  <div className="flex-1 relative flex items-center">
                    <textarea
                      ref={textareaRef}
                      rows={1}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          sendMessage(input);
                        }
                      }}
                      placeholder={ 
                        profile && profile.messages_used_today >= (PLAN_LIMITS[profile.plan as keyof typeof PLAN_LIMITS] || PLAN_LIMITS.free).messages
                          ? "Daily limit reached. Click to upgrade." 
                          : (selectedAttachment ? `Ask about this ${selectedAttachment.type}...` : "Message Trelvix AI...")
                      }
                      className="w-full bg-transparent border-none rounded-none px-4 md:px-6 py-4 md:py-5 pr-14 md:pr-28 focus:ring-0 outline-none resize-none transition-all min-h-[56px] md:min-h-[64px] max-h-[200px] text-sm md:text-base font-normal text-zinc-900 dark:text-zinc-50 placeholder:text-zinc-400 dark:placeholder:text-zinc-300"
                    />
                    
                    <div className="absolute right-0 flex items-center gap-1 md:gap-2 mr-2">
                      <button 
                        onClick={() => sendMessage(input)}
                        disabled={(!input.trim() && !selectedAttachment) || isLoading}
                        className={cn(
                          "p-3 md:p-3.5 rounded-full transition-all shadow-xl flex items-center justify-center transform active:scale-95 flex-shrink-0",
                          input.trim() || selectedAttachment
                            ? "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900" 
                            : "text-zinc-300 dark:text-zinc-500 cursor-not-allowed border border-zinc-200 dark:border-zinc-700/80"
                        )}
                      >
                        <Send className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-center py-1">
                <p className="text-[8px] md:text-[10px] font-black uppercase tracking-[0.15em] md:tracking-[0.2em] opacity-20 text-center">
                  Trelvix AI may provide inaccurate info. Verify important facts.
                </p>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Modals */}
      <AnimatePresence>
        {showSettings && (
          <Settings 
            profile={profile} 
            onClose={() => setShowSettings(false)} 
            onUpdateProfile={updateProfile}
            onShowLegal={handleShowLegal}
            onUpgrade={() => {
              setUpgradeReason('manual');
              setShowUpgradeModal(true);
            }}
            isDarkMode={isDarkMode}
            onToggleTheme={() => setIsDarkMode(!isDarkMode)}
            imageSpeed={imageSpeed}
            onToggleImageSpeed={handleToggleImageSpeed}
          />
        )}
        {showContextForm && (
          <ContextForm 
            type={showContextForm} 
            onSubmit={handleContextSubmit} 
            onCancel={() => setShowContextForm(null)} 
          />
        )}
        {showLegal && (
          <LegalModal 
            type={showLegal} 
            onClose={handleCloseLegal} 
          />
        )}
        <UpgradeModal 
          isOpen={showUpgradeModal} 
          onClose={() => setShowUpgradeModal(false)} 
          reason={upgradeReason}
          profile={profile}
        />
      </AnimatePresence>

      {/* Image Lightbox */}
      <AnimatePresence>
        {expandedImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setExpandedImage(null)}
            className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex flex-col items-center justify-between p-4 md:p-6"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-5xl h-full flex flex-col items-center justify-between py-2 sm:py-4"
            >
              {/* Top Bar Controls */}
              <div className="w-full flex items-center justify-between z-10 gap-4 select-none mb-3 sm:mb-4 shrink-0">
                <div className="bg-black/60 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 max-w-[55%] sm:max-w-md shadow-md">
                  <p className="text-white text-xs sm:text-sm font-semibold truncate">{expandedImage.title || 'Generated Artwork'}</p>
                </div>

                <div className="flex items-center gap-2">
                  {/* Download Icon Button with 360 Loader */}
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      
                      // Convert user creation prompt/title to a clean, descriptive file slug
                      const cleanSlug = expandedImage.title
                        ? expandedImage.title
                            .trim()
                            .toLowerCase()
                            .slice(0, 80) // Keep file name inside standard length limits
                            .replace(/[^a-z0-9\s-]/g, '') // remove weird symbols
                            .replace(/\s+/g, '-') // convert spaces into clean dashes
                            .replace(/-+/g, '-') // prevent double dashes
                        : 'trelvix-ai-image';
                      
                      const computedFilename = cleanSlug || 'trelvix-ai-image';
                      handleDownloadImage(expandedImage.url, `${computedFilename}.png`);
                    }}
                    disabled={isDownloading}
                    className="flex items-center justify-center w-10 h-10 bg-white/10 hover:bg-white/20 active:scale-95 focus:outline-none disabled:pointer-events-none rounded-full text-white transition-all shadow-lg border border-white/10 relative"
                    title="Download High Res"
                  >
                    {isDownloading ? (
                      <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                    ) : (
                      <Download className="w-5 h-5" />
                    )}
                  </button>

                  {/* Share Icon Button */}
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleShareMessage({ content: expandedImage.title, image_url: expandedImage.url, role: 'assistant', id: 'img-share' } as any);
                    }}
                    className="flex items-center justify-center w-10 h-10 bg-white/10 hover:bg-white/20 active:scale-95 focus:outline-none rounded-full text-white transition-all shadow-lg border border-white/10"
                    title="Share Artwork"
                  >
                    <ExternalLink className="w-5 h-5" />
                  </button>

                  {/* Close Icon Button */}
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setExpandedImage(null);
                    }}
                    className="flex items-center justify-center w-10 h-10 bg-white/10 hover:bg-white/20 active:scale-95 focus:outline-none rounded-full text-white transition-all shadow-lg border border-white/10"
                    title="Close"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Main Image Viewport supporting interactive drag, scroll wheel, and touch pinch zoom */}
              <div 
                className="relative w-full flex-1 min-h-0 flex items-center justify-center bg-zinc-950/40 rounded-3xl border border-white/5 overflow-hidden select-none"
                onWheel={handleImageWheel}
                onMouseDown={handleImageMouseDown}
                onMouseMove={handleImageMouseMove}
                onMouseUp={handleImageMouseUpOrLeave}
                onMouseLeave={handleImageMouseUpOrLeave}
                onTouchStart={handleImageTouchStart}
                onTouchMove={handleImageTouchMove}
                onTouchEnd={handleImageTouchEnd}
              >
                <div 
                  className="w-full h-full flex items-center justify-center pointer-events-none"
                  style={{
                    transform: `translate3d(${zoomPosition.x}px, ${zoomPosition.y}px, 0) scale(${zoomScale})`,
                    transition: isDraggingImage ? 'none' : 'transform 0.15s ease-out',
                    transformOrigin: 'center center'
                  }}
                >
                  <ImageWithLoader 
                    src={expandedImage.url} 
                    alt={expandedImage.title} 
                    skipWatermark={profile?.plan === 'pro' || profile?.plan === 'plus'}
                    className="max-h-[75vh] md:max-h-[82vh] max-w-full w-auto h-auto object-contain select-none pointer-events-none shadow-2xl rounded-2xl border border-white/5"
                  />
                </div>

                {/* Ambient dynamic controls directly overlayed on the image viewport */}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/70 backdrop-blur-md px-4 py-2.5 rounded-full border border-white/10 flex items-center gap-4 shadow-lg pointer-events-auto">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setZoomScale(prev => {
                        const next = Math.max(prev - 0.25, 0.5);
                        if (next <= 1.01) setZoomPosition({ x: 0, y: 0 });
                        return next;
                      });
                    }}
                    className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/25 active:scale-90 text-white flex items-center justify-center transition-all"
                    title="Zoom Out"
                  >
                    <ZoomOut className="w-4 h-4" />
                  </button>

                  <span className="text-white text-xs font-mono font-medium tracking-wide min-w-[3rem] text-center select-none">
                    {Math.round(zoomScale * 100)}%
                  </span>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setZoomScale(prev => Math.min(prev + 0.25, 6.0));
                    }}
                    className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/25 active:scale-90 text-white flex items-center justify-center transition-all"
                    title="Zoom In"
                  >
                    <ZoomIn className="w-4 h-4" />
                  </button>

                  <div className="w-px h-4 bg-white/10" />

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setZoomScale(1);
                      setZoomPosition({ x: 0, y: 0 });
                    }}
                    className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/25 active:scale-90 text-white flex items-center justify-center transition-all"
                    title="Reset Zoom"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Light Subtitle Action Instruction Indicator */}
              <div className="mt-2 shrink-0 select-none text-[10px] text-white/30 font-semibold tracking-wider uppercase border-t border-white/5 pt-2 w-full text-center">
                <span>Pinch to zoom, scroll wheel to scale, or drag to pan around</span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Custom Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteConfirmId && (() => {
          const conversationToConfirm = conversations.find(c => c.id === deleteConfirmId);
          return (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeleteConfirmId(null)}
              className="fixed inset-0 z-[110] bg-black/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
            >
              <motion.div
                initial={{ scale: 0.95, y: 15, opacity: 0 }}
                animate={{ scale: 1, y: 0, opacity: 1 }}
                exit={{ scale: 0.95, y: 15, opacity: 0 }}
                transition={{ type: "spring", duration: 0.4 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl p-6 md:p-8 flex flex-col gap-6"
              >
                {/* Header */}
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400 rounded-2xl flex items-center justify-center shrink-0">
                    <Trash2 className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">Delete Conversation?</h3>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                      This action is permanent and cannot be undone. All messages and assets inside this chat will be lost.
                    </p>
                  </div>
                </div>

                {/* Conversation Details Box if title exists */}
                {conversationToConfirm && (
                  <div className="p-4 bg-zinc-50 dark:bg-zinc-950/40 border border-zinc-100 dark:border-zinc-800/80 rounded-2xl">
                    <span className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider block mb-1">Target Chat</span>
                    <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 line-clamp-2">
                      {conversationToConfirm.title || 'Untitled Session'}
                    </span>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setDeleteConfirmId(null)}
                    className="flex-1 py-3.5 px-4 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 font-bold rounded-2xl transition-colors text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmDeleteConversation}
                    className="flex-1 py-3.5 px-4 bg-red-600 hover:bg-red-700 text-white font-bold rounded-2xl transition-colors text-sm shadow-lg shadow-red-600/10 dark:shadow-red-900/10"
                  >
                    Delete Chat
                  </button>
                </div>
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      <Toaster 
        position="top-center" 
        theme={isDarkMode ? 'dark' : 'light'} 
        toastOptions={{
          style: {
            background: isDarkMode ? '#09090b' : 'white',
            color: isDarkMode ? '#f4f4f5' : '#18181b',
            border: `1px solid ${isDarkMode ? '#27272a' : '#e4e4e7'}`,
            borderRadius: '12px',
            fontSize: '13px',
            fontWeight: '600',
            boxShadow: isDarkMode ? '0 10px 30px -10px rgba(0,0,0,0.5)' : '0 10px 30px -10px rgba(0,0,0,0.1)'
          }
        }}
      />
    </div>
  );
}
