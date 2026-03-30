import { useState, useEffect, useRef } from 'react';
import { 
  Plus, 
  History, 
  Settings as SettingsIcon, 
  Send, 
  Moon, 
  Sun, 
  Menu, 
  X, 
  Download, 
  LogOut, 
  Zap, 
  MessageSquare, 
  FileText, 
  Hash,
  ChevronRight,
  User,
  Eye,
  EyeOff,
  ExternalLink
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Toaster, toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { supabase } from './lib/supabase';
import type { Message, Conversation, ConversationType, Profile } from './types';

// --- Utils ---
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Components ---

const Sidebar = ({ 
  isOpen, 
  setIsOpen, 
  conversations, 
  onSelectConversation, 
  onNewChat,
  currentConversationId,
  onLogout
}: { 
  isOpen: boolean; 
  setIsOpen: (open: boolean) => void;
  conversations: Conversation[];
  onSelectConversation: (id: string) => void;
  onNewChat: () => void;
  currentConversationId: string | null;
  onLogout: () => void;
}) => {
  return (
    <motion.aside
      initial={false}
      animate={{ width: isOpen ? 280 : 0, opacity: isOpen ? 1 : 0 }}
      className={cn(
        "fixed lg:relative inset-y-0 left-0 z-40 bg-zinc-50 dark:bg-zinc-950 border-r border-zinc-200 dark:border-zinc-800 overflow-hidden flex flex-col transition-all duration-300 ease-in-out",
        !isOpen && "pointer-events-none lg:pointer-events-auto"
      )}
    >
      <div className="p-4 flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800">
        <h2 className="font-bold text-lg flex items-center gap-2">
          <Zap className="w-5 h-5 text-zinc-900 dark:text-white" />
          Ideaflux AI
        </h2>
        <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-md">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="p-4">
        <button 
          onClick={onNewChat}
          className="w-full flex items-center justify-center gap-2 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 py-2.5 rounded-xl font-medium hover:opacity-90 transition-opacity"
        >
          <Plus className="w-4 h-4" />
          New Chat
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 space-y-1">
        <div className="px-3 py-2 text-xs font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-2">
          <History className="w-3 h-3" />
          History
        </div>
        {conversations.length === 0 ? (
          <div className="px-3 py-4 text-sm text-zinc-400 italic">No history yet</div>
        ) : (
          conversations.map((conv) => (
            <button
              key={conv.id}
              onClick={() => onSelectConversation(conv.id)}
              className={cn(
                "w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors flex flex-col gap-0.5",
                currentConversationId === conv.id 
                  ? "bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-white" 
                  : "hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-600 dark:text-zinc-400"
              )}
            >
              <div className="font-medium truncate">{conv.title}</div>
              <div className="flex items-center gap-2 text-[10px] opacity-60">
                {conv.type === 'idea' && <MessageSquare className="w-2.5 h-2.5" />}
                {conv.type === 'script' && <FileText className="w-2.5 h-2.5" />}
                {conv.type === 'hashtag' && <Hash className="w-2.5 h-2.5" />}
                <span className="capitalize">{conv.type}</span>
                <span>•</span>
                <span>{new Date(conv.created_at).toLocaleDateString()}</span>
              </div>
            </button>
          ))
        )}
      </div>

      <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 space-y-2">
        <button 
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-3 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Logout
        </button>
      </div>
    </motion.aside>
  );
};

const WelcomeScreen = ({ onSelectType }: { onSelectType: (type: ConversationType) => void }) => {
  const suggestions = [
    { 
      id: 'idea', 
      title: 'Create Idea', 
      desc: 'Viral content ideas for any niche', 
      icon: MessageSquare,
      color: 'text-blue-500',
      bg: 'bg-blue-50 dark:bg-blue-950/20'
    },
    { 
      id: 'script', 
      title: 'Create Script', 
      desc: 'High-retention video scripts', 
      icon: FileText,
      color: 'text-purple-500',
      bg: 'bg-purple-50 dark:bg-purple-950/20'
    },
    { 
      id: 'hashtag', 
      title: 'Create Hashtags', 
      desc: 'Optimized tags for reach', 
      icon: Hash,
      color: 'text-emerald-500',
      bg: 'bg-emerald-50 dark:bg-emerald-950/20'
    },
  ];

  return (
    <div className="max-w-3xl mx-auto w-full flex flex-col items-center justify-start pt-12 md:justify-center md:pt-0 min-h-[60vh] px-4">
      <div className="flex flex-row gap-3 w-full overflow-x-auto pb-4 no-scrollbar md:grid md:grid-cols-3 md:gap-4 md:overflow-visible">
        {suggestions.map((s, i) => (
          <motion.button
            key={s.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            onClick={() => onSelectType(s.id as ConversationType)}
            className="flex-shrink-0 w-[140px] md:w-full group p-4 md:p-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-left hover:border-zinc-400 dark:hover:border-zinc-600 transition-all hover:shadow-lg"
          >
            <div className={cn("w-9 h-9 md:w-12 md:h-12 rounded-xl flex items-center justify-center mb-2.5 md:mb-4 transition-transform group-hover:scale-110", s.bg)}>
              <s.icon className={cn("w-4 h-4 md:w-6 h-6", s.color)} />
            </div>
            <h3 className="font-bold text-xs md:text-lg mb-0.5 md:mb-1">{s.title}</h3>
            <p className="text-[9px] md:text-sm text-zinc-500 dark:text-zinc-400 line-clamp-2">{s.desc}</p>
          </motion.button>
        ))}
      </div>
    </div>
  );
};

const ContextForm = ({ 
  type, 
  onSubmit, 
  onCancel 
}: { 
  type: ConversationType; 
  onSubmit: (data: any) => void;
  onCancel: () => void;
}) => {
  const [formData, setFormData] = useState<any>({});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-md p-6 shadow-2xl"
      >
        <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
          {type === 'idea' && <MessageSquare className="w-5 h-5 text-blue-500" />}
          {type === 'script' && <FileText className="w-5 h-5 text-purple-500" />}
          {type === 'hashtag' && <Hash className="w-5 h-5 text-emerald-500" />}
          Configure your {type}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {type === 'idea' && (
            <>
              <div>
                <label className="block text-sm font-medium mb-1.5 opacity-70">Topic / Niche</label>
                <input 
                  required
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-zinc-500 outline-none"
                  placeholder="e.g. AI Tools, Cooking, Fitness"
                  onChange={e => setFormData({...formData, topic: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5 opacity-70">Platform</label>
                <select 
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-zinc-500 outline-none"
                  onChange={e => setFormData({...formData, platform: e.target.value})}
                >
                  <option value="TikTok">TikTok</option>
                  <option value="YouTube">YouTube</option>
                  <option value="Instagram">Instagram</option>
                  <option value="Twitter/X">Twitter/X</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5 opacity-70">Tone</label>
                <select 
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-zinc-500 outline-none"
                  onChange={e => setFormData({...formData, tone: e.target.value})}
                >
                  <option value="Funny">Funny</option>
                  <option value="Motivational">Motivational</option>
                  <option value="Educational">Educational</option>
                  <option value="Professional">Professional</option>
                </select>
              </div>
            </>
          )}

          {type === 'script' && (
            <>
              <div>
                <label className="block text-sm font-medium mb-1.5 opacity-70">Idea or Topic</label>
                <input 
                  required
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-zinc-500 outline-none"
                  placeholder="e.g. How to use Gemini AI"
                  onChange={e => setFormData({...formData, topic: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5 opacity-70">Platform</label>
                <select 
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-zinc-500 outline-none"
                  onChange={e => setFormData({...formData, platform: e.target.value})}
                >
                  <option value="TikTok/Shorts">TikTok/Shorts</option>
                  <option value="YouTube Long">YouTube Long</option>
                  <option value="Instagram Reel">Instagram Reel</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5 opacity-70">Length</label>
                <select 
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-zinc-500 outline-none"
                  onChange={e => setFormData({...formData, length: e.target.value})}
                >
                  <option value="Short (30s)">Short (30s)</option>
                  <option value="Medium (1-2m)">Medium (1-2m)</option>
                  <option value="Long (5m+)">Long (5m+)</option>
                </select>
              </div>
            </>
          )}

          {type === 'hashtag' && (
            <>
              <div>
                <label className="block text-sm font-medium mb-1.5 opacity-70">Main Topic</label>
                <input 
                  required
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-zinc-500 outline-none"
                  placeholder="e.g. Digital Marketing"
                  onChange={e => setFormData({...formData, topic: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5 opacity-70">Platform</label>
                <select 
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-zinc-500 outline-none"
                  onChange={e => setFormData({...formData, platform: e.target.value})}
                >
                  <option value="Instagram">Instagram</option>
                  <option value="TikTok">TikTok</option>
                  <option value="LinkedIn">LinkedIn</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5 opacity-70">Number of Hashtags</label>
                <input 
                  type="number"
                  min="10"
                  max="30"
                  defaultValue="15"
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-zinc-500 outline-none"
                  onChange={e => setFormData({...formData, count: e.target.value})}
                />
              </div>
            </>
          )}

          <div className="flex gap-3 pt-4">
            <button 
              type="button"
              onClick={onCancel}
              className="flex-1 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-950 transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit"
              className="flex-1 py-2.5 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-bold hover:opacity-90 transition-opacity"
            >
              Generate
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

const Settings = ({ 
  profile, 
  onClose 
}: { 
  profile: Profile | null; 
  onClose: () => void 
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-md p-6 shadow-2xl"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <SettingsIcon className="w-5 h-5" />
            Settings
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-6">
          <div className="p-4 bg-zinc-50 dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium opacity-70">Plan Status</span>
              <span className={cn(
                "text-xs font-bold px-2 py-0.5 rounded-full",
                profile?.is_pro ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400" : "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400"
              )}>
                {profile?.is_pro ? 'PRO' : 'FREE'}
              </span>
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span>Usage</span>
                <span>{profile?.usage_count || 0} / {profile?.max_usage || 15}</span>
              </div>
              <div className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-zinc-900 dark:bg-white transition-all duration-500" 
                  style={{ width: `${Math.min(100, ((profile?.usage_count || 0) / (profile?.max_usage || 15)) * 100)}%` }}
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5 opacity-70">Activation Key</label>
            <div className="flex gap-2">
              <input 
                className="flex-1 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2 focus:ring-2 focus:ring-zinc-500 outline-none text-sm"
                placeholder="Enter key to upgrade"
              />
              <button className="px-4 py-2 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-xl text-sm font-bold">
                Apply
              </button>
            </div>
          </div>

          <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800">
            <a 
              href="https://wa.me/447526596522" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center justify-between p-3 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 rounded-xl hover:opacity-80 transition-opacity"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center text-white">
                  <ExternalLink className="w-4 h-4" />
                </div>
                <div className="text-sm">
                  <div className="font-bold">Support & Feedback</div>
                  <div className="text-xs opacity-70">Chat with us on WhatsApp</div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

const Auth = ({ onAuthSuccess, isDarkMode }: { onAuthSuccess: () => void; isDarkMode: boolean }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success('Welcome back!');
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        toast.success('Account created! Please check your email.');
      }
      onAuthSuccess();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={cn("min-h-screen flex items-center justify-center p-4 bg-zinc-50 dark:bg-zinc-950", isDarkMode && "dark")}>
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white dark:bg-zinc-900 p-8 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-xl"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 bg-zinc-900 dark:bg-white rounded-2xl flex items-center justify-center mb-4">
            <Zap className="w-6 h-6 text-white dark:text-zinc-900" />
          </div>
          <h1 className="text-2xl font-bold">Ideaflux AI</h1>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">
            {isLogin ? 'Sign in to your account' : 'Create a new account'}
          </p>
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5 opacity-70">Email Address</label>
            <input 
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 focus:ring-2 focus:ring-zinc-500 outline-none transition-all"
              placeholder="name@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5 opacity-70">Password</label>
            <div className="relative">
              <input 
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 focus:ring-2 focus:ring-zinc-500 outline-none transition-all pr-12"
                placeholder="••••••••"
              />
              <button 
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-xl font-bold hover:opacity-90 transition-opacity disabled:opacity-50 mt-2"
          >
            {loading ? 'Processing...' : (isLogin ? 'Sign In' : 'Create Account')}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button 
            onClick={() => setIsLogin(!isLogin)}
            className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors"
          >
            {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth > 1024);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved ? saved === 'dark' : true;
  });
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showContextForm, setShowContextForm] = useState<ConversationType | null>(null);
  const [streamingMessage, setStreamingMessage] = useState('');
  
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
        is_pro: false,
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
    const { data } = await supabase
      .from('conversations')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    setConversations(data || []);
  };

  const handleNewChat = () => {
    setCurrentConversation(null);
    setMessages([]);
    setStreamingMessage('');
    if (window.innerWidth < 1024) setIsSidebarOpen(false);
  };

  const handleSelectConversation = (id: string) => {
    const conv = conversations.find(c => c.id === id);
    if (conv) {
      setCurrentConversation(conv);
      setMessages(conv.messages);
      setStreamingMessage('');
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

    await startConversation(type, title, prompt);
  };

  const startConversation = async (type: ConversationType, title: string, initialPrompt: string) => {
    if (!user) return;

    const newConv: Partial<Conversation> = {
      user_id: user.id,
      title,
      type,
      messages: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase.from('conversations').insert(newConv).select().single();
    if (error) {
      toast.error('Failed to create conversation');
      return;
    }

    setCurrentConversation(data);
    setConversations([data, ...conversations]);
    await sendMessage(initialPrompt, data);
  };

  const sendMessage = async (content: string, convOverride?: Conversation) => {
    let conv = convOverride || currentConversation;
    
    if (!conv && content.trim()) {
      // If no conversation exists, start a new 'idea' one by default
      await startConversation('idea', content.slice(0, 30) || 'New Chat', content);
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
          type: conv.type,
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
      await supabase
        .from('conversations')
        .update({ 
          messages: finalMessages,
          updated_at: new Date().toISOString()
        })
        .eq('id', conv.id);
      
      // Update usage
      if (profile) {
        const newCount = profile.usage_count + 1;
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
    </div>
  );

  return (
    <div className={cn("min-h-screen bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 flex overflow-hidden", isDarkMode && "dark")}>
      <Toaster position="top-center" richColors theme={isDarkMode ? 'dark' : 'light'} />
      
      <Sidebar 
        isOpen={isSidebarOpen} 
        setIsOpen={setIsSidebarOpen}
        conversations={conversations}
        onSelectConversation={handleSelectConversation}
        onNewChat={handleNewChat}
        currentConversationId={currentConversation?.id || null}
        onLogout={handleLogout}
      />

      {/* Sidebar Overlay for Mobile */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          />
        )}
      </AnimatePresence>

      <main className="flex-1 flex flex-col h-[100dvh] relative overflow-hidden">
        {/* Header */}
        <header className="h-16 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between px-4 sticky top-0 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md z-30">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className={cn("p-2 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-lg transition-colors", isSidebarOpen && "lg:hidden")}
            >
              <Menu className="w-5 h-5" />
            </button>
            {currentConversation && (
              <div className="flex flex-col">
                <span className="text-sm font-bold truncate max-w-[150px] md:max-w-[300px]">
                  {currentConversation.title}
                </span>
                <span className="text-[10px] opacity-50 uppercase tracking-wider font-bold">
                  {currentConversation.type}
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
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
          </div>
        </header>

        {/* Chat Content */}
        <div className="flex-1 overflow-y-auto scroll-smooth">
          {!currentConversation ? (
            <WelcomeScreen onSelectType={setShowContextForm} />
          ) : (
            <div className="max-w-4xl mx-auto w-full py-8 px-4 space-y-8">
              {messages.map((m) => (
                <div 
                  key={m.id} 
                  className={cn(
                    "flex gap-4",
                    m.role === 'user' ? "flex-row-reverse" : "flex-row"
                  )}
                >
                  <div className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                    m.role === 'user' ? "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900" : "bg-zinc-100 dark:bg-zinc-900"
                  )}>
                    {m.role === 'user' ? <User className="w-4 h-4" /> : <Zap className="w-4 h-4" />}
                  </div>
                  <div className={cn(
                    "max-w-[85%] p-4 rounded-2xl text-sm leading-relaxed",
                    m.role === 'user' 
                      ? "bg-zinc-100 dark:bg-zinc-900 rounded-tr-none" 
                      : "prose dark:prose-invert prose-zinc prose-sm max-w-none"
                  )}>
                    {m.role === 'user' ? (
                      <p className="whitespace-pre-wrap">{m.content}</p>
                    ) : (
                      <ReactMarkdown>{m.content}</ReactMarkdown>
                    )}
                  </div>
                </div>
              ))}
              
              {streamingMessage && (
                <div className="flex gap-4">
                  <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center shrink-0">
                    <Zap className="w-4 h-4 animate-pulse" />
                  </div>
                  <div className="max-w-[85%] p-4 rounded-2xl text-sm leading-relaxed prose dark:prose-invert prose-zinc prose-sm max-w-none">
                    <ReactMarkdown>{streamingMessage}</ReactMarkdown>
                    <span className="inline-block w-1.5 h-4 bg-zinc-400 animate-pulse ml-1 align-middle" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md">
          <div className="max-w-4xl mx-auto w-full">
            {/* Suggestion Chips */}
            {(!currentConversation || (messages.length === 0 && !isLoading)) && (
              <div className="flex flex-row gap-2 overflow-x-auto no-scrollbar pb-3 mb-1">
                {[
                  "Viral hook ideas",
                  "Video script outline",
                  "Trending hashtags",
                  "Content calendar plan"
                ].map((chip) => (
                  <button
                    key={chip}
                    onClick={() => sendMessage(chip)}
                    className="whitespace-nowrap px-4 py-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-full text-xs hover:border-zinc-400 dark:hover:border-zinc-600 transition-all shadow-sm"
                  >
                    {chip}
                  </button>
                ))}
              </div>
            )}

            <div className="relative flex items-center gap-2 bg-zinc-100 dark:bg-zinc-900 rounded-full px-6 py-1.5 border border-transparent focus-within:border-zinc-300 dark:focus-within:border-zinc-700 transition-all">
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
                placeholder="Ask anything"
                className="flex-1 bg-transparent border-none py-2.5 focus:ring-0 outline-none resize-none max-h-48 text-sm"
                style={{ height: 'auto' }}
              />

              <div className="flex items-center gap-1">
                <button 
                  onClick={() => sendMessage(input)}
                  disabled={!input.trim() || isLoading}
                  className="p-2.5 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-full disabled:opacity-50 transition-all hover:scale-105 active:scale-95"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
            <p className="text-[10px] text-center mt-2 text-zinc-500 opacity-50">
              Ideaflux AI can make mistakes. Check important info.
            </p>
          </div>
        </div>

        {/* Floating Suggestion Chips for Empty Chat - REMOVED from absolute position */}
      </main>

      {/* Modals */}
      <AnimatePresence>
        {showContextForm && (
          <ContextForm 
            type={showContextForm} 
            onSubmit={handleContextSubmit}
            onCancel={() => setShowContextForm(null)}
          />
        )}
        {showSettings && (
          <Settings 
            profile={profile} 
            onClose={() => setShowSettings(false)} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}
