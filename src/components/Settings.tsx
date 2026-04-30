import React from 'react';
import { 
  Settings as SettingsIcon, 
  X, 
  ExternalLink, 
  ChevronRight,
  Volume2,
  VolumeX,
  Sun,
  Moon,
  Shield,
  CreditCard,
  User,
  Info,
  Smartphone,
  Zap,
  Check,
  Plus,
  MessageSquare,
  FileText,
  Hash,
  Image as ImageIcon
} from 'lucide-react';
import { motion } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { Profile } from '../types';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const Settings = ({ 
  profile, 
  onClose,
  voiceOption,
  onVoiceOptionChange,
  autoPlayVoice,
  onToggleAutoPlay,
  onShowLegal,
  onApplyKey,
  onUpgrade,
  isDarkMode,
  onToggleTheme
}: { 
  profile: Profile | null; 
  onClose: () => void;
  voiceOption: 'alloy' | 'echo';
  onVoiceOptionChange: (voice: 'alloy' | 'echo') => void;
  autoPlayVoice: boolean;
  onToggleAutoPlay: () => void;
  onShowLegal: (type: 'about' | 'privacy' | 'terms') => void;
  onApplyKey: (key: string) => Promise<void>;
  onUpgrade: () => void;
  isDarkMode: boolean;
  onToggleTheme: () => void;
}) => {
  const [key, setKey] = React.useState('');
  const [isApplying, setIsApplying] = React.useState(false);

  const handleApply = async () => {
    if (!key.trim()) return;
    setIsApplying(true);
    await onApplyKey(key);
    setIsApplying(false);
    setKey('');
  };

  const userInitial = profile?.email?.charAt(0).toUpperCase() || 'U';

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col bg-zinc-50 dark:bg-zinc-950 overflow-hidden"
    >
      {/* Header */}
      <header className="h-16 flex items-center justify-between px-6 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
        <h2 className="text-sm font-black uppercase tracking-widest opacity-40">Settings</h2>
        <button 
          onClick={onClose} 
          className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-full transition-all"
        >
          <X className="w-5 h-5" />
        </button>
      </header>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-xl mx-auto w-full p-6 md:p-12 space-y-12">
          
          {/* User Profile Info - Minimalist */}
          <div className="flex flex-col items-center gap-2 text-center">
            <h3 className="text-3xl font-black tracking-tight">{profile?.name || profile?.email?.split('@')[0]}</h3>
            <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-[0.2em]">{profile?.plan} account</p>
          </div>

          {/* Section: My Trelvix AI */}
          <section className="space-y-4">
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40 px-2">My Trelvix AI</h4>
            <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 overflow-hidden divide-y divide-zinc-100 dark:divide-zinc-800 shadow-sm">
              <div className="p-6 space-y-6">
                <div>
                  <div className="flex items-center gap-4 mb-4">
                    <User className="w-5 h-5 text-emerald-500" />
                    <div className="text-sm font-black uppercase tracking-widest">Personalization</div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {[
                      'Default', 'Fun', 'Therapy', 'Teacher', 'Professional', 
                      'Creative', 'Technical', 'Motivational', 'Sarcastic', 'Empathetic',
                      'Minimalist', 'Expert', 'Curious', 'Storyteller', 'Assistant'
                    ].map((p) => (
                      <button 
                        key={p}
                        className="px-3 py-2 text-[10px] font-black uppercase tracking-widest bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-800 rounded-xl hover:border-emerald-500 transition-all text-zinc-500 hover:text-emerald-500"
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t border-zinc-100 dark:border-zinc-800 text-center">
                  <div className="text-[10px] text-zinc-500 font-black uppercase tracking-widest mb-4">Quick AI Tools</div>
                  <div className="flex items-center justify-around">
                    {[
                      { icon: MessageSquare, label: 'Idea', color: 'text-blue-500', type: 'idea' },
                      { icon: FileText, label: 'Script', color: 'text-purple-500', type: 'script' },
                      { icon: Hash, label: 'Tags', color: 'text-emerald-500', type: 'hashtag' },
                      { icon: ImageIcon, label: 'Images', color: 'text-orange-500', type: 'image' }
                    ].map((app) => (
                      <button 
                        key={app.label}
                        onClick={() => {
                          onClose();
                          // The App.tsx handles setShowContextForm if we were to emit an event, 
                          // but for now, we'll just go to the view or the user can navigate.
                          // Ideally we'd want to trigger the form.
                          // I'll assume standard navigation for now.
                        }}
                        className="flex flex-col items-center gap-2 group"
                      >
                        <div className="w-12 h-12 flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 rounded-2xl border border-zinc-100 dark:border-zinc-800 group-hover:border-zinc-400 transition-all">
                          <app.icon className={cn("w-5 h-5", app.color)} />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-widest opacity-60">{app.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Section: Account */}
          <section className="space-y-4">
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40 px-2">Account</h4>
            <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm">
              {/* Plan Box */}
              <div className="p-8 bg-zinc-50 dark:bg-zinc-950 border-b border-zinc-100 dark:divide-zinc-800">
                <div className="flex items-center justify-between mb-4">
                  <span className={cn(
                    "px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase",
                    profile?.plan === 'free' ? "bg-zinc-200 text-zinc-600" : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 border border-amber-200 dark:border-amber-800"
                  )}>
                    {profile?.plan?.toUpperCase()} PLAN
                  </span>
                  {(profile?.plan === 'pro' || profile?.plan === 'plus') && profile?.subscription_expires_at && (
                    <span className="text-[10px] font-bold text-zinc-500 italic">
                      {Math.ceil((new Date(profile.subscription_expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24))} days remaining
                    </span>
                  )}
                </div>
                <h4 className="text-2xl font-black mb-6">
                  {profile?.plan === 'free' ? 'Unlock Professional Tools' : 'Premium Access Active'}
                </h4>
                <button 
                  onClick={onUpgrade}
                  className={cn(
                    "w-full py-4 rounded-2xl text-xs font-black uppercase tracking-[0.2em] transition-all transform active:scale-95 shadow-xl",
                    profile?.plan === 'free' 
                      ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 shadow-zinc-900/20 dark:shadow-white/10"
                      : "bg-amber-500 text-white shadow-amber-500/20"
                  )}
                >
                  {profile?.plan === 'free' ? 'Upgrade Plan' : 'Manage Subscription'}
                </button>
              </div>

              {/* Email & Settings */}
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                <div className="px-6 py-5 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <Info className="w-5 h-5 text-zinc-400" />
                    <div>
                      <div className="text-sm font-black">Email</div>
                      <div className="text-xs text-zinc-400 font-medium">{profile?.email}</div>
                    </div>
                  </div>
                </div>
                <button 
                  onClick={onToggleTheme}
                  className="w-full px-6 py-5 flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors text-left"
                >
                  <div className="flex items-center gap-4">
                    {isDarkMode ? <Sun className="w-5 h-5 text-zinc-400" /> : <Moon className="w-5 h-5 text-zinc-400" />}
                    <div className="text-sm font-black">Appearance</div>
                  </div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-zinc-400">{isDarkMode ? 'Dark' : 'Light'}</div>
                </button>
              </div>
            </div>
          </section>

          {/* Section: Legal */}
          <section className="space-y-4 pb-12">
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40 px-2">Legal</h4>
            <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 overflow-hidden divide-y divide-zinc-100 dark:divide-zinc-800 shadow-sm">
              <button onClick={() => onShowLegal('about')} className="w-full px-6 py-5 flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors text-left group">
                <span className="text-sm font-black group-hover:pl-2 transition-all">About</span>
                <ChevronRight className="w-4 h-4 text-zinc-300" />
              </button>
              <button onClick={() => onShowLegal('privacy')} className="w-full px-6 py-5 flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors text-left group">
                <span className="text-sm font-black group-hover:pl-2 transition-all">Privacy Policy</span>
                <ChevronRight className="w-4 h-4 text-zinc-300" />
              </button>
              <button onClick={() => onShowLegal('terms')} className="w-full px-6 py-5 flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors text-left group">
                <span className="text-sm font-black group-hover:pl-2 transition-all">Terms of Service</span>
                <ChevronRight className="w-4 h-4 text-zinc-300" />
              </button>
            </div>
          </section>
        </div>
      </div>
    </motion.div>
  );
};

