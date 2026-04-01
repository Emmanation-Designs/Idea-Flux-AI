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
  Waves
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Toaster, toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { supabase } from './lib/supabase';
import type { Message, ConversationType, Profile } from './types';

// --- Components ---
import { Sidebar } from './components/Sidebar';
import { WelcomeScreen } from './components/WelcomeScreen';
import { ContextForm } from './components/ContextForm';
import { Settings } from './components/Settings';
import { VoiceMode } from './components/VoiceMode';
import { Auth } from './components/Auth';
import { LegalModal } from './components/Legal';

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
  
  const [activeMessageId, setActiveMessageId] = useState<string | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

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
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onstart = () => {
        setIsListening(true);
        console.log("Speech recognition started");
      };

      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        console.log("Speech recognition result:", transcript);
        if (transcript) {
          try {
            recognitionRef.current.stop();
          } catch (e) {
            console.warn("Error stopping recognition:", e);
          }
          setIsListening(false);
          setCurrentTranscript(transcript);
          setCurrentResponse('');
          setShouldPlayVoice(true);
          sendMessage(transcript);
        }
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error("Speech recognition error:", event.error);
        setIsListening(false);
        
        if (event.error === 'no-speech') {
          console.log("No speech detected.");
        } else if (event.error === 'not-allowed') {
          toast.error("Microphone access denied. Please check your browser settings.");
        } else if (event.error === 'network') {
          toast.error("Network error during speech recognition. Please check your connection.");
        } else if (event.error === 'service-not-allowed') {
          toast.error("Speech recognition service not allowed.");
        } else {
          toast.error(`Speech recognition failed: ${event.error}. Please try again.`);
        }
      };

      recognitionRef.current.onend = () => {
        console.log("Speech recognition ended");
        setIsListening(false);
      };
    } else {
      console.warn("SpeechRecognition API not supported in this browser.");
    }
  }, []);

  useEffect(() => {
    if (currentResponse && currentTranscript) {
      // Keep transcript for a moment then clear
      const timer = setTimeout(() => setCurrentTranscript(''), 2000);
      return () => clearTimeout(timer);
    }
  }, [currentResponse]);

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
    
    // If clicking the same message that is playing, toggle playback
    if (messageId && currentlyPlayingMessageId === messageId && currentAudio) {
      togglePlayback();
      return;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      setIsPlaying(true);
      if (messageId) setCurrentlyPlayingMessageId(messageId);

      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'voice',
          prompt: text,
          voice_option: voiceOption
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!response.ok) throw new Error('Failed to generate voice');
      const { audio } = await response.json();
      
      const audioBlob = new Blob([Uint8Array.from(atob(audio), c => c.charCodeAt(0))], { type: 'audio/mp3' });
      const audioUrl = URL.createObjectURL(audioBlob);
      const audioObj = new Audio(audioUrl);
      
      if (currentAudio) {
        currentAudio.pause();
        currentAudio.onended = null;
      }
      
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
      };

      audioObj.onerror = () => {
        setIsPlaying(false);
        setCurrentAudio(null);
        setCurrentlyPlayingMessageId(null);
        toast.error("Failed to play audio.");
      };
    } catch (error: any) {
      clearTimeout(timeoutId);
      console.error("Voice error:", error);
      setIsPlaying(false);
      setCurrentlyPlayingMessageId(null);
      if (error.name === 'AbortError') {
        toast.error("Voice generation timed out.");
      } else {
        toast.error("Failed to play voice response.");
      }
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
      setConversations(data || []);
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
      setMessages(conv.messages || []);
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
      return;
    }

    setCurrentConversation(data);
    setConversations([data, ...conversations]);
    await sendMessage(initialPrompt, data);
  };

  const sendMessage = async (content: string, convOverride?: any) => {
    let conv = convOverride || currentConversation;
    
    if (!conv && content.trim()) {
      // If no conversation exists, start a new 'script' one by default for ongoing chat
      await startConversation('script', content.slice(0, 30) || 'New Chat', content);
      return;
    }

    if (!conv || !content.trim() || isLoading) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      created_at: new Date().toISOString()
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput('');
    setIsLoading(true);
    setStreamingMessage('');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    try {
      console.log("Sending message to /api/generate:", { type: conv.type, prompt: content });
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: conv.type || 'script',
          prompt: content,
          messages: updatedMessages,
          voice_option: voiceOption
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("API Error:", response.status, errorData);
        throw new Error(errorData.error || 'Failed to generate');
      }

      if (conv.type === 'image') {
        const { image_url } = await response.json();
        const assistantMessage: Message = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: `Generated image for: ${content}`,
          image_url,
          created_at: new Date().toISOString()
        };
        
        const finalMessages = [...updatedMessages, assistantMessage];
        setMessages(finalMessages);
        
        // Save image to Supabase images table
        await supabase.from('images').insert({
          user_id: user.id,
          prompt: content,
          url: image_url,
          conversation_id: conv.id
        });

        await supabase.from('conversations').update({ 
          messages: finalMessages,
          updated_at: new Date().toISOString()
        }).eq('id', conv.id);
        
        return;
      }

      console.log("API response OK, starting to read stream...");
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            console.log("Stream reader done.");
            break;
          }
          const chunk = decoder.decode(value);
          console.log("Received chunk:", chunk.length, "chars");
          fullContent += chunk;
          setStreamingMessage(prev => prev + chunk);
          if (showVoiceMode) {
            setCurrentResponse(prev => prev + chunk);
          }
        }
      } else {
        console.warn("No reader available in response body.");
      }
      clearTimeout(timeoutId);

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: fullContent,
        created_at: new Date().toISOString()
      };

      const finalMessages = [...updatedMessages, assistantMessage];
      setMessages(finalMessages);
      setStreamingMessage('');

      // Auto-play voice if it's a voice conversation or triggered by mic or auto-play is on
      if (conv.type === 'voice' || shouldPlayVoice || autoPlayVoice) {
        playVoice(fullContent);
        setShouldPlayVoice(false);
      }

      // Update Supabase
      const { error: updateError } = await supabase
        .from('conversations')
        .update({ 
          messages: finalMessages,
          updated_at: new Date().toISOString()
        })
        .eq('id', conv.id);
      
      if (updateError) {
        console.error("Supabase update error:", updateError);
        toast.error(`Failed to save chat: ${updateError.message}`);
      }
      
      // Update usage
      if (profile) {
        const newCount = (profile.usage_count || 0) + 1;
        await supabase.from('profiles').update({ usage_count: newCount }).eq('id', user.id);
        setProfile({ ...profile, usage_count: newCount });
      }

    } catch (error) {
      toast.error('Something went wrong. Please try again.');
    } finally {
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
        <div className="flex-1 overflow-y-auto flex flex-col">
          {view === 'history' ? (
            <div className="max-w-4xl mx-auto w-full p-6 space-y-4">
              <h2 className="text-2xl font-bold mb-6">Chat History</h2>
              {conversations.length === 0 ? (
                <div className="text-center py-20 opacity-50">No chats yet. Start a new one!</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {conversations.map(conv => (
                    <div
                      key={conv.id}
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
                  {messages.map((m) => (
                    <div 
                      key={m.id} 
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
                          <ReactMarkdown>{m.content}</ReactMarkdown>
                        </div>
                        {m.image_url && (
                          <div className="mt-4 rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800">
                            <img src={m.image_url} alt="Generated" className="w-full h-auto" referrerPolicy="no-referrer" />
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                const a = document.createElement('a');
                                a.href = m.image_url!;
                                a.download = 'generated-image.png';
                                a.click();
                              }}
                              className="w-full py-2 bg-zinc-100 dark:bg-zinc-800 text-xs font-bold flex items-center justify-center gap-2 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                            >
                              <Download className="w-3.5 h-3.5" />
                              Download Image
                            </button>
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
                          <ReactMarkdown>{streamingMessage}</ReactMarkdown>
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
          <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-white dark:from-zinc-950 via-white/80 dark:via-zinc-950/80 to-transparent pt-12">
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
              
              <div className="relative">
                <textarea
                  rows={1}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage(input);
                    }
                  }}
                  placeholder="Ask Ideaflux AI anything..."
                  className="w-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl px-4 py-4 pr-24 focus:ring-2 focus:ring-zinc-500 outline-none resize-none transition-all shadow-lg"
                />
                <div className="absolute right-3 bottom-3 flex items-center gap-2">
                  <button 
                    onClick={() => {
                      setShowVoiceMode(true);
                      toggleListening();
                    }}
                    className="p-2 bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-xl hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-all"
                    title="Voice Chat"
                  >
                    <Waves className="w-5 h-5" />
                  </button>
                  <button 
                    onClick={() => sendMessage(input)}
                    disabled={!input.trim() || isLoading}
                    className="p-2 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-xl disabled:opacity-50 transition-opacity"
                  >
                    <Send className="w-5 h-5" />
                  </button>
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
        <VoiceMode 
          isOpen={showVoiceMode}
          onClose={() => {
            setShowVoiceMode(false);
            if (currentAudio) currentAudio.pause();
            if (isListening) recognitionRef.current?.stop();
            setIsPlaying(false);
            setIsListening(false);
            setCurrentTranscript('');
            setCurrentResponse('');
          }}
          isListening={isListening}
          isPlaying={isPlaying}
          isLoading={isLoading}
          onToggleListening={toggleListening}
          transcript={currentTranscript}
          response={currentResponse}
          isMuted={isMuted}
          onToggleMute={() => setIsMuted(!isMuted)}
          isSpeakerOn={isSpeakerOn}
          onToggleSpeaker={() => setIsSpeakerOn(!isSpeakerOn)}
          voiceOption={voiceOption}
          onVoiceOptionChange={setVoiceOption}
        />
      </AnimatePresence>

      <Toaster position="top-center" theme={isDarkMode ? 'dark' : 'light'} />
    </div>
  );
}
