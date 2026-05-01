import React from 'react';
import { 
  Settings as SettingsIcon, 
  X, 
  ChevronRight,
  Sun,
  Moon,
  Info,
  MessageSquare,
  FileText,
  Hash,
  Image as ImageIcon,
  Check,
  Briefcase,
  PenTool,
  Sparkles,
  Zap,
  Heart,
  GraduationCap,
  User,
  CreditCard,
  ShieldCheck,
  HelpCircle,
  Layout,
  ExternalLink,
  Camera,
  Trash2,
  Edit2,
  ChevronLeft
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { Profile, PersonalityType } from '../types';
import { toast } from 'sonner';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type SettingsSection = 'account' | 'personality' | 'billing' | 'display' | 'legal';

const PERSONALITIES: { id: PersonalityType; name: string; icon: any; description: string; color: string }[] = [
  { 
    id: 'professional', 
    name: 'Professional', 
    icon: Briefcase, 
    description: 'Direct, clear, and business-ready responses.',
    color: 'bg-blue-500'
  },
  { 
    id: 'creative', 
    name: 'Creative', 
    icon: PenTool, 
    description: 'Imaginative and descriptive thinking.',
    color: 'bg-purple-500'
  },
  { 
    id: 'witty', 
    name: 'Witty', 
    icon: Sparkles, 
    description: 'Humorous and slightly sarcastic.',
    color: 'bg-amber-500'
  },
  { 
    id: 'concise', 
    name: 'Concise', 
    icon: Zap, 
    description: 'Short and efficient answers.',
    color: 'bg-zinc-500'
  },
  { 
    id: 'empathetic', 
    name: 'Empathetic', 
    icon: Heart, 
    description: 'Warm and compassionate guidance.',
    color: 'bg-rose-500'
  },
  { 
    id: 'academic', 
    name: 'Academic', 
    icon: GraduationCap, 
    description: 'Formal and technical knowledge.',
    color: 'bg-indigo-500'
  },
];

export const Settings = (props: { 
  profile: Profile | null; 
  onClose: () => void;
  onUpdateProfile: (updates: Partial<Profile>) => Promise<any>;
  onShowLegal: (type: 'about' | 'privacy' | 'terms') => void;
  onUpgrade: () => void;
  isDarkMode: boolean;
  onToggleTheme: () => void;
  autoPlayVoice: boolean;
  onToggleAutoPlay: () => void;
}) => {
  const {
    profile,
    onClose,
    onUpdateProfile,
    onShowLegal,
    isDarkMode,
    onToggleTheme,
    autoPlayVoice,
    onToggleAutoPlay
  } = props;
  const [activeSection, setActiveSection] = React.useState<SettingsSection | null>(typeof window !== 'undefined' && window.innerWidth > 768 ? 'account' : null);
  const [isEditingName, setIsEditingName] = React.useState(false);
  const [newName, setNewName] = React.useState(profile?.name || profile?.email?.split('@')[0] || '');
  const [isUploading, setIsUploading] = React.useState(false);
  const [localAvatarPreview, setLocalAvatarPreview] = React.useState<string | null>(null);
  const [billingPeriod, setBillingPeriod] = React.useState<'month' | 'year'>('month');
  const [isSubscribing, setIsSubscribing] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleUpdateName = async () => {
    try {
      await onUpdateProfile({ name: newName });
      setIsEditingName(false);
      toast.success('Name updated successfully');
    } catch (err) {
      toast.error('Failed to update name');
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error('File size must be less than 2MB');
      return;
    }

    setIsUploading(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = reader.result as string;
        setLocalAvatarPreview(base64String); // Set local preview immediately
        await onUpdateProfile({ avatar_url: base64String });
        setIsUploading(false);
        toast.success('Profile picture updated');
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error(err);
      setIsUploading(false);
      setLocalAvatarPreview(null);
      toast.error('Failed to upload image');
    }
  };

  const plans = {
    pro: {
      name: 'Pro',
      monthly: 10,
      yearly: 96,
      features: ['100 messages / day', 'Unlimited analysis', '20 images / day', 'Priority support']
    },
    plus: {
      name: 'Plus',
      monthly: 25,
      yearly: 240,
      features: ['Unlimited messages', 'Unlimited analysis', 'Unlimited images', 'Enterprise support']
    }
  };

  const handleSubscribe = async (planId: string) => {
    if (!profile?.id) return;
    setIsSubscribing(planId);
    try {
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan: planId,
          interval: billingPeriod,
          userId: profile.id
        })
      });
      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      console.error(err);
      setIsSubscribing(null);
      toast.error('Failed to initiate checkout');
    }
  };

  const handlePersonalitySelect = async (personality: PersonalityType) => {
    try {
      await onUpdateProfile({ personality });
      toast.success(`Personality updated to ${personality}`);
    } catch (err) {
      toast.error('Failed to update personality');
    }
  };

  const SidebarItem = ({ id, icon: Icon, label }: { id: SettingsSection; icon: any; label: string }) => (
    <button
      onClick={() => setActiveSection(id)}
      className={cn(
        "w-full flex items-center gap-4 px-4 py-3 rounded-2xl text-sm font-bold transition-all",
        activeSection === id 
          ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-sm" 
          : "text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-900 hover:text-zinc-900 dark:hover:text-zinc-100"
      )}
    >
      <Icon className={cn("w-5 h-5", activeSection === id ? "text-emerald-500" : "text-zinc-400")} />
      {label}
    </button>
  );

  const currentPersonality = PERSONALITIES.find(p => p.id === (profile?.personality || 'professional'))!;

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-0 md:p-6 bg-black/20 backdrop-blur-sm"
    >
      <motion.div 
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="w-full h-full md:h-[680px] md:max-w-4xl bg-white dark:bg-zinc-950 md:rounded-3xl shadow-2xl border border-zinc-200 dark:border-zinc-800 flex overflow-hidden"
      >
        {/* Sidebar */}
        <div className={cn(
          "flex-col w-64 border-r border-zinc-200 dark:border-zinc-800 p-6 shrink-0 bg-white dark:bg-zinc-950 h-full",
          activeSection !== null ? "hidden md:flex" : "flex w-full md:w-64"
        )}>
          <div className="flex items-center justify-between mb-8 px-2">
            <div className="flex items-center gap-3">
              <SettingsIcon className="w-5 h-5 text-zinc-900 dark:text-zinc-100" />
              <span className="font-bold text-sm">Settings</span>
            </div>
            <button 
              onClick={onClose}
              className="md:hidden p-2 text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <nav className="flex-1 space-y-1">
            <SidebarItem id="account" icon={User} label="Account" />
            <SidebarItem id="personality" icon={Sparkles} label="Personality" />
            <SidebarItem id="billing" icon={CreditCard} label="Billing" />
            <SidebarItem id="display" icon={Layout} label="Display" />
            <SidebarItem id="legal" icon={ShieldCheck} label="Legal" />
          </nav>

          <button 
            onClick={onClose}
            className="mt-4 md:hidden w-full py-3 bg-zinc-100 dark:bg-zinc-900 rounded-xl text-xs font-bold"
          >
            Close Settings
          </button>

          <div className="mt-auto px-2 hidden md:block">
            <div className="p-3 bg-zinc-50 dark:bg-zinc-900 rounded-xl border border-zinc-100 dark:border-zinc-800">
              <div className="text-[10px] uppercase tracking-wider text-zinc-400 font-bold mb-2">Current Plan</div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold capitalize">{profile?.plan}</span>
                <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
              </div>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className={cn(
          "flex-1 flex flex-col min-w-0 bg-zinc-50 dark:bg-zinc-950 h-full",
          activeSection !== null ? "flex" : "hidden md:flex"
        )}>
          <header className="h-16 flex items-center justify-between px-6 border-b border-zinc-100 dark:border-zinc-900/50 bg-white dark:bg-zinc-950 sticky top-0 z-10 shrink-0">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setActiveSection(null)} 
                className="md:hidden p-2 -ml-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-lg"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <h2 className="text-sm font-bold capitalize">
                {activeSection === 'account' ? 'Profile' : activeSection}
              </h2>
            </div>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-zinc-500" />
            </button>
          </header>

          <div className="flex-1 overflow-y-auto overflow-x-hidden">
            <div className="max-w-2xl mx-auto p-6 md:p-10 space-y-10">
              {activeSection === 'account' && (
                <div className="space-y-12 pb-12">
                  <div className="flex flex-col md:flex-row items-center md:items-start gap-10">
                    <div className="relative group shrink-0">
                      <div className="w-32 h-32 md:w-36 md:h-36 rounded-2xl bg-zinc-50 dark:bg-zinc-900 flex items-center justify-center text-4xl font-bold border-4 border-white dark:border-zinc-950 overflow-hidden shadow-xl relative z-10 transition-all duration-300 group-hover:shadow-emerald-500/10">
                        {localAvatarPreview || profile?.avatar_url ? (
                          <img src={localAvatarPreview || profile?.avatar_url || ''} alt="Profile" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-zinc-200 dark:text-zinc-800">
                            {profile?.name?.charAt(0).toUpperCase() || profile?.email?.charAt(0).toUpperCase()}
                          </span>
                        )}
                        {isUploading && (
                          <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-20 backdrop-blur-sm">
                            <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                          </div>
                        )}
                      </div>
                      <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="absolute -bottom-2 -right-2 w-11 h-11 rounded-xl bg-zinc-900 border-4 border-white dark:border-zinc-950 text-white flex items-center justify-center shadow-lg hover:bg-emerald-600 transition-all active:scale-95 z-20"
                        title="Upload photo"
                      >
                        <Camera className="w-5 h-5" />
                      </button>
                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        className="hidden" 
                        accept="image/*" 
                        onChange={handleFileChange}
                      />
                    </div>
                    
                    <div className="flex-1 text-center md:text-left space-y-6 w-full pt-1">
                      <div className="space-y-2">
                        <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-[0.2em] block pl-1">Personal Profile</label>
                        {isEditingName ? (
                          <div className="flex flex-col sm:flex-row items-center gap-3">
                            <input 
                              type="text"
                              value={newName}
                              onChange={e => setNewName(e.target.value)}
                              className="w-full flex-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-5 py-3.5 text-sm font-bold focus:ring-4 focus:ring-emerald-500/10 outline-none shadow-sm transition-all"
                              placeholder="Enter your name"
                              autoFocus
                              onKeyDown={(e) => e.key === 'Enter' && handleUpdateName()}
                            />
                            <div className="flex items-center gap-2 w-full sm:w-auto">
                              <button 
                                onClick={handleUpdateName}
                                className="flex-1 sm:flex-none px-6 py-3.5 bg-emerald-500 text-white rounded-xl font-bold text-sm hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
                              >
                                Save
                              </button>
                              <button 
                                onClick={() => {
                                  setIsEditingName(false);
                                  setNewName(profile?.name || profile?.email?.split('@')[0] || '');
                                }}
                                className="flex-1 sm:flex-none p-3.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-red-500 rounded-xl transition-all active:scale-95"
                              >
                                <X className="w-5 h-5" />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800/50 rounded-2xl group hover:border-emerald-500/20 transition-all shadow-sm">
                            <div className="flex flex-col text-left">
                              <span className="text-2xl font-black tracking-tight text-zinc-900 dark:text-zinc-100">
                                {profile?.name || profile?.email?.split('@')[0]}
                              </span>
                              <span className="text-xs text-zinc-400 font-medium tracking-wide mt-0.5">
                                {profile?.email}
                              </span>
                            </div>
                            <button 
                              onClick={() => setIsEditingName(true)}
                              className="px-5 py-2.5 text-[11px] font-black uppercase tracking-widest text-zinc-400 hover:text-emerald-500 bg-zinc-50 dark:bg-zinc-800/50 hover:bg-emerald-500/5 rounded-xl transition-all border border-zinc-100 dark:border-zinc-800 flex items-center justify-center gap-2"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                              Edit Profile
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="flex items-center gap-3 px-2">
                      <div className="w-1 h-4 bg-emerald-500 rounded-full" />
                      <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-[0.2em]">Security & Privacy</h4>
                    </div>
                    <div className="grid grid-cols-1 gap-4">
                      <div className="p-6 rounded-2xl border border-zinc-100 dark:border-zinc-800/50 bg-white dark:bg-zinc-900 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all">
                        <div className="flex items-center gap-5">
                          <div className="w-12 h-12 rounded-xl bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center border border-zinc-100 dark:border-zinc-700/50">
                            <ShieldCheck className="w-6 h-6 text-emerald-500" />
                          </div>
                          <div className="text-left">
                            <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Primary Authentication</div>
                            <div className="text-[11px] text-zinc-500 mt-0.5">Your account is secured with password authentication.</div>
                          </div>
                        </div>
                        <button className="px-5 py-2.5 text-[11px] font-black uppercase tracking-widest text-zinc-400 hover:text-zinc-900 dark:hover:text-white bg-zinc-50 dark:bg-zinc-800/50 rounded-xl transition-all border border-zinc-100 dark:border-zinc-800">
                          Reset Password
                        </button>
                      </div>

                      <div className="p-6 rounded-2xl border border-zinc-100 dark:border-zinc-800/50 bg-white dark:bg-zinc-900 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all">
                        <div className="flex items-center gap-5">
                          <div className="w-12 h-12 rounded-xl bg-red-50 dark:bg-red-500/5 flex items-center justify-center border border-red-100 dark:border-red-500/10">
                            <Trash2 className="w-6 h-6 text-red-500" />
                          </div>
                          <div className="text-left">
                            <div className="text-sm font-bold text-red-500">Deactivate Personal Workspace</div>
                            <div className="text-[11px] text-red-400 text-opacity-60 mt-0.5">This will permanently remove all your chat history and data.</div>
                          </div>
                        </div>
                        <button className="px-5 py-2.5 text-[11px] font-black uppercase tracking-widest text-red-400 hover:text-white hover:bg-red-500 transition-all border border-red-100 dark:border-red-500/20 rounded-xl">
                          Terminate Account
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeSection === 'personality' && (
                <div className="space-y-8">
                  <div className="space-y-2">
                    <h3 className="text-lg font-bold">AI Personality</h3>
                    <p className="text-sm text-zinc-500">Choose how your AI companion communicates with you.</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {PERSONALITIES.map((p) => {
                      const Icon = p.icon;
                      const isSelected = profile?.personality === p.id || (!profile?.personality && p.id === 'professional');
                      return (
                        <button 
                          key={p.id}
                          onClick={() => handlePersonalitySelect(p.id)}
                          className={cn(
                            "group relative flex flex-col gap-4 p-6 rounded-2xl border text-left transition-all duration-300",
                            isSelected 
                              ? "bg-zinc-900 dark:bg-zinc-100 border-zinc-900 dark:border-zinc-100 shadow-lg scale-[1.01]" 
                              : "bg-white dark:bg-zinc-900 border-zinc-100 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 hover:shadow-sm"
                          )}
                        >
                          <div className={cn(
                            "w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-all duration-500 shadow-sm",
                            isSelected ? "bg-white/10 dark:bg-zinc-900/10 text-white" : p.color + " bg-opacity-10 text-current"
                          )}>
                            <Icon className={cn("w-5 h-5", isSelected ? (isDarkMode ? "text-zinc-900" : "text-white") : "text-current")} />
                          </div>
                          <div className="space-y-1.5">
                            <div className={cn("text-xs font-black uppercase tracking-widest leading-none", isSelected ? "text-white dark:text-zinc-900" : "text-zinc-900 dark:text-white")}>
                              {p.name}
                            </div>
                            <div className={cn("text-[11px] font-medium leading-relaxed opacity-70", isSelected ? "text-white/70 dark:text-zinc-900/70" : "text-zinc-500")}>
                              {p.description}
                            </div>
                          </div>
                          {isSelected && (
                            <div className="absolute top-4 right-4 animate-in fade-in zoom-in duration-300">
                              <div className={cn("w-5 h-5 rounded-full flex items-center justify-center", isDarkMode ? "bg-zinc-900 text-zinc-100" : "bg-white text-zinc-900")}>
                                <Check className="w-3 h-3" />
                              </div>
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {activeSection === 'billing' && (
                <div className="space-y-8">
                  <div className="space-y-2">
                    <h3 className="text-lg font-bold">Billing & Usage</h3>
                    <p className="text-sm text-zinc-500">Manage your subscription and monitor your usage limits.</p>
                  </div>

                  {profile?.plan === 'free' ? (
                    <div className="space-y-6">
                      <div className="flex p-1 bg-zinc-100 dark:bg-zinc-900 rounded-xl w-fit border border-zinc-200 dark:border-zinc-800">
                        <button 
                          onClick={() => setBillingPeriod('month')}
                          className={cn(
                            "px-4 py-1.5 rounded-lg text-xs font-bold transition-all",
                            billingPeriod === 'month' ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-sm" : "text-zinc-500"
                          )}
                        >
                          Monthly
                        </button>
                        <button 
                          onClick={() => setBillingPeriod('year')}
                          className={cn(
                            "px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5",
                            billingPeriod === 'year' ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-sm" : "text-zinc-500"
                          )}
                        >
                          Yearly
                          <span className="px-1.5 py-0.5 bg-emerald-500 text-white text-[8px] rounded uppercase">20% Off</span>
                        </button>
                      </div>

                      <div className="grid grid-cols-1 gap-6">
                        {Object.entries(plans).map(([id, plan]) => (
                          <div key={id} className="p-8 rounded-3xl border border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex flex-col lg:flex-row lg:items-center justify-between gap-8 hover:shadow-lg transition-all duration-500">
                            <div className="space-y-4">
                              <div className="flex items-center gap-3">
                                <h5 className="font-black text-lg leading-none tracking-tight">{plan.name}</h5>
                                {id === 'pro' && <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-500 text-[9px] font-black uppercase rounded-full">Popular</span>}
                              </div>
                              <div className="flex items-baseline gap-1.5">
                                <span className="text-4xl font-black tracking-tighter text-zinc-900 dark:text-white">${billingPeriod === 'month' ? plan.monthly : plan.yearly}</span>
                                <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">/{billingPeriod === 'month' ? 'month' : 'year'}</span>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2">
                                {plan.features.map((f) => (
                                  <div key={f} className="flex items-center gap-2.5 text-[11px] font-medium text-zinc-500">
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                    {f}
                                  </div>
                                ))}
                              </div>
                            </div>
                            <button 
                              onClick={() => handleSubscribe(id)}
                              disabled={isSubscribing !== null}
                              className="px-8 py-4 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-xl font-black text-xs uppercase tracking-widest transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 shadow-lg h-fit whitespace-nowrap"
                            >
                              {isSubscribing === id ? 'Processing...' : 'Subscribe ' + plan.name}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <div className="p-6 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl">
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <div className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider mb-1">Current Plan</div>
                            <div className="text-xl font-bold capitalize">{profile?.plan} Plan</div>
                          </div>
                          <div className="px-3 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold rounded-lg border border-emerald-500/20">
                            ACTIVE
                          </div>
                        </div>
                        <p className="text-xs text-zinc-500 leading-relaxed">
                          Your next billing date is not available in test mode. Manage your subscription details on Stripe.
                        </p>
                      </div>
                      <button 
                        onClick={() => window.open('https://billing.stripe.com/p/login/test_4gw5lr8Yt4Yt4Yt4Yt', '_blank')}
                        className="w-full py-4 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-2xl text-xs font-bold transition-all hover:brightness-110 active:scale-[0.98] shadow-lg flex items-center justify-center gap-2"
                      >
                        <ExternalLink className="w-4 h-4" />
                        Customer Portal
                      </button>
                    </div>
                  )}
                </div>
              )}

              {activeSection === 'display' && (
                <div className="space-y-8">
                  <div className="space-y-2">
                    <h3 className="text-lg font-bold">Display Settings</h3>
                    <p className="text-sm text-zinc-500">Customize the look and feel of your interface.</p>
                  </div>

                  <div className="grid gap-4">
                    <button 
                      onClick={onToggleTheme}
                      className="w-full p-5 rounded-2xl border border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-center justify-between hover:border-zinc-300 dark:hover:border-zinc-700 transition-all text-left"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                          {isDarkMode ? <Sun className="w-5 h-5 text-zinc-400" /> : <Moon className="w-5 h-5 text-zinc-400" />}
                        </div>
                        <div>
                          <div className="text-sm font-bold">Theme</div>
                          <div className="text-xs text-zinc-500">{isDarkMode ? 'Light' : 'Dark'} mode available</div>
                        </div>
                      </div>
                      <div className="px-3 py-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-[10px] font-bold uppercase tracking-wider">
                        {isDarkMode ? 'Dark' : 'Light'}
                      </div>
                    </button>

                    <button 
                      onClick={onToggleAutoPlay}
                      className="w-full p-5 rounded-2xl border border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-center justify-between hover:border-zinc-300 dark:hover:border-zinc-700 transition-all text-left"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                          <Zap className={cn("w-5 h-5", autoPlayVoice ? "text-emerald-500" : "text-zinc-400")} />
                        </div>
                        <div>
                          <div className="text-sm font-bold">Auto-Response Voice</div>
                          <div className="text-xs text-zinc-500">Automatically speak AI replies</div>
                        </div>
                      </div>
                      <div className={cn(
                        "px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors",
                        autoPlayVoice ? "bg-emerald-500 text-white" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400"
                      )}>
                        {autoPlayVoice ? 'On' : 'Off'}
                      </div>
                    </button>
                  </div>
                </div>
              )}

              {activeSection === 'legal' && (
                <div className="space-y-8">
                  <div className="space-y-2">
                    <h3 className="text-lg font-bold">Legal & Support</h3>
                    <p className="text-sm text-zinc-500">Review our terms, privacy policies, and about information.</p>
                  </div>

                  <div className="grid gap-2">
                    {[
                      { type: 'about' as const, label: 'About Trelvix AI', icon: Info },
                      { type: 'privacy' as const, label: 'Privacy Policy', icon: ShieldCheck },
                      { type: 'terms' as const, label: 'Terms of Service', icon: FileText }
                    ].map((doc) => (
                      <button 
                        key={doc.type}
                        onClick={() => onShowLegal(doc.type)} 
                        className="w-full p-4 rounded-xl border border-zinc-100 dark:border-zinc-900 flex items-center justify-between group hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <doc.icon className="w-4 h-4 text-zinc-400" />
                          <span className="text-sm font-medium">{doc.label}</span>
                        </div>
                        <ChevronRight className="w-4 h-4 text-zinc-300 group-hover:text-zinc-600 dark:group-hover:text-zinc-400 transition-all" />
                      </button>
                    ))}
                  </div>

                  <div className="pt-10 flex flex-col items-center gap-4 text-center">
                    <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center">
                      <HelpCircle className="w-6 h-6 text-zinc-400" />
                    </div>
                    <div>
                      <div className="text-xs font-bold">Need help?</div>
                      <p className="text-[11px] text-zinc-500 mt-1 max-w-[200px]">
                        Contact our support team for specialized assistance.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

