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
  const [view, setView] = useState<'chat' | 'history'>('chat');
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
  const [upgradeReason, setUpgradeReason] = useState<'usage' | 'images'>('usage');
  
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

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
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

  useEffect(() => {
    // Initialize SpeechRecognition
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false; // Faster end-of-speech detection
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onstart = () => {
        setIsListening(true);
        // Barge-in: Stop AI if user starts talking
        if (currentAudio) {
          console.log("Barge-in: Stopping AI audio because user started talking");
          currentAudio.pause();
          setIsPlaying(false);
          setCurrentlyPlayingMessageId(null);
        }
        console.log("Speech recognition started");
      };

      recognitionRef.current.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }

        if (finalTranscript) {
          console.log("Speech recognition final result:", finalTranscript);
          transcriptRef.current += finalTranscript;
          setCurrentTranscript(transcriptRef.current);
        }
        
        if (interimTranscript) {
          setStreamingMessage(interimTranscript);
        }
      };

      recognitionRef.current.onerror = (event: any) => {
        if (event.error !== 'no-speech') {
          console.error("Speech recognition error:", event.error);
        }
        setIsListening(false);
        
        if (event.error === 'no-speech') {
          // Restart if in voice mode and not busy
          if (showVoiceMode && !isPlaying && !isLoading) {
            setTimeout(() => {
              try { recognitionRef.current?.start(); } catch(e) {}
            }, 100);
          }
        } else if (event.error === 'not-allowed') {
          toast.error("Microphone access denied.");
        }
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
        setStreamingMessage('');
        
        // Auto-send if we have content
        if (transcriptRef.current.trim() && showVoiceMode) {
          const textToSend = transcriptRef.current;
          transcriptRef.current = '';
          setCurrentTranscript('');
          setCurrentResponse('');
          setShouldPlayVoice(true);
          sendMessage(textToSend);
        } else if (showVoiceMode && !isPlaying && !isLoading && !isMuted) {
          // Restart listening if we stopped without content and aren't busy
          setTimeout(() => {
            try { recognitionRef.current?.start(); } catch(e) {}
          }, 100);
        }
      };
    } else {
      console.warn("SpeechRecognition API not supported in this browser.");
    }
  }, [showVoiceMode, isPlaying, isLoading, isMuted, currentAudio]);

  useEffect(() => {
    if (currentResponse && currentTranscript) {
      // Keep transcript for a moment then clear
      const timer = setTimeout(() => setCurrentTranscript(''), 2000);
      return () => clearTimeout(timer);
    }
  }, [currentResponse]);

  // Handle auto-sending when recognition ends
  useEffect(() => {
    if (!isListening && transcriptRef.current.trim() && showVoiceMode) {
      const textToSend = transcriptRef.current;
      console.log("Auto-sending transcript after recognition ended:", textToSend);
      
      // Reset for next turn
      transcriptRef.current = '';
      setCurrentTranscript('');
      setCurrentResponse('');
      setShouldPlayVoice(true);
      
      sendMessage(textToSend);
    }
  }, [isListening, showVoiceMode]);

  useEffect(() => {
    if (showVoiceMode && !isListening && !isPlaying && !isLoading && !isMuted) {
      setTimeout(() => {
        try { recognitionRef.current?.start(); } catch(e) {}
      }, 500);
    }
  }, [showVoiceMode]);

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

      if (!response.ok) throw new Error('Failed to generate voice');
      
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

  const fetchProfile = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    
    if (error && error.code === 'PGRST116') {
      // Create profile if not exists
      const newProfile = {
        id: user.id,
        email: user.email,
        usage_count: 0,
        max_usage: 15,
        plan: 'free',
        pro_expires_at: null
      };
      const { data: created } = await supabase.from('profiles').insert(newProfile).select().single();
      setProfile(created);
    } else {
      setProfile(data);
    }
  };

  const fetchConversations = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Filter out duplicates by ID and ensure every conversation has an ID
      const uniqueConversations = (data || []).reduce((acc: any[], curr: any) => {
        if (curr.id && !acc.find(c => c.id === curr.id)) {
          acc.push(curr);
        }
        return acc;
      }, []);
      
      setConversations(uniqueConversations);
    } catch (error) {
      console.error("Error fetching history:", error);
    }
  };

  const handleNewChat = () => {
    setCurrentConversation(null);
    setMessages([]);
    setStreamingMessage('');
    setView('chat');
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
      setView('chat');
      if (window.innerWidth < 1024) setIsSidebarOpen(false);
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
    if (!user) return;
    setIsLoading(true);

    try {
      const newConversation = {
        user_id: user.id,
        title: title,
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
        toast.error(`Failed to create history entry: ${error.message || 'Unknown error'}`);
        setIsLoading(false);
        return;
      }

      setCurrentConversation(data);
      setConversations(prev => {
        const exists = prev.some(c => c.id === data.id);
        if (exists) return prev;
        return [data, ...prev];
      });
      await sendMessage(initialPrompt, data);
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

  const clearAttachment = () => {
    setSelectedAttachment(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const sendMessage = async (content: string, convOverride?: any) => {
    let conv = convOverride || currentConversation;
    
    if (!conv && (content.trim() || selectedAttachment)) {
      console.log("No conversation found, starting new one...");
      const type = selectedAttachment ? 'general' : (showVoiceMode ? 'voice' : 'script');
      await startConversation(type, content.slice(0, 30) || (selectedAttachment ? 'File Analysis' : 'New Chat'), content);
      return;
    }

    if (!conv || (!content.trim() && !selectedAttachment)) return;
    if (isLoading && !convOverride) return;

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
      conv.type === 'image' || 
      ((/generate|create|make|draw|design|show me|give me|i want|produce|paint|illustrate|visualize|render/i.test(lowerContent)) && 
       (/image|picture|photo|logo|flyer|poster|illustration|drawing|sketch|graphic|art|realistic|scene|portrait|landscape/i.test(lowerContent))) ||
      /\b(logo|flyer|poster|art|sketch|drawing)\b/i.test(lowerContent) ||
      /image of|picture of|photo of|generate a|create a|make a/i.test(lowerContent) ||
      /^realistic |^photorealistic /i.test(lowerContent);

    // Check for usage limits
    if (profile && profile.plan === 'free') {
      // General usage limit (15 requests)
      if (profile.usage_count >= (profile.max_usage || 15)) {
        setUpgradeReason('usage');
        setShowUpgradeModal(true);
        return;
      }

      // Image generation limit (3 per day)
      if (isImageIntent) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const { count, error: countError } = await supabase
          .from('images')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .gte('created_at', today.toISOString());

        if (!countError && count !== null && count >= 3) {
          setUpgradeReason('images');
          setShowUpgradeModal(true);
          return;
        }
      }
    }

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput('');
    const currentAttachment = selectedAttachment; 
    clearAttachment(); 
    setIsLoading(true);
    setStreamingMessage('');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
      console.warn("Request timed out after 300 seconds");
    }, 300000); // 5 minutes

    try {
      // Primary: Server-side OpenAI (Uses Vercel Env Vars)
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: isImageIntent ? 'image' : (conv.type || 'script'),
          prompt: content,
          messages: updatedMessages,
          voice_option: voiceOption,
          ready_to_copy: conv.metadata?.ready_to_copy || false
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to generate');
      }

      if (isImageIntent) {
        const { image_url, filename } = await response.json();
        
        // Save to dedicated images table first to get an ID
        const { data: imageData, error: imageError } = await supabase.from('images').insert({
          user_id: user.id,
          prompt: content,
          image_url: image_url
        }).select().single();

        if (imageError) throw imageError;

        const assistantMessage: Message = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: `Generated image for: ${content}`,
          image_url: `db:${imageData.id}`, // Store lightweight reference in conversation
          filename,
          created_at: new Date().toISOString()
        };
        
        // Use the actual image_url (Base64) for current state so it shows up instantly without another fetch
        const stateMessage = { ...assistantMessage, image_url };
        const finalMessages = [...updatedMessages, assistantMessage];
        const stateMessages = [...updatedMessages, stateMessage];
        
        setMessages(stateMessages);
        
        await supabase.from('conversations').update({ 
          messages: finalMessages,
          updated_at: new Date().toISOString()
        }).eq('id', conv.id);
        
        if (profile) {
          const newCount = (profile.usage_count || 0) + 1;
          await supabase.from('profiles').update({ usage_count: newCount }).eq('id', user.id);
          setProfile({ ...profile, usage_count: newCount });
        }
        
        setIsLoading(false);
        return;
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';

      if (reader) {
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
      } else {
        throw new Error('Response body is empty or streaming not supported');
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
        const newCount = (profile.usage_count || 0) + 1;
        await supabase.from('profiles').update({ usage_count: newCount }).eq('id', user.id);
        setProfile({ ...profile, usage_count: newCount });
      }

      setIsLoading(false);
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        console.error("OpenAI Request Aborted:", error);
        toast.error('Request timed out. Please try again.');
      } else {
        console.error("OpenAI Error:", error);
        toast.error(error.message || 'Failed to generate response.');
      }
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
    a.download = `ideaflux-chat-${currentConversation?.title || 'export'}.txt`;
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

  const handleDeleteConversation = async (id: string) => {
    // Note: confirm() is blocked in iframes, so we delete directly or should use a custom modal.
    // For now, we'll proceed with deletion to ensure functionality works.
    try {
      const { error } = await supabase
        .from('conversations')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setConversations(prev => prev.filter(c => c.id !== id));
      if (currentConversation?.id === id) {
        handleNewChat();
      }
      toast.success('Conversation deleted');
    } catch (error) {
      console.error("Error deleting:", error);
      toast.error('Failed to delete conversation');
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
    a.download = `ideaflux-answer-${id.slice(0, 8)}.txt`;
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
        conversations={conversations}
        onSelectConversation={handleSelectConversation}
        onNewChat={handleNewChat}
        currentConversationId={currentConversation?.id || null}
        onLogout={handleLogout}
        onRename={handleRenameConversation}
        onDelete={handleDeleteConversation}
      />

      <main className="flex-1 flex flex-col relative overflow-hidden">
        {/* Header */}
        <header className="h-16 flex items-center justify-between px-4 border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md sticky top-0 z-30">
          <div className="flex items-center gap-3">
            {!isSidebarOpen && (
              <button onClick={() => setIsSidebarOpen(true)} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-lg">
                <Menu className="w-5 h-5" />
              </button>
            )}
            <h1 className="font-bold text-lg hidden md:block">
              {currentConversation ? currentConversation.title : 'Ideaflux AI'}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={() => setView(view === 'chat' ? 'history' : 'chat')}
              className={cn(
                "p-2 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-lg transition-colors",
                view === 'history' && "text-zinc-900 dark:text-white bg-zinc-100 dark:bg-zinc-900"
              )}
              title="History"
            >
              <HistoryIcon className="w-5 h-5" />
            </button>
            <button 
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-lg transition-colors"
            >
              {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <button 
              onClick={() => setShowSettings(true)}
              className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-lg transition-colors"
            >
              <SettingsIcon className="w-5 h-5" />
            </button>
            {messages.length > 0 && (
              <button 
                onClick={handleDownload}
                className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-lg transition-colors"
              >
                <Download className="w-5 h-5" />
              </button>
            )}
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto flex flex-col pb-4">
          {view === 'history' ? (
            <div className="max-w-4xl mx-auto w-full p-6 space-y-4">
              <h2 className="text-2xl font-bold mb-6">Chat History</h2>
              {conversations.length === 0 ? (
                <div className="text-center py-20 opacity-50">No chats yet. Start a new one!</div>
              ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {conversations.map((conv, idx) => (
                      <div
                      key={`history-conv-${conv.id || 'new'}-${idx}-${conv.created_at}`}
                        className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-left hover:border-zinc-400 dark:hover:border-zinc-600 transition-all group relative"
                      >
                      <div onClick={() => handleSelectConversation(conv.id)} className="cursor-pointer">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold uppercase tracking-wider opacity-50">{conv.type}</span>
                          <span className="text-[10px] opacity-40">{new Date(conv.created_at).toLocaleDateString()}</span>
                        </div>
                        <h3 className="font-bold mb-2 group-hover:text-zinc-900 dark:group-hover:text-white transition-colors">{conv.title}</h3>
                        <p className="text-xs opacity-60 line-clamp-2">
                          {conv.messages?.[0]?.content || 'No messages yet'}
                        </p>
                      </div>
                      
                      <div className="absolute right-2 bottom-2 flex items-center gap-1 md:opacity-0 md:group-hover:opacity-100 opacity-100 transition-opacity">
                        <button 
                          onClick={() => {
                            const newTitle = prompt('Rename conversation:', conv.title);
                            if (newTitle) handleRenameConversation(conv.id, newTitle);
                          }}
                          className="p-1.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={() => handleDeleteConversation(conv.id)}
                          className="p-1.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg text-zinc-500 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
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
                <WelcomeScreen onSelectType={(type) => {
                  if (type === 'voice') {
                    setShowVoiceMode(true);
                    toggleListening();
                  } else {
                    setShowContextForm(type);
                  }
                }} />
              ) : (
                <div className="max-w-4xl mx-auto w-full p-4 md:p-8 space-y-8 pb-32">
                  {messages.map((m, idx) => (
                    <div 
                      key={`chat-msg-${m.id || 'msg'}-${idx}-${m.created_at}`} 
                      onClick={() => setActiveMessageId(activeMessageId === m.id ? null : m.id)}
                      className={cn(
                        "flex w-full cursor-pointer md:cursor-default",
                        m.role === 'user' ? "justify-end" : "justify-start"
                      )}
                    >
                      <div className={cn(
                        "max-w-[85%] md:max-w-[75%] p-4 rounded-2xl text-sm md:text-base group relative",
                        m.role === 'user' 
                          ? "bg-zinc-100 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 rounded-tr-none" 
                          : "bg-transparent text-zinc-900 dark:text-zinc-100 rounded-tl-none border-l-2 border-zinc-200 dark:border-zinc-800 pl-6"
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
                          <span className="text-xs font-medium ml-1">Ideaflux is thinking...</span>
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
        {view === 'chat' && (
          <div className="relative p-4 bg-white dark:bg-zinc-950 border-t border-zinc-200 dark:border-zinc-800">
            <div className="max-w-3xl mx-auto space-y-4">
              {/* Voice Selection */}
              {showVoiceMode && (
                <div className="flex items-center justify-center gap-4 mb-2">
                  <button
                    onClick={() => setVoiceOption('alloy')}
                    className={cn(
                      "px-3 py-1 rounded-full text-xs font-medium transition-all",
                      voiceOption === 'alloy' ? "bg-zinc-900 dark:bg-white text-white dark:text-black" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500"
                    )}
                  >
                    Female (Alloy)
                  </button>
                  <button
                    onClick={() => setVoiceOption('echo')}
                    className={cn(
                      "px-3 py-1 rounded-full text-xs font-medium transition-all",
                      voiceOption === 'echo' ? "bg-zinc-900 dark:bg-white text-white dark:text-black" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500"
                    )}
                  >
                    Male (Echo)
                  </button>
                </div>
              )}
              {isListening && (
                <div className="flex items-center justify-center gap-2 text-zinc-500 animate-pulse mb-2">
                  <Mic className="w-4 h-4" />
                  <span className="text-sm font-medium">Listening...</span>
                </div>
              )}
              
              <div className="bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-lg transition-all focus-within:ring-2 focus-within:ring-zinc-200 dark:focus-within:ring-zinc-800">
                <AnimatePresence>
                  {selectedAttachment && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30 p-3"
                    >
                      <div className="relative group/preview w-32 h-20 rounded-xl overflow-hidden bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center border border-zinc-200 dark:border-zinc-700">
                        {selectedAttachment.type === 'image' ? (
                          <img src={selectedAttachment.preview} alt="Upload Preview" className="w-full h-full object-cover" />
                        ) : selectedAttachment.type === 'video' ? (
                          <div className="flex flex-col items-center gap-1 text-zinc-500">
                            <Film className="w-6 h-6" />
                            <span className="text-[10px] font-medium truncate max-w-[80px]">{selectedAttachment.file.name}</span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-1 text-zinc-500">
                            <FileText className="w-6 h-6" />
                            <span className="text-[10px] font-medium truncate max-w-[80px]">{selectedAttachment.file.name}</span>
                          </div>
                        )}
                        <button 
                          onClick={clearAttachment}
                          className="absolute top-1 right-1 p-1 bg-black/50 text-white rounded-full hover:bg-black transition-colors"
                          title="Cancel upload"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="relative flex items-end">
                  <input 
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  
                  <div className="pl-3 pb-2.5">
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="p-2.5 text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200/50 dark:hover:bg-zinc-800 transition-all rounded-xl"
                      title="Attach File"
                    >
                      <Paperclip className="w-5 h-5" />
                    </button>
                  </div>

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
                    placeholder={selectedAttachment ? `What should I do with this ${selectedAttachment.type}?` : "Ask Ideaflux AI anything..."}
                    className="w-full bg-transparent border-none rounded-none px-2 py-4 pr-24 focus:ring-0 outline-none resize-none transition-all min-h-[56px] max-h-[200px] text-sm md:text-base"
                  />
                  
                  <div className="absolute right-2 bottom-2 flex items-center gap-0.5">
                    <button 
                      onClick={() => {
                        setShowVoiceMode(true);
                        toggleListening();
                      }}
                      className="p-2.5 text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200/50 dark:hover:bg-zinc-800 transition-all rounded-xl"
                      title="Voice Chat"
                    >
                      <Waves className="w-5 h-5" />
                    </button>
                    <button 
                      onClick={() => sendMessage(input)}
                      disabled={(!input.trim() && !selectedAttachment) || isLoading}
                      className={cn(
                        "p-2.5 rounded-xl transition-all shadow-sm flex items-center justify-center",
                        input.trim() || selectedAttachment
                          ? "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:shadow-md active:scale-95" 
                          : "text-zinc-300 dark:text-zinc-700 cursor-not-allowed"
                      )}
                    >
                      <Send className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end px-2 gap-4">
                {isLoading && !streamingMessage && (
                  <div className="flex items-center gap-1.5 text-[10px] font-medium opacity-50">
                    <div className="w-1 h-1 bg-zinc-500 rounded-full animate-bounce" />
                    <div className="w-1 h-1 bg-zinc-500 rounded-full animate-bounce [animation-delay:0.2s]" />
                    <div className="w-1 h-1 bg-zinc-500 rounded-full animate-bounce [animation-delay:0.4s]" />
                    Thinking...
                  </div>
                )}
                {currentAudio && (
                  <button 
                    onClick={togglePlayback}
                    className="flex items-center gap-2 text-xs font-bold text-zinc-900 dark:text-white"
                  >
                    {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    {isPlaying ? 'Playing AI Voice' : 'Paused'}
                  </button>
                )}
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
            voiceOption={voiceOption}
            onVoiceOptionChange={setVoiceOption}
            autoPlayVoice={autoPlayVoice}
            onToggleAutoPlay={() => setAutoPlayVoice(!autoPlayVoice)}
            onShowLegal={setShowLegal}
            onApplyKey={handleApplyKey}
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
          transcript={streamingMessage || currentTranscript}
          response={currentResponse}
          isMuted={isMuted}
          onToggleMute={() => setIsMuted(!isMuted)}
          isSpeakerOn={isSpeakerOn}
          onToggleSpeaker={() => setIsSpeakerOn(!isSpeakerOn)}
          voiceOption={voiceOption}
          onVoiceOptionChange={setVoiceOption}
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
