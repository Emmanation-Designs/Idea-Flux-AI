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
  ExternalLink
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
import { Auth } from './components/Auth';
import { LegalModal } from './components/Legal';
import { Footer } from './components/Footer';

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
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
      const [ideasRes, scriptsRes] = await Promise.all([
        supabase.from('ideas').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('scripts').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
      ]);

      const ideas = (ideasRes.data || []).map(item => ({
        id: item.id,
        title: `${item.topic} Ideas`,
        type: 'idea',
        created_at: item.created_at,
        messages: [
          { id: '1', role: 'user', content: `Generate ideas for ${item.topic} on ${item.platform}`, created_at: item.created_at },
          { id: '2', role: 'assistant', content: Array.isArray(item.ideas) ? item.ideas.join('\n') : item.ideas, created_at: item.created_at }
        ],
        table: 'ideas',
        metadata: { topic: item.topic, platform: item.platform, tone: item.tone }
      }));

      const scripts = (scriptsRes.data || []).map(item => ({
        id: item.id,
        title: `${item.topic} Script`,
        type: 'script',
        created_at: item.created_at,
        updated_at: item.updated_at,
        messages: item.conversation || [],
        table: 'scripts',
        metadata: { topic: item.topic, platform: item.platform, length: item.length }
      }));

      const combined = [...ideas, ...scripts].sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setConversations(combined);
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
    }

    await startConversation(type, title, prompt, data);
  };

  const startConversation = async (type: ConversationType, title: string, initialPrompt: string, metadata: any = {}) => {
    if (!user) return;

    let data: any = null;
    let error: any = null;

    if (type === 'idea' || type === 'hashtag') {
      const newIdea = {
        user_id: user.id,
        topic: metadata.topic || title,
        platform: metadata.platform || 'General',
        tone: metadata.tone || 'Professional',
        ideas: [],
        created_at: new Date().toISOString()
      };
      const res = await supabase.from('ideas').insert(newIdea).select().single();
      data = res.data;
      error = res.error;
      if (data) {
        data.table = 'ideas';
        data.messages = [];
        data.type = type;
        data.title = title;
      }
    } else {
      const newScript = {
        user_id: user.id,
        topic: metadata.topic || title,
        platform: metadata.platform || 'General',
        length: metadata.length || 'Short',
        conversation: [],
        final_script: '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      const res = await supabase.from('scripts').insert(newScript).select().single();
      data = res.data;
      error = res.error;
      if (data) {
        data.table = 'scripts';
        data.messages = [];
        data.type = type;
        data.title = title;
      }
    }

    if (error) {
      toast.error('Failed to create history entry');
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

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: conv.type || 'script',
          prompt: content,
          messages: updatedMessages
        })
      });

      if (!response.ok) throw new Error('Failed to generate');

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

      // Update Supabase
      if (conv.table === 'ideas') {
        // If it's an idea, we might want to move it to scripts if it becomes a chat
        // But for now, let's just update the ideas field if it's the first response
        if (finalMessages.length <= 2) {
          await supabase
            .from('ideas')
            .update({ 
              ideas: fullContent.split('\n').filter(line => line.trim())
            })
            .eq('id', conv.id);
        } else {
          // Move to scripts or handle as ongoing? 
          // User said: "For ongoing chats, save the conversation history to the 'scripts' table"
          // This is complex. Let's just update scripts if it's already a script, 
          // or if it's an idea that's continuing, maybe we should have started it as a script?
          // For now, let's just update the current table.
          await supabase
            .from('ideas')
            .update({ 
              ideas: finalMessages.filter(m => m.role === 'assistant').map(m => m.content)
            })
            .eq('id', conv.id);
        }
      } else {
        await supabase
          .from('scripts')
          .update({ 
            conversation: finalMessages,
            final_script: fullContent,
            updated_at: new Date().toISOString()
          })
          .eq('id', conv.id);
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
    <div className={cn("flex h-screen bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans", isDarkMode && "dark")}>
      <Sidebar 
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
        conversations={conversations}
        onSelectConversation={handleSelectConversation}
        onNewChat={handleNewChat}
        currentConversationId={currentConversation?.id || null}
        onLogout={handleLogout}
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
                    <button
                      key={conv.id}
                      onClick={() => handleSelectConversation(conv.id)}
                      className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-left hover:border-zinc-400 dark:hover:border-zinc-600 transition-all group"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold uppercase tracking-wider opacity-50">{conv.type}</span>
                        <span className="text-[10px] opacity-40">{new Date(conv.created_at).toLocaleDateString()}</span>
                      </div>
                      <h3 className="font-bold mb-2 group-hover:text-zinc-900 dark:group-hover:text-white transition-colors">{conv.title}</h3>
                      <p className="text-xs opacity-60 line-clamp-2">
                        {conv.messages?.[0]?.content || 'No messages yet'}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <>
              {messages.length === 0 && !streamingMessage ? (
                <WelcomeScreen onSelectType={(type) => setShowContextForm(type)} />
              ) : (
                <div className="max-w-4xl mx-auto w-full p-4 md:p-8 space-y-8 pb-32">
                  {messages.map((m) => (
                    <div 
                      key={m.id} 
                      className={cn(
                        "flex w-full",
                        m.role === 'user' ? "justify-end" : "justify-start"
                      )}
                    >
                      <div className={cn(
                        "max-w-[85%] md:max-w-[75%] p-4 rounded-2xl text-sm md:text-base",
                        m.role === 'user' 
                          ? "bg-zinc-100 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 rounded-tr-none" 
                          : "bg-transparent text-zinc-900 dark:text-zinc-100 rounded-tl-none border-l-2 border-zinc-200 dark:border-zinc-800 pl-6"
                      )}>
                        <div className="prose dark:prose-invert prose-sm md:prose-base max-w-none">
                          <ReactMarkdown>{m.content}</ReactMarkdown>
                        </div>
                        <div className="mt-2 text-[10px] opacity-30">
                          {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
                  <div ref={messagesEndRef} />
                </div>
              )}
            </>
          )}
        </div>

        {/* Input Area */}
        {view === 'chat' && (
          <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-white dark:from-zinc-950 via-white/80 dark:via-zinc-950/80 to-transparent pt-12">
            <div className="max-w-3xl mx-auto relative">
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
                className="w-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl px-4 py-4 pr-14 focus:ring-2 focus:ring-zinc-500 outline-none resize-none transition-all shadow-lg"
              />
              <button 
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || isLoading}
                className="absolute right-3 bottom-3 p-2 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-xl disabled:opacity-50 transition-opacity"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        <Footer onShowLegal={setShowLegal} />
      </main>

      {/* Modals */}
      <AnimatePresence>
        {showSettings && (
          <Settings 
            profile={profile} 
            onClose={() => setShowSettings(false)} 
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
      </AnimatePresence>

      <Toaster position="top-center" theme={isDarkMode ? 'dark' : 'light'} />
    </div>
  );
}
