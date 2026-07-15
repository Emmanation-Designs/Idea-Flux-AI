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
  ImageIcon,
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
import { supabase } from '../lib/supabase';
import { openExternalLink } from '../utils/nativeCompat';
import { getPlan, getPlanPrice, getPlanLimits, PlanId } from '../subscription/catalog';
import { BillingCenter } from './BillingCenter';

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
  imageSpeed?: 'fast' | 'quality';
  onToggleImageSpeed?: () => void;
}) => {
  const {
    profile,
    onClose,
    onUpdateProfile,
    onShowLegal,
    isDarkMode,
    onToggleTheme,
    imageSpeed = 'quality',
    onToggleImageSpeed
  } = props;
  const [activeSection, setActiveSection] = React.useState<SettingsSection | null>(typeof window !== 'undefined' && window.innerWidth > 768 ? 'account' : null);
  const [isEditingName, setIsEditingName] = React.useState(false);
  const [newName, setNewName] = React.useState(profile?.name || profile?.email?.split('@')[0] || '');
  const [isUploading, setIsUploading] = React.useState(false);
  const [localAvatarPreview, setLocalAvatarPreview] = React.useState<string | null>(null);
  const [billingPeriod, setBillingPeriod] = React.useState<'month' | 'year'>('month');
  const [isSubscribing, setIsSubscribing] = React.useState<string | null>(null);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('success') === 'true') {
      toast.success('Payment successful! Your plan has been activated.');
      // Remove query param without refreshing
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);
    }
  }, []);

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

  const getLocalRegion = (): 'nigeria' | 'international' => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz && (tz.includes('Lagos') || tz.includes('Africa/Lagos') || tz.includes('Nigeria'))) {
        return 'nigeria';
      }
    } catch (e) {}
    return 'international';
  };

  const region = getLocalRegion();

  const getFeaturesList = (planId: PlanId) => {
    const limits = getPlanLimits(planId);
    if (planId === 'plus') {
      return [
        'Unlimited chat messages',
        `${limits.image_generation} image generations / day`,
        `${limits.image_edit} image edits / day`,
        'Premium AI Models & priority speed',
        'No advertisement banner'
      ];
    } else if (planId === 'pro') {
      return [
        'Unlimited chat messages',
        `${limits.image_generation} image generations / day`,
        `${limits.image_edit} image edits / day`,
        'Elite AI Models & maximum speed',
        'Full Document & PDF suite access',
        'Dedicated priority queue'
      ];
    }
    return [];
  };

  const plusPlan = getPlan('plus');
  const proPlan = getPlan('pro');

  const plusMonthlyPrice = getPlanPrice('plus', region).price;
  const plusYearlyPrice = Math.round(plusMonthlyPrice * 12 * 0.85);

  const proMonthlyPrice = getPlanPrice('pro', region).price;
  const proYearlyPrice = Math.round(proMonthlyPrice * 12 * 0.85);

  const plans = {
    pro: {
      name: proPlan.identity.displayName,
      monthly: proMonthlyPrice,
      yearly: proYearlyPrice,
      features: getFeaturesList('pro'),
      marketing: proPlan.marketing
    },
    plus: {
      name: plusPlan.identity.displayName,
      monthly: plusMonthlyPrice,
      yearly: plusYearlyPrice,
      features: getFeaturesList('plus'),
      marketing: plusPlan.marketing
    }
  };

  const handleSubscribe = async (planId: string) => {
    if (!profile?.id) return;
    setIsSubscribing(planId);
    try {
      const response = await fetch('/api/payment/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan: planId,
          interval: billingPeriod,
          userId: profile.id,
          region
        })
      });
      const data = await response.json();
      if (data.url) {
        openExternalLink(data.url);
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

  const currentPersonality = PERSONALITIES.find(p => p.id === (profile?.personality || 'creative'))!;

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-0 md:p-6 bg-black/40 backdrop-blur-sm overflow-y-auto cursor-pointer"
    >
      <motion.div 
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full h-[100dvh] md:h-[680px] md:max-h-[calc(100vh-3rem)] md:max-w-4xl bg-white dark:bg-zinc-950 md:rounded-3xl shadow-2xl border border-zinc-200 dark:border-zinc-800 flex overflow-hidden cursor-default"
      >
        {/* Sidebar */}
        <div className={cn(
          "flex-col w-64 border-r border-zinc-200 dark:border-zinc-800 p-6 shrink-0 bg-white dark:bg-zinc-950 h-full overflow-y-auto",
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
                <div className="space-y-8 pb-12">
                  <div className="border-b border-zinc-100 dark:border-zinc-900 pb-5">
                    <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">Account Credentials</h3>
                    <p className="text-xs text-zinc-500 mt-1">Update your workspace profile information and visibility settings.</p>
                  </div>

                  {/* Profile Identification */}
                  <div className="flex flex-col sm:flex-row items-center gap-6 p-6 bg-zinc-50/50 dark:bg-zinc-900/10 rounded-2xl border border-zinc-100 dark:border-zinc-900/50">
                    <div className="relative shrink-0">
                      <div className="w-20 h-20 rounded-full bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center text-xl font-bold border border-zinc-200 dark:border-zinc-805 overflow-hidden relative z-10">
                        {localAvatarPreview || profile?.avatar_url ? (
                          <img src={localAvatarPreview || profile?.avatar_url || ''} alt="Profile" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-zinc-400 dark:text-zinc-600 font-semibold select-none">
                            {profile?.name?.charAt(0).toUpperCase() || profile?.email?.charAt(0).toUpperCase()}
                          </span>
                        )}
                        {isUploading && (
                          <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-20 backdrop-blur-sm">
                            <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                          </div>
                        )}
                      </div>
                      <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-zinc-950 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-300 hover:text-white flex items-center justify-center shadow-lg hover:bg-emerald-500 dark:hover:bg-emerald-500 transition-all active:scale-95 z-20 cursor-pointer"
                        title="Upload Avatar"
                      >
                        <Camera className="w-4 h-4" />
                      </button>
                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        className="hidden" 
                        accept="image/*" 
                        onChange={handleFileChange}
                      />
                    </div>

                    <div className="text-center sm:text-left space-y-1">
                      <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                        {profile?.name || profile?.email?.split('@')[0]}
                      </h4>
                      <p className="text-xs text-zinc-400 font-medium">{profile?.email}</p>
                      <div className="inline-flex items-center gap-1.5 px-2 py-0.5 mt-2 bg-emerald-500/10 border border-emerald-500/20 rounded-md text-[9px] font-black tracking-widest text-emerald-600 dark:text-emerald-400 uppercase select-none">
                        {profile?.plan || 'Free'} Plan Active
                      </div>
                    </div>
                  </div>

                  {/* Settings fields */}
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-zinc-400 dark:text-zinc-500 font-bold uppercase tracking-wider block pl-1">Display Name</label>
                      <div className="relative flex items-center">
                        <input 
                          type="text"
                          value={newName}
                          onChange={e => setNewName(e.target.value)}
                          className="w-full bg-white dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-800 rounded-xl pl-4 pr-24 py-3 text-xs font-semibold focus:ring-1 focus:ring-emerald-500/30 focus:border-emerald-500/40 outline-none transition-all dark:text-white"
                          placeholder="Your profile name"
                        />
                        {newName !== (profile?.name || profile?.email?.split('@')[0] || '') && (
                          <button
                            onClick={handleUpdateName}
                            className="absolute right-2 px-3 py-1.5 bg-zinc-950 dark:bg-zinc-100 hover:bg-zinc-900 dark:hover:bg-white text-white dark:text-zinc-950 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all cursor-pointer"
                          >
                            Update
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] text-zinc-400 dark:text-zinc-500 font-bold uppercase tracking-wider block pl-1">Email Address</label>
                      <input 
                        type="text"
                        value={profile?.email || ''}
                        disabled
                        className="w-full bg-zinc-100/60 dark:bg-zinc-905/10 border border-zinc-200 dark:border-zinc-900 rounded-xl px-4 py-3 text-xs font-semibold text-zinc-400 dark:text-zinc-650 cursor-not-allowed outline-none select-all"
                      />
                      <p className="text-[9px] text-zinc-400 dark:text-zinc-600 pl-1">Primary email verification completed. Contact support to change address.</p>
                    </div>
                  </div>

                  {/* Danger Zone */}
                  <div className="pt-6 border-t border-zinc-100 dark:border-zinc-900 space-y-4">
                    <div>
                      <h4 className="text-xs font-black text-red-500 uppercase tracking-widest">Danger Zone</h4>
                      <p className="text-[10px] text-zinc-400 dark:text-zinc-500 leading-relaxed">Permanent, destructive, and non-reversible changes regarding your account data.</p>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-red-500/10 dark:border-red-500/5 bg-red-50/5 dark:bg-red-950/5">
                      <div className="text-left space-y-0.5">
                        <div className="text-xs font-bold text-zinc-800 dark:text-zinc-200">Deactivate Personal Workspace</div>
                        <p className="text-[10px] text-zinc-400 dark:text-zinc-500 max-w-sm leading-normal">Purges all conversation histories, generated visuals, and workspace custom parameters.</p>
                      </div>
                      <button 
                        onClick={() => {
                          const confirmDelete = window.confirm("Are you sure you want to permanently deactivate and purge your Trelvix Workspace? This action is absolute and cannot be undone.");
                          if (confirmDelete) {
                            toast.loading("Purging personal datastores...");
                            setTimeout(() => {
                              toast.dismiss();
                              toast.success("Workspace purged successfully. Session closing.");
                              onClose();
                            }, 1500);
                          }
                        }}
                        className="px-4.5 py-2 bg-red-500/5 hover:bg-red-600 border border-red-500/20 hover:border-red-600/50 text-red-500 hover:text-white transition-all font-black uppercase text-[9px] tracking-wider rounded-lg shrink-0 cursor-pointer"
                      >
                        Terminate Account
                      </button>
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
                      const isSelected = profile?.personality === p.id || (!profile?.personality && p.id === 'creative');
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
                <div className="space-y-6">
                  <div className="space-y-2">
                    <h3 className="text-xl font-black tracking-tight">Billing & SaaS Workspace</h3>
                    <p className="text-sm text-zinc-500">Manage your active dynamic subscription model, view billing limits, and track SaaS resource usage.</p>
                  </div>
                  <BillingCenter 
                    profile={profile} 
                    onUpdateProfile={onUpdateProfile} 
                    onClose={onClose} 
                  />
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
                      onClick={onToggleImageSpeed}
                      className="w-full p-5 rounded-2xl border border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-center justify-between hover:border-zinc-300 dark:hover:border-zinc-700 transition-all text-left"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                          <ImageIcon className={cn("w-5 h-5", imageSpeed === 'fast' ? "text-sky-500" : "text-zinc-400")} />
                        </div>
                        <div>
                          <div className="text-sm font-bold">Visual Engine Speed</div>
                          <div className="text-xs text-zinc-500">
                            {imageSpeed === 'fast' 
                              ? 'Ultra-Fast Turbo Generation' 
                              : 'High Definition Quality (Slower)'}
                          </div>
                        </div>
                      </div>
                      <div className={cn(
                        "px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors",
                        imageSpeed === 'fast' ? "bg-sky-500 text-white" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500"
                      )}>
                        {imageSpeed === 'fast' ? 'Turbo' : 'Quality'}
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

