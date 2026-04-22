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
  Zap
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

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col bg-white dark:bg-zinc-950 overflow-hidden"
    >
      {/* Header */}
      <header className="h-16 flex items-center justify-between px-6 border-b border-zinc-200 dark:border-zinc-800">
        <h2 className="text-xl font-black tracking-tight flex items-center gap-3">
          <div className="w-8 h-8 bg-zinc-900 dark:bg-white rounded-lg flex items-center justify-center">
            <SettingsIcon className="w-4 h-4 text-white dark:text-black" />
          </div>
          Settings
        </h2>
        <button 
          onClick={onClose} 
          className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-xl transition-all active:scale-95 border border-zinc-200 dark:border-zinc-800"
        >
          <X className="w-5 h-5" />
        </button>
      </header>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto w-full p-6 md:p-12 space-y-12">
          
          {/* Account & Plan */}
          <section className="space-y-6">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] opacity-40">
              <User className="w-3.5 h-3.5" />
              Account & Plan
            </div>
            
            <div className="grid md:grid-cols-2 gap-6">
              <div className="p-6 bg-zinc-50 dark:bg-zinc-900/50 rounded-2xl border border-zinc-200 dark:border-zinc-800 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                  <CreditCard className="w-24 h-24 rotate-12" />
                </div>
                <div className="relative flex flex-col h-full justify-between gap-4">
                  <div>
                    <span className={cn(
                      "px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase",
                      profile?.plan === 'pro' 
                        ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 border border-amber-200 dark:border-amber-800" 
                        : "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 border border-zinc-300 dark:border-zinc-700"
                    )}>
                      {profile?.plan === 'pro' ? 'PRO PLAN' : 'FREE PLAN'}
                    </span>
                    <h3 className="mt-4 text-2xl font-black">
                      {profile?.plan === 'pro' ? 'Premium Active' : 'Limited Access'}
                    </h3>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-bold opacity-60">
                      <span>Usage Tracker</span>
                      <span>{profile?.usage_count || 0} / {profile?.plan === 'pro' ? '∞' : (profile?.max_usage || 15)}</span>
                    </div>
                    <div className="w-full h-2 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: profile?.plan === 'pro' ? '100%' : `${Math.min(100, ((profile?.usage_count || 0) / (profile?.max_usage || 15)) * 100)}%` }}
                        className={cn(
                          "h-full rounded-full transition-all duration-1000",
                          profile?.plan === 'pro' ? "bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]" : "bg-zinc-900 dark:bg-white"
                        )}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 bg-zinc-50 dark:bg-zinc-900/50 rounded-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col justify-between gap-6">
                <div>
                  <h4 className="text-sm font-black uppercase tracking-wider opacity-60 mb-2">Activation Settings</h4>
                  <div className="flex gap-2">
                    <input 
                      className="flex-1 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white outline-none text-sm transition-all"
                      placeholder={profile?.plan === 'pro' ? "Pro already active" : "Enter key to upgrade"}
                      value={key}
                      onChange={(e) => setKey(e.target.value)}
                      disabled={isApplying || profile?.plan === 'pro'}
                    />
                    <button 
                      onClick={handleApply}
                      disabled={isApplying || !key.trim() || profile?.plan === 'pro'}
                      className="px-6 py-2.5 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-xl text-sm font-black disabled:opacity-50 hover:opacity-90 transition-all active:scale-95 shadow-lg shadow-black/5"
                    >
                      {isApplying ? '...' : 'APPLY'}
                    </button>
                  </div>
                </div>
                {profile?.plan === 'free' ? (
                  <p className="text-xs text-zinc-500 leading-relaxed">
                    Unlock Unlimited Generations, DALL·E 3 High-Definition Images, and Advanced Search.
                  </p>
                ) : (
                  <div className="text-xs text-amber-600 dark:text-amber-400 font-bold">
                    Pro subscription active. Thank you for supporting Ideaflux AI.
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Preferences */}
          <section className="space-y-6">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] opacity-40">
              <Smartphone className="w-3.5 h-3.5" />
              Preferences & Themes
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              {/* Appearance */}
              <div className="p-1 bg-zinc-100 dark:bg-zinc-900 rounded-2xl flex items-center">
                <button 
                  onClick={() => !isDarkMode && onToggleTheme()}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-3 py-3 rounded-xl text-sm font-bold transition-all",
                    !isDarkMode ? "bg-white text-black shadow-sm" : "text-zinc-500 hover:text-zinc-300"
                  )}
                >
                  <Sun className="w-4 h-4" />
                  Light
                </button>
                <button 
                  onClick={() => isDarkMode && onToggleTheme()}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-3 py-3 rounded-xl text-sm font-bold transition-all",
                    isDarkMode ? "bg-zinc-800 text-white shadow-sm" : "text-zinc-500 hover:text-zinc-700"
                  )}
                >
                  <Moon className="w-4 h-4" />
                  Dark
                </button>
              </div>

              {/* Voice Autoplay */}
              <div className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-2xl border border-zinc-200 dark:border-zinc-800">
                <div className="flex flex-col">
                  <span className="text-sm font-bold">Auto-play Voice</span>
                  <span className="text-[10px] opacity-50 uppercase tracking-widest leading-none">Voice Replies</span>
                </div>
                <button 
                  onClick={onToggleAutoPlay}
                  className={cn(
                    "w-12 h-6 rounded-full transition-all relative",
                    autoPlayVoice ? "bg-zinc-900 dark:bg-white" : "bg-zinc-200 dark:bg-zinc-700"
                  )}
                >
                  <motion.div 
                    animate={{ x: autoPlayVoice ? 24 : 4 }}
                    className={cn(
                      "absolute top-1 w-4 h-4 rounded-full shadow-sm",
                      autoPlayVoice ? "bg-white dark:bg-zinc-950" : "bg-white"
                    )}
                  />
                </button>
              </div>
            </div>

            {/* Voice Selection */}
            <div className="p-6 bg-zinc-50 dark:bg-zinc-900/50 rounded-2xl border border-zinc-200 dark:border-zinc-800 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-black uppercase tracking-wider opacity-60">AI Voice Profile</h4>
                <div className="flex items-center gap-2 text-zinc-400">
                  <Volume2 className="w-4 h-4" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {(['alloy', 'echo'] as const).map((v, i) => (
                  <button
                    key={`${v}-${i}`}
                    onClick={() => onVoiceOptionChange(v)}
                    className={cn(
                      "flex items-center justify-between px-6 py-4 rounded-xl text-sm font-black transition-all border-2",
                      voiceOption === v 
                        ? "bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white border-zinc-900 dark:border-white shadow-xl shadow-black/5 scale-[1.02]" 
                        : "bg-transparent border-transparent text-zinc-500 hover:bg-white/50 dark:hover:bg-zinc-800/50"
                    )}
                  >
                    <span>{v === 'alloy' ? 'Female' : 'Male'}</span>
                    <span className="text-[10px] opacity-40 uppercase tracking-widest">{v}</span>
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* Footer / Links */}
          <section className="pt-12 border-t border-zinc-200 dark:border-zinc-800 space-y-12">
            <div className="flex flex-col md:flex-row items-center justify-between gap-8">
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-x-8 gap-y-4">
                <button onClick={() => onShowLegal('about')} className="text-xs font-black uppercase tracking-[0.1em] opacity-40 hover:opacity-100 transition-opacity">About</button>
                <button onClick={() => onShowLegal('privacy')} className="text-xs font-black uppercase tracking-[0.1em] opacity-40 hover:opacity-100 transition-opacity">Privacy</button>
                <button onClick={() => onShowLegal('terms')} className="text-xs font-black uppercase tracking-[0.1em] opacity-40 hover:opacity-100 transition-opacity">Terms</button>
              </div>
              
              <div className="flex items-center gap-6">
                <a 
                  href="https://wa.me/447526596522" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="px-6 py-3 bg-emerald-500 dark:bg-emerald-600 text-white rounded-full text-xs font-black tracking-widest uppercase hover:scale-105 transition-all shadow-lg shadow-emerald-500/20"
                >
                  Chat on WhatsApp
                </a>
              </div>
            </div>

            <div className="flex flex-col items-center gap-4 py-8">
              <div className="flex items-center gap-2 grayscale brightness-200 opacity-30">
                <Zap className="w-5 h-5" />
                <span className="font-black text-lg tracking-tighter">IDEAFLUX AI</span>
              </div>
              <p className="text-[10px] uppercase font-black tracking-[0.3em] opacity-20">
                Version 2.0.4 • Powered by OpenAI
              </p>
            </div>
          </section>
        </div>
      </div>
    </motion.div>
  );
};
