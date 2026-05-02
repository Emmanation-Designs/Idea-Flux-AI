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
  User,
  ExternalLink,
  Copy,
  ThumbsUp,
  ThumbsDown,
  FileDown,
  MessageSquare,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Play,
  Pause,
  Image as ImageIcon,
  Edit2,
  Trash2,
  Waves,
  Maximize2,
  X,
  Paperclip,
  File as FileIcon,
  Film,
  FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Toaster, toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { supabase } from './lib/supabase';

import type { Message, ConversationType, Profile } from './types';

// --- Components ---
import { Sidebar } from './components/Sidebar';

const ImageWithLoader = ({ src, alt, className, onClick }: { src: string, alt: string, className?: string, onClick?: (e: React.MouseEvent) => void }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [displaySrc, setDisplaySrc] = useState(src.startsWith('db:') ? '' : src);

  useEffect(() => {
    if (src.startsWith('db:')) {
      const imgId = src.split(':')[1];
      supabase.from('images').select('image_url').eq('id', imgId).single()
        .then(({ data, error }) => {
          if (error || !data?.image_url) {
            console.error("Error fetching lazy image:", error);
            setHasError(true);
          } else {
            setDisplaySrc(data.image_url);
          }
        });
    } else {
      setDisplaySrc(src);
    }
  }, [src]);
  
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
import { VoiceMode } from './components/VoiceMode';
import { Auth } from './components/Auth';
import { LegalModal } from './components/Legal';
import { CodeBlock } from './components/CodeBlock';
import { UpgradeModal } from './components/UpgradeModal';
import { AppsView } from './components/AppsView';

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
  const [selectedAttachment, setSelectedAttachment] = useState<{ file: File, preview: string, type: 'image' | 'video' | 'document' | 'other' } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [expandedImage, setExpandedImage] = useState<{url: string, title: string} | null>(null);
  const [streamingMessage, setStreamingMessage] = useState('');
  const [activeView, setActiveView] = useState<'chat' | 'history' | 'apps' | 'images' | 'settings'>('chat');
  const [isListening, setIsListening] = useState(false);
  const [voiceOption, setVoiceOption] = useState<'alloy' | 'echo'>('alloy');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);
  const [currentlyPlayingMessageId, setCurrentlyPlayingMessageId] = useState<string | null>(null);
  const [shouldPlayVoice, setShouldPlayVoice] = useState(false);
  const [autoPlayVoice, setAutoPlayVoice] = useState(false);
  const [showVoiceMode, setShowVoiceMode] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [currentResponse, setCurrentResponse] = useState('');
  const transcriptRef = useRef('');
  const [activeMessageId, setActiveMessageId] = useState<string | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeReason, setUpgradeReason] = useState<'usage' | 'images' | 'manual'>('usage');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const voiceAbortControllerRef = useRef<AbortController | null>(null);

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
      
      if (event === 'PASSWORD_RECOVERY') {
        setShowSettings(true);
        // Dispatch custom event to tell Settings component to show reset form
        window.dispatchEvent(new CustomEvent('supabase-password-reset'));
      }
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

  useEffect(() => {
    // Initialize SpeechRecognition
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true; // Use continuous for better control
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'en-US';

      let silenceTimer: any = null;

      recognitionRef.current.onstart = () => {
        setIsListening(true);
        if (currentAudio) {
          currentAudio.pause();
          setIsPlaying(false);
          setCurrentlyPlayingMessageId(null);
        }
      };

      recognitionRef.current.onresult = (event: any) => {
        let interimTranscript = '';
        const currentResult = event.results[event.results.length - 1];
        
        if (currentResult.isFinal) {
          transcriptRef.current += currentResult[0].transcript;
          setCurrentTranscript(transcriptRef.current);
        } else {
          interimTranscript = currentResult[0].transcript;
          setStreamingMessage(interimTranscript);
        }

        // Fast silence detection: If no new speech for 1 second, assume end of turn
        if (silenceTimer) clearTimeout(silenceTimer);
        silenceTimer = setTimeout(() => {
          if (showVoiceMode && (transcriptRef.current.trim() || interimTranscript.trim())) {
            const finalSpeech = (transcriptRef.current + interimTranscript).trim();
            if (finalSpeech.length > 2) {
              transcriptRef.current = '';
              setCurrentTranscript('');
              setStreamingMessage('');
              setShouldPlayVoice(true);
              sendMessage(finalSpeech);
              try { recognitionRef.current?.stop(); } catch(e) {}
            }
          }
        }, 650); // Lowered to 650ms for hyper-snappy response
      };

      recognitionRef.current.onerror = (event: any) => {
        if (event.error !== 'no-speech') console.error("Speech error:", event.error);
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
        if (showVoiceMode && !isPlaying && !isLoading && !isMuted) {
          setTimeout(() => {
            try { recognitionRef.current?.start(); } catch(e) {}
          }, 300);
        }
      };
    }
    return () => {
      recognitionRef.current?.stop();
    };
  }, [showVoiceMode, isPlaying, isLoading, isMuted, currentAudio]);

  useEffect(() => {
    if (currentResponse && currentTranscript) {
      // Keep transcript for a moment then clear
      const timer = setTimeout(() => setCurrentTranscript(''), 2000);
      return () => clearTimeout(timer);
    }
  }, [currentResponse]);

  useEffect(() => {
    if (showVoiceMode && !isListening && !isPlaying && !isLoading && !isMuted) {
      setTimeout(() => {
        try { recognitionRef.current?.start(); } catch(e) {}
      }, 500);
    }
  }, [showVoiceMode, isListening, isPlaying, isLoading, isMuted]);

  const toggleListening = () => {
    if (isListening) {
      try {
        recognitionRef.current?.stop();
      } catch (e) {
        console.warn("Error stopping recognition:", e);
      }
      setIsListening(false);
    } else {
      if (isMuted) {
        setIsMuted(false);
      }
      try {
        transcriptRef.current = '';
        setCurrentTranscript('');
        setStreamingMessage('');
        recognitionRef.current?.start();
        setIsListening(true);
      } catch (e) {
        console.error("Error starting recognition:", e);
        toast.error("Failed to start microphone. Please try again.");
        setIsListening(false);
      }
    }
  };

  useEffect(() => {
    if (isMuted && isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    }
  }, [isMuted]);

  useEffect(() => {
    if (currentAudio) {
      currentAudio.muted = !isSpeakerOn;
    }
  }, [isSpeakerOn, currentAudio]);

  const playVoice = async (text: string, messageId?: string) => {
    if (!text) return;
    
    if (messageId && currentlyPlayingMessageId === messageId && currentAudio) {
      togglePlayback();
      return;
    }

    if (currentAudio) {
      currentAudio.pause();
      currentAudio.onended = null;
      setCurrentAudio(null);
    }
    if (voiceAbortControllerRef.current) {
      voiceAbortControllerRef.current.abort("New voice request");
    }

    const controller = new AbortController();
    voiceAbortControllerRef.current = controller;
    const timeoutId = setTimeout(() => controller.abort("Timeout"), 30000);

    try {
      setIsPlaying(true);
      if (messageId) setCurrentlyPlayingMessageId(messageId);

      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'tts',
          prompt: text,
          voice_option: voiceOption
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        console.error(`Voice API Error (${response.status}):`, response.statusText);
        const errorText = await response.text().catch(() => "Could not read error body");
        console.error("Voice Error body:", errorText);
        throw new Error('Failed to generate voice');
      }
      
      const { audio } = await response.json();
      if (!audio) throw new Error("No audio data");

      const audioBlob = new Blob([Uint8Array.from(atob(audio), c => c.charCodeAt(0))], { type: 'audio/mp3' });
      const audioUrl = URL.createObjectURL(audioBlob);
      const audioObj = new Audio(audioUrl);
      
      audioObj.muted = !isSpeakerOn;
      
      if (voiceAbortControllerRef.current !== controller) return;

      setCurrentAudio(audioObj);
      audioObj.play().catch(err => {
        console.error("Audio play error:", err);
        setIsPlaying(false);
        setCurrentlyPlayingMessageId(null);
      });
      
      audioObj.onended = () => {
        setIsPlaying(false);
        setCurrentAudio(null);
        setCurrentlyPlayingMessageId(null);
        if (showVoiceMode && !isMuted) {
          setTimeout(() => {
            try { recognitionRef.current?.start(); } catch(e) {}
          }, 300);
        }
      };

      audioObj.onerror = () => {
        setIsPlaying(false);
        setCurrentAudio(null);
        setCurrentlyPlayingMessageId(null);
      };
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') return;
      console.error("Voice error:", error);
      setIsPlaying(false);
      setCurrentlyPlayingMessageId(null);
    }
  };

  const togglePlayback = () => {
    if (currentAudio) {
      if (isPlaying) {
        currentAudio.pause();
      } else {
        currentAudio.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

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
        subscription_expires_at: null
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

      // Auto-migrate/heal expiring images
      uniqueConversations.forEach(async (conv: any) => {
        const messages = conv.messages || [];
        let updated = false;
        const newMessages = await Promise.all(messages.map(async (m: any) => {
          if (m.image_url && !m.image_url.startsWith('db:') && !m.image_url.startsWith('data:')) {
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
              }
            } catch (e) {
              console.error("Migration failed:", e);
            }
          }
          return m;
        }));

        if (updated) {
          await supabase.from('conversations').update({ messages: newMessages }).eq('id', conv.id);
        }
      });
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

  const handleDeleteConversation = async (id: string) => {
    if (!confirm('Are you sure you want to delete this conversation?')) return;
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

  const startConversation = async (type: ConversationType, title: string, initialPrompt: string, metadata: any = {}) => {
    if (!user || isLoading) return;
    setIsLoading(true);

    try {
      const newConversation = {
        user_id: user.id,
        title: title || 'New Chat',
        type: type,
        messages: [],
        metadata: metadata,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('conversations')
        .insert(newConversation)
        .select()
        .single();

      if (error) {
        console.error("Supabase insert error:", error);
        toast.error(`Failed to create conversation history`);
        setIsLoading(false);
        return;
      }

      console.log("[Chat] Conversation created:", data.id);
      setCurrentConversation(data);
      setConversations(prev => [data, ...prev]);
      
      // Important: wait a tiny bit for state to settle before sending first message
      setTimeout(() => {
        sendMessage(initialPrompt, data);
      }, 50);
    } catch (err) {
      console.error("Error in startConversation:", err);
      setIsLoading(false);
    }
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
    
    // If no conversation, start one first
    if (!conv && (content.trim() || selectedAttachment)) {
      if (isLoading) {
        console.warn("[Chat] Blocked overlapping conversation creation");
        return;
      }
      
      console.log("[Chat] No active conversation, creating new one...");
      const type = selectedAttachment ? 'general' : (showVoiceMode ? 'voice' : 'script');
      
      // Sanitized title
      const rawTitle = content.trim() || (selectedAttachment ? 'File Analysis' : 'New Chat');
      const title = rawTitle.length > 50 ? rawTitle.slice(0, 47) + '...' : rawTitle;
      
      await startConversation(type, title, content);
      return;
    }

    if (!conv || (!content.trim() && !selectedAttachment)) return;
    
    if (isLoading && !convOverride) {
      console.warn("[Chat] Busy generating previous response");
      return;
    }

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      image_url: selectedAttachment?.type === 'image' ? selectedAttachment.preview : undefined,
      attachment_name: selectedAttachment?.file.name,
      attachment_type: selectedAttachment?.type,
      created_at: new Date().toISOString()
    };

    // Smart Image Intent Detection
    const lowerContent = content.toLowerCase();
    const isImageIntent = 
      ((/generate|create|make|draw|design|show me|give me|i want|produce|paint|illustrate|visualize|render/i.test(lowerContent)) && 
       (/image|picture|photo|logo|flyer|poster|illustration|drawing|sketch|graphic|art|realistic|scene|portrait|landscape/i.test(lowerContent))) ||
      /\b(logo|flyer|poster|art|sketch|drawing)\b/i.test(lowerContent) ||
      /image of|picture of|photo of|generate a|create a|make a/i.test(lowerContent) ||
      /^realistic |^photorealistic /i.test(lowerContent);

    const isAnalysisIntent = !!selectedAttachment;

    // Check for usage limits
    if (profile) {
      const limits = PLAN_LIMITS[profile.plan as keyof typeof PLAN_LIMITS] || PLAN_LIMITS.free;
      
      if (isImageIntent) {
        if (profile.images_used_today >= limits.images) {
          setUpgradeReason('images');
          setShowUpgradeModal(true);
          return;
        }
      } else if (isAnalysisIntent) {
        if (profile.analysis_used_today >= (limits.analysis || 0)) {
          setUpgradeReason('usage');
          setShowUpgradeModal(true);
          return;
        }
      } else {
        if (profile.messages_used_today >= limits.messages) {
          setUpgradeReason('usage');
          setShowUpgradeModal(true);
          return;
        }
      }
    }

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    const lastInput = content;
    setInput('');
    const currentAttachment = selectedAttachment; 
    clearAttachment(); 
    setIsLoading(true);
    setStreamingMessage('');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
      console.warn("[Chat] Timeout reached");
    }, 60000); // 1 minute is usually enough for serverless

    try {
      console.log(`[Chat] Sending to /api/generate as type: ${isImageIntent ? 'image' : (conv.type || 'chat')}`);
      
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: isImageIntent ? 'image' : (conv.type === 'image' ? 'chat' : (conv.type || 'chat')),
          prompt: content,
          messages: updatedMessages.map(m => ({
            role: m.role,
            content: m.content,
            image_url: m.image_url
          })),
          voice_option: voiceOption,
          ready_to_copy: conv.metadata?.ready_to_copy || false,
          personality: profile?.personality || 'professional'
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
        const { image_url, filename } = data;
        
        if (!image_url) throw new Error("Image generation failed - no URL returned");

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
          id: crypto.randomUUID(),
          role: 'assistant',
          content: `Generated image for: ${content}`,
          image_url: imageData ? `db:${imageData.id}` : image_url,
          filename: filename || `trelvix-${Date.now()}.png`,
          created_at: new Date().toISOString()
        };
        
        const finalMessages = [...updatedMessages, assistantMessage];
        setMessages(finalMessages);
        
        await supabase.from('conversations').update({ 
          messages: finalMessages,
          updated_at: new Date().toISOString()
        }).eq('id', conv.id);
        
        if (profile) {
          await updateProfile({ images_used_today: (profile?.images_used_today || 0) + 1 });
        }
        
        setIsLoading(false);
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
        if (showVoiceMode) {
          setCurrentResponse(prev => prev + chunk);
        }
      }

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: fullContent,
        created_at: new Date().toISOString()
      };

      const finalMessages = [...updatedMessages, assistantMessage];
      setMessages(finalMessages);
      setStreamingMessage('');

      if (conv.type === 'voice' || shouldPlayVoice || autoPlayVoice) {
        playVoice(fullContent);
        setShouldPlayVoice(false);
      }

      await supabase.from('conversations').update({ 
        messages: finalMessages,
        updated_at: new Date().toISOString()
      }).eq('id', conv.id);
      
      if (profile) {
        const usageField = currentAttachment ? 'analysis_used_today' : 'messages_used_today';
        await updateProfile({ [usageField]: (profile?.[usageField as keyof Profile] as number || 0) + 1 });
      }

      setIsLoading(false);
    } catch (error: any) {
      clearTimeout(timeoutId);
      console.error("[Chat] Request Error:", error);
      
      toast.error(error.message || 'Connection failed. Please try again.');
      
      // Allow user to try again
      setInput(lastInput); 
      setIsLoading(false);
    }
  };

  const handleDownload = () => {
    if (messages.length === 0) return;
    const text = messages.map(m => `${m.role.toUpperCase()}: ${m.content}\n\n`).join('---\n\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trelvix-chat-${currentConversation?.title || 'export'}.txt`;
    a.click();
    URL.revokeObjectURL(url);
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
      const { error } = await supabase
        .from('conversations')
        .update({ 
          messages: updatedMessages,
          updated_at: new Date().toISOString()
        })
        .eq('id', currentConversation.id);

      if (error) throw error;
      
      const isRemoving = messages.find(m => m.id === messageId)?.feedback === feedback;
      if (!isRemoving) {
        toast.success(feedback === 'like' ? 'Liked' : 'Disliked');
      }
    } catch (error) {
      console.error("Error saving feedback:", error);
      toast.error('Failed to save feedback');
    }
  };

  const handleDownloadMessage = (content: string, id: string) => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trelvix-answer-${id.slice(0, 8)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Download started');
  };

  const handleExpandImage = async (url: string, title: string) => {
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

  const handleDownloadImage = async (url: string, filename: string) => {
    try {
      toast.loading('Preparing download...', { id: 'img-dl' });
      
      let downloadUrl = url;

      // If it's a DB reference, fetch the actual data first
      if (url.startsWith('db:')) {
        const imgId = url.split(':')[1];
        const { data, error } = await supabase.from('images').select('image_url').eq('id', imgId).single();
        if (error || !data?.image_url) throw new Error("Could not find image in database");
        downloadUrl = data.image_url;
      }

      // If it's a data URI, download directly
      if (downloadUrl.startsWith('data:')) {
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = filename.endsWith('.png') ? filename : `${filename}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
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
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename.endsWith('.png') ? filename : `${filename}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
      toast.success('Image download started', { id: 'img-dl' });
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Failed to download image. It may have expired.', { id: 'img-dl' });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  if (!user) return (
    <div className={cn(isDarkMode && "dark")}>
      <Auth onAuthSuccess={() => {}} isDarkMode={isDarkMode} />
      <button 
        onClick={() => setIsDarkMode(!isDarkMode)}
        className="fixed bottom-4 right-4 p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-full shadow-lg z-50"
      >
        {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
      </button>
      <Toaster position="top-center" theme={isDarkMode ? 'dark' : 'light'} />
    </div>
  );

  return (
    <div className={cn("flex h-[100dvh] bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans overflow-hidden", isDarkMode && "dark")}>
      <Sidebar 
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
        onNewChat={handleNewChat}
        onOpenSettings={() => {
          setShowSettings(true);
        }}
        onOpenApps={() => setActiveView('apps')}
        onOpenImages={() => setActiveView('images')}
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
            <div className="flex items-center gap-3">
              {!isSidebarOpen && (
                <button onClick={() => setIsSidebarOpen(true)} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-lg">
                  <Menu className="w-5 h-5" />
                </button>
              )}
              <h1 className="font-bold text-lg hidden md:block">
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
        <div className="flex-1 overflow-y-auto flex flex-col">
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
                  if (type === 'voice') {
                    setShowVoiceMode(true);
                    toggleListening();
                  } else {
                    setShowContextForm(type);
                  }
                }} 
              />
            </div>
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
                    {conversations.map((conv, idx) => (
                      <div
                        key={conv.id ? `history-conv-${conv.id}` : `history-conv-idx-${idx}`}
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
                <div className="max-w-4xl mx-auto w-full p-4 md:p-8 space-y-8 pb-32">
                  {messages.map((m, idx) => (
                    <div 
                      key={m.id ? `chat-msg-${m.id}` : `chat-msg-idx-${idx}`} 
                      onClick={() => setActiveMessageId(activeMessageId === m.id ? null : m.id)}
                      className={cn(
                        "flex w-full cursor-pointer md:cursor-default",
                        m.role === 'user' ? "justify-end" : "justify-start"
                      )}
                    >
                      <div className={cn(
                        "max-w-[85%] md:max-w-[75%] p-4 rounded-2xl text-sm md:text-base group relative",
                        m.role === 'user' 
                          ? "bg-zinc-100 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 rounded-tr-none border border-zinc-200/50 dark:border-zinc-800/50" 
                          : "bg-white dark:bg-zinc-900/50 text-zinc-900 dark:text-zinc-100 rounded-tl-none border border-zinc-200 dark:border-zinc-800 shadow-sm"
                      )}>
                        <div className="prose dark:prose-invert prose-sm md:prose-base max-w-none">
                          <ReactMarkdown 
                            remarkPlugins={[remarkGfm]}
                            components={{
                              code({ node, inline, className, children, ...props }: any) {
                                return (
                                  <CodeBlock inline={inline} className={className}>
                                    {children}
                                  </CodeBlock>
                                );
                              }
                            }}
                          >
                            {m.content}
                          </ReactMarkdown>
                        </div>

                        {/* Generic Attachment Display */}
                        {m.attachment_type && m.attachment_type !== 'image' && (
                          <div className="mt-3 mb-2 p-3 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl flex items-center gap-3 w-fit min-w-[200px] max-w-full overflow-hidden">
                            <div className="w-10 h-10 shrink-0 rounded-lg bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-zinc-600 dark:text-zinc-400">
                              {m.attachment_type === 'video' ? <Film className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium truncate text-zinc-900 dark:text-zinc-100">{m.attachment_name || 'Attached file'}</p>
                              <p className="text-[10px] opacity-50 uppercase tracking-wider font-bold">{m.attachment_type}</p>
                            </div>
                          </div>
                        )}

                        {m.image_url && (
                          <div className="mt-4 rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
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
                              />
                              <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover/img:opacity-100">
                                <Maximize2 className="w-8 h-8 text-white drop-shadow-lg" />
                              </div>
                            </div>
                            <div className="flex border-t border-zinc-200 dark:border-zinc-800">
                              <button 
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  handleExpandImage(m.image_url!, m.content);
                                }}
                                className="flex-1 py-2.5 bg-transparent text-[10px] font-bold flex items-center justify-center gap-2 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors border-r border-zinc-200 dark:border-zinc-800"
                              >
                                <Maximize2 className="w-3 h-3" />
                                EXPAND
                              </button>
                              <button 
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  handleDownloadImage(m.image_url!, m.filename || 'generated-image.png');
                                }}
                                className="flex-1 py-2.5 bg-transparent text-[10px] font-bold flex items-center justify-center gap-2 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
                              >
                                <Download className="w-3 h-3" />
                                DOWNLOAD
                              </button>
                            </div>
                          </div>
                        )}
                        <div className="mt-2 flex items-center justify-between">
                          <div className="text-[10px] opacity-30">
                            {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                          <div className={cn(
                            "flex items-center gap-2 transition-all duration-200",
                            activeMessageId === m.id ? "opacity-100 translate-y-0" : "opacity-0 md:group-hover:opacity-100 translate-y-1 md:translate-y-0"
                          )}>
                            <button 
                              onClick={(e) => { e.stopPropagation(); copyToClipboard(m.content); }}
                              className="p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors"
                              title="Copy to clipboard"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                            {m.role === 'assistant' && (
                              <>
                                <button 
                                  onClick={(e) => { e.stopPropagation(); playVoice(m.content, m.id); }}
                                  className={cn(
                                    "p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-lg transition-colors",
                                    currentlyPlayingMessageId === m.id ? "text-blue-600 bg-blue-50 dark:bg-blue-900/20" : "text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
                                  )}
                                  title={currentlyPlayingMessageId === m.id && isPlaying ? "Pause voice" : "Listen to response"}
                                >
                                  {currentlyPlayingMessageId === m.id && isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                                </button>
                                <button 
                                  onClick={(e) => { e.stopPropagation(); handleDownloadMessage(m.content, m.id); }}
                                  className="p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors"
                                  title="Download answer"
                                >
                                  <FileDown className="w-3.5 h-3.5" />
                                </button>
                                <button 
                                  onClick={(e) => { e.stopPropagation(); handleFeedback(m.id, 'like'); }}
                                  className={cn(
                                    "p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-lg transition-colors",
                                    m.feedback === 'like' ? "text-green-600 bg-green-50 dark:bg-green-900/20" : "text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
                                  )}
                                  title="Like"
                                >
                                  <ThumbsUp className="w-3.5 h-3.5" />
                                </button>
                                <button 
                                  onClick={(e) => { e.stopPropagation(); handleFeedback(m.id, 'dislike'); }}
                                  className={cn(
                                    "p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-lg transition-colors",
                                    m.feedback === 'dislike' ? "text-red-600 bg-red-50 dark:bg-red-900/20" : "text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
                                  )}
                                  title="Dislike"
                                >
                                  <ThumbsDown className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {streamingMessage && (
                    <div className="flex justify-start w-full">
                      <div className="max-w-[85%] md:max-w-[75%] p-4 rounded-2xl text-sm md:text-base bg-transparent text-zinc-900 dark:text-zinc-100 rounded-tl-none border-l-2 border-zinc-200 dark:border-zinc-800 pl-6">
                        <div className="prose dark:prose-invert prose-sm md:prose-base max-w-none">
                          <ReactMarkdown 
                            remarkPlugins={[remarkGfm]}
                            components={{
                              code({ node, inline, className, children, ...props }: any) {
                                return (
                                  <CodeBlock inline={inline} className={className}>
                                    {children}
                                  </CodeBlock>
                                );
                              }
                            }}
                          >
                            {streamingMessage}
                          </ReactMarkdown>
                        </div>
                        <motion.div 
                          animate={{ opacity: [0.4, 1, 0.4] }}
                          transition={{ repeat: Infinity, duration: 1.5 }}
                          className="w-2 h-4 bg-zinc-400 dark:bg-zinc-600 inline-block ml-1 align-middle"
                        />
                      </div>
                    </div>
                  )}

                  {isLoading && !streamingMessage && (
                    <div className="flex justify-start w-full">
                      <div className="max-w-[85%] md:max-w-[75%] p-4 rounded-2xl text-sm md:text-base bg-transparent text-zinc-900 dark:text-zinc-100 rounded-tl-none border-l-2 border-zinc-200 dark:border-zinc-800 pl-6">
                        <div className="flex items-center gap-2 text-zinc-500">
                          <motion.div
                            animate={{ scale: [1, 1.2, 1] }}
                            transition={{ repeat: Infinity, duration: 1, delay: 0 }}
                            className="w-1.5 h-1.5 bg-zinc-400 dark:bg-zinc-600 rounded-full"
                          />
                          <motion.div
                            animate={{ scale: [1, 1.2, 1] }}
                            transition={{ repeat: Infinity, duration: 1, delay: 0.2 }}
                            className="w-1.5 h-1.5 bg-zinc-400 dark:bg-zinc-600 rounded-full"
                          />
                          <motion.div
                            animate={{ scale: [1, 1.2, 1] }}
                            transition={{ repeat: Infinity, duration: 1, delay: 0.4 }}
                            className="w-1.5 h-1.5 bg-zinc-400 dark:bg-zinc-600 rounded-full"
                          />
                          <span className="text-xs font-medium ml-1">Trelvix is thinking...</span>
                        </div>
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
          <div className="relative p-6 md:p-8 bg-white dark:bg-zinc-950 border-t border-zinc-100 dark:border-zinc-900/50">
            <div className="max-w-4xl mx-auto space-y-4 md:space-y-6">
              <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[2rem] md:rounded-[2.5rem] shadow-xl md:shadow-2xl focus-within:ring-2 focus-within:ring-zinc-900/5 dark:focus-within:ring-white/5 transition-all relative z-20 overflow-hidden">
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
                      className="p-3 md:p-4 text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-white dark:hover:bg-zinc-800 transition-all rounded-2xl md:rounded-3xl"
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
                      placeholder={selectedAttachment ? `Ask about this ${selectedAttachment.type}...` : "Message Trelvix AI..."}
                      className="w-full bg-transparent border-none rounded-none px-2 md:px-4 py-4 md:py-5 pr-20 md:pr-28 focus:ring-0 outline-none resize-none transition-all min-h-[56px] md:min-h-[64px] max-h-[200px] text-sm md:text-base font-medium placeholder:text-zinc-400"
                    />
                    
            <div className="absolute right-0 flex items-center gap-1.5 md:gap-3 mr-2">
                      <button 
                        onClick={() => {
                          setShowVoiceMode(true);
                          toggleListening();
                        }}
                        className="p-3 md:p-4 text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-white dark:hover:bg-zinc-800 transition-all rounded-2xl md:rounded-full"
                      >
                        <Waves className="w-5 h-5" />
                      </button>
                      <button 
                        onClick={() => sendMessage(input)}
                        disabled={(!input.trim() && !selectedAttachment) || isLoading}
                        className={cn(
                          "p-3 md:p-4 rounded-2xl md:rounded-full transition-all shadow-xl flex items-center justify-center transform active:scale-95",
                          input.trim() || selectedAttachment
                            ? "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900" 
                            : "text-zinc-300 dark:text-zinc-700 cursor-not-allowed border border-zinc-200 dark:border-zinc-800"
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
            onShowLegal={setShowLegal}
            onUpgrade={() => {
              setUpgradeReason('manual');
              setShowUpgradeModal(true);
            }}
            isDarkMode={isDarkMode}
            onToggleTheme={() => setIsDarkMode(!isDarkMode)}
            autoPlayVoice={autoPlayVoice}
            onToggleAutoPlay={() => setAutoPlayVoice(!autoPlayVoice)}
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
            onClose={() => setShowLegal(null)} 
          />
        )}
        <UpgradeModal 
          isOpen={showUpgradeModal} 
          onClose={() => setShowUpgradeModal(false)} 
          reason={upgradeReason}
          profile={profile}
        />
        <VoiceMode 
          isOpen={showVoiceMode}
          onClose={() => {
            setShowVoiceMode(false);
            if (currentAudio) {
              currentAudio.pause();
              setCurrentAudio(null);
            }
            try {
              recognitionRef.current?.stop();
            } catch(e) {}
            setIsPlaying(false);
            setIsListening(false);
            setCurrentTranscript('');
            setCurrentResponse('');
            transcriptRef.current = '';
          }}
          isListening={isListening}
          isPlaying={isPlaying}
          isLoading={isLoading}
          onToggleListening={toggleListening}
          isSpeakerOn={isSpeakerOn}
          onToggleSpeaker={() => setIsSpeakerOn(!isSpeakerOn)}
          voiceOption={voiceOption}
          onVoiceOptionChange={(voice) => setVoiceOption(voice as any)}
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
            className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex flex-col items-center justify-center p-4 md:p-10"
          >
            <motion.button
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="absolute top-6 right-6 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
              onClick={() => setExpandedImage(null)}
            >
              <X className="w-6 h-6" />
            </motion.button>

            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-[95vw] h-full flex flex-col items-center justify-center"
            >
              <div className="relative group rounded-xl overflow-hidden shadow-2xl bg-zinc-900/50 flex items-center justify-center max-h-[85vh] w-full">
                <ImageWithLoader 
                  src={expandedImage.url} 
                  alt={expandedImage.title} 
                  className="max-h-[85vh] w-auto max-w-full object-contain"
                />
                <div className="absolute top-4 left-4 right-4 pointer-events-none">
                  <div className="bg-black/40 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 w-fit max-w-full">
                    <p className="text-white text-xs font-medium truncate">{expandedImage.title}</p>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex items-center gap-3">
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleDownloadImage(expandedImage.url, 'expanded-image.png');
                  }}
                  className="flex items-center gap-2 px-8 py-3 bg-white text-black rounded-full font-bold hover:bg-zinc-200 transition-colors shadow-lg"
                >
                  <Download className="w-5 h-5" />
                  Download High Res
                </button>
                <button
                  onClick={() => setExpandedImage(null)}
                  className="flex items-center gap-2 px-8 py-3 bg-white/10 text-white rounded-full font-bold hover:bg-white/20 transition-colors border border-white/10"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <Toaster position="top-center" theme={isDarkMode ? 'dark' : 'light'} />
    </div>
  );
}
