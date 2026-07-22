import React, { useEffect, useState } from 'react';
import { 
  Zap, 
  Check, 
  ExternalLink, 
  CreditCard, 
  ShieldCheck, 
  Briefcase, 
  Sparkles, 
  ChevronRight, 
  X, 
  Info, 
  RefreshCw, 
  AlertTriangle, 
  Calendar, 
  DollarSign, 
  Globe, 
  Activity, 
  FileText, 
  Lock,
  ArrowUpRight,
  CheckCircle2,
  Trash2,
  Play,
  Edit2,
  Mail
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { Profile } from '../types';
import { toast } from 'sonner';
import { openExternalLink } from '../utils/nativeCompat';
import { getPlan, getPlanPrice, SUBSCRIPTION_CATALOG, PlanId } from '../subscription/catalog';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Payment Methods Configuration (Driven by configuration rather than hardcoded assumptions - STEP 5)
interface ProviderConfig {
  id: string;
  name: string;
  badge: string;
  status: 'connected' | 'coming-soon';
  description: string;
}

const PROVIDERS_CONFIG: ProviderConfig[] = [
  { id: 'paypal', name: 'PayPal', badge: 'Connected', status: 'connected', description: 'Primary payment integration' },
  { id: 'paystack', name: 'Paystack', badge: 'Coming Soon', status: 'coming-soon', description: 'African markets gateway' },
  { id: 'stripe', name: 'Stripe', badge: 'Coming Soon', status: 'coming-soon', description: 'Credit card processor' },
  { id: 'apple', name: 'Apple Pay', badge: 'Coming Soon', status: 'coming-soon', description: 'In-app purchases for iOS' },
  { id: 'google', name: 'Google Play', badge: 'Coming Soon', status: 'coming-soon', description: 'In-app purchases for Android' }
];

interface BillingCenterProps {
  profile: Profile | null;
  onUpdateProfile: (updates: Partial<Profile>) => Promise<any>;
  onClose: () => void;
  onUpgrade?: () => void;
}

export const BillingCenter: React.FC<BillingCenterProps> = ({
  profile,
  onUpdateProfile,
  onClose,
  onUpgrade
}) => {
  const [billingPeriod, setBillingPeriod] = useState<'month' | 'year'>('month');
  const [isSubscribing, setIsSubscribing] = useState<string | null>(null);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isResuming, setIsResuming] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Payment method modal state
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedPlanForUpgrade, setSelectedPlanForUpgrade] = useState<string | null>(null);

  // Detailed usage state
  const [detailedUsage, setDetailedUsage] = useState<any | null>(null);
  const [isLoadingUsage, setIsLoadingUsage] = useState(true);

  // Billing email edit state
  const [isEditingBillingEmail, setIsEditingBillingEmail] = useState(false);
  const [billingEmailInput, setBillingEmailInput] = useState(profile?.billing_email || profile?.email || '');
  const [isSavingBillingEmail, setIsSavingBillingEmail] = useState(false);

  useEffect(() => {
    setBillingEmailInput(profile?.billing_email || profile?.email || '');
  }, [profile?.billing_email, profile?.email]);

  const handleSaveBillingEmail = async () => {
    if (!billingEmailInput || !billingEmailInput.includes('@')) {
      toast.error('Please enter a valid billing email address');
      return;
    }
    setIsSavingBillingEmail(true);
    try {
      await onUpdateProfile({ billing_email: billingEmailInput.trim() });
      toast.success('Billing email updated successfully');
      setIsEditingBillingEmail(false);
    } catch (err: any) {
      toast.error('Failed to update billing email: ' + (err.message || 'Unknown error'));
    } finally {
      setIsSavingBillingEmail(false);
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

  // Fetch live usage and limits
  const fetchUsageData = async (silent = false) => {
    if (!silent) setIsLoadingUsage(true);
    try {
      const tokenObj = localStorage.getItem('sb-' + import.meta.env.VITE_SUPABASE_ANON_KEY?.split(':')[0] + '-auth-token');
      let token = '';
      if (tokenObj) {
        try {
          const parsed = JSON.parse(tokenObj);
          token = parsed.access_token || '';
        } catch (e) {}
      }

      const response = await fetch('/api/subscription/usage', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setDetailedUsage(data);
      }
    } catch (err) {
      console.error('Failed to fetch detailed usage:', err);
    } finally {
      setIsLoadingUsage(false);
    }
  };

  useEffect(() => {
    fetchUsageData();
  }, [profile?.id]);

  const handleSync = async () => {
    setIsRefreshing(true);
    try {
      const tokenObj = localStorage.getItem('sb-' + import.meta.env.VITE_SUPABASE_ANON_KEY?.split(':')[0] + '-auth-token');
      let token = '';
      if (tokenObj) {
        try {
          const parsed = JSON.parse(tokenObj);
          token = parsed.access_token || '';
        } catch (e) {}
      }

      const response = await fetch('/api/subscription/sync', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        if (data.subscription) {
          await onUpdateProfile(data.subscription);
          toast.success('Subscription state synchronized successfully');
          fetchUsageData(true);
        }
      } else {
        throw new Error('Sync failed');
      }
    } catch (err: any) {
      toast.error('Synchronization failed: ' + (err.message || 'Unknown error'));
    } finally {
      setIsRefreshing(false);
    }
  };

  // Actions
  const handleUpgrade = async (planId: string) => {
    if (!profile?.id) {
      toast.error('Please log in to upgrade');
      return;
    }
    setSelectedPlanForUpgrade(planId);
    setPaymentModalOpen(true);
  };

  const executeCheckout = async (planId: string, provider: 'paypal' | 'paystack') => {
    setIsSubscribing(planId);
    try {
      const response = await fetch('/api/payment/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan: planId,
          interval: billingPeriod,
          userId: profile.id,
          region,
          provider
        })
      });

      const data = await response.json();
      if (data.url) {
        openExternalLink(data.url);
        setPaymentModalOpen(false);
      } else {
        throw new Error(data.error || 'Failed to create checkout session');
      }
    } catch (err: any) {
      console.error('[Checkout Error]:', err);
      toast.error(err.message || 'Subscription upgrade initiation failed');
    } finally {
      setIsSubscribing(null);
    }
  };

  const handleCancelSubscription = async () => {
    setIsCancelling(true);
    try {
      const tokenObj = localStorage.getItem('sb-' + import.meta.env.VITE_SUPABASE_ANON_KEY?.split(':')[0] + '-auth-token');
      let token = '';
      if (tokenObj) {
        try {
          const parsed = JSON.parse(tokenObj);
          token = parsed.access_token || '';
        } catch (e) {}
      }

      const response = await fetch('/api/subscription/cancel', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.subscription) {
          await onUpdateProfile(data.subscription);
          toast.success('Your subscription has been cancelled. You can continue using your benefits until expiry.');
          setCancelConfirmOpen(false);
          fetchUsageData(true);
        }
      } else {
        const errData = await response.json();
        throw new Error(errData.error || 'Cancellation failed');
      }
    } catch (err: any) {
      toast.error('Failed to cancel subscription: ' + err.message);
    } finally {
      setIsCancelling(false);
    }
  };

  const handleResumeSubscription = async () => {
    setIsResuming(true);
    try {
      const tokenObj = localStorage.getItem('sb-' + import.meta.env.VITE_SUPABASE_ANON_KEY?.split(':')[0] + '-auth-token');
      let token = '';
      if (tokenObj) {
        try {
          const parsed = JSON.parse(tokenObj);
          token = parsed.access_token || '';
        } catch (e) {}
      }

      const response = await fetch('/api/subscription/resume', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.subscription) {
          await onUpdateProfile(data.subscription);
          toast.success('Your subscription has been successfully resumed!');
          fetchUsageData(true);
        }
      } else {
        // Fallback to checkout if resume not fully supported
        toast.info('Redirecting you to checkout to renew your subscription...');
        handleUpgrade(profile?.plan || 'plus');
      }
    } catch (err: any) {
      toast.error('Failed to resume subscription: ' + err.message);
    } finally {
      setIsResuming(false);
    }
  };

  // Status mapping - STEP 6
  const getStatusBadge = (status: string | null | undefined) => {
    const rawStatus = (status || 'FREE').toUpperCase();
    switch (rawStatus) {
      case 'ACTIVE':
        return {
          text: 'ACTIVE',
          classes: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
        };
      case 'CANCELLED':
        return {
          text: 'CANCELLED',
          classes: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
        };
      case 'PAST DUE':
      case 'PAST_DUE':
        return {
          text: 'PAST DUE',
          classes: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
        };
      case 'EXPIRED':
        return {
          text: 'EXPIRED',
          classes: 'bg-zinc-500/10 text-zinc-500 dark:text-zinc-400 border-zinc-500/20'
        };
      case 'FAILED':
        return {
          text: 'FAILED',
          classes: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20'
        };
      default:
        return {
          text: 'FREE',
          classes: 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700'
        };
    }
  };

  const statusObj = getStatusBadge(profile?.subscription_status);
  const currentPlanId: PlanId = profile?.plan || 'free';
  const currentPlanCatalog = getPlan(currentPlanId);

  // ChatGPT style usage status - STEP 10
  const capacityStatus = detailedUsage?.capacity_status || "AI usage available";
  const isCapacityLow = capacityStatus === "AI usage running low";

  const ttsUsed = detailedUsage?.tts_used || 0;
  const ttsLimit = detailedUsage?.tts_limit || 0;
  const isTtsLow = ttsLimit > 0 && (ttsLimit - ttsUsed < 2000);
  const ttsStatus = isTtsLow ? "Voice synthesis running low" : "Voice synthesis active";

  return (
    <div className="space-y-6 text-zinc-900 dark:text-zinc-100">
      {/* Title Header */}
      <div className="border-b border-zinc-150 dark:border-zinc-800 pb-4 mb-4">
        <h3 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white">Billing</h3>
      </div>

      {/* Plan Row */}
      <div className="flex items-center justify-between py-2">
        <div className="space-y-1">
          <div className="text-base font-bold text-zinc-900 dark:text-zinc-100">
            Trelvix {currentPlanCatalog.identity.displayName}
          </div>
          <div className="text-xs text-zinc-400 dark:text-zinc-500 font-medium">
            {currentPlanId === 'free' ? 'Intelligence for everyday tasks' : currentPlanCatalog.identity.description}
          </div>
        </div>
        <button
          onClick={() => {
            if (onUpgrade) {
              onUpgrade();
            } else {
              toast.info('Compare plans modal triggered');
            }
          }}
          className="px-4 py-2 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900 text-zinc-900 dark:text-zinc-100 rounded-full text-xs font-bold transition-all whitespace-nowrap active:scale-95 shadow-sm"
        >
          Compare plans
        </button>
      </div>

      <hr className="border-zinc-150 dark:border-zinc-800/80" />

      {/* Billing Information Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-2">
        <div className="space-y-2 flex-1">
          <div className="text-base font-bold text-zinc-900 dark:text-zinc-100">Billing information</div>
          <div className="space-y-1">
            <div className="text-[10px] uppercase font-bold text-zinc-400 dark:text-zinc-500 tracking-wider">Billing email</div>
            {isEditingBillingEmail ? (
              <div className="flex items-center gap-2 max-w-md pt-1">
                <input 
                  type="email"
                  value={billingEmailInput}
                  onChange={(e) => setBillingEmailInput(e.target.value)}
                  placeholder="billing@example.com"
                  className="flex-1 bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded-xl px-3 py-1.5 text-xs font-medium focus:ring-2 focus:ring-emerald-500 outline-none dark:text-white"
                />
                <button
                  onClick={handleSaveBillingEmail}
                  disabled={isSavingBillingEmail}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {isSavingBillingEmail ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={() => {
                    setBillingEmailInput(profile?.billing_email || profile?.email || '');
                    setIsEditingBillingEmail(false);
                  }}
                  className="px-3 py-1.5 bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg text-xs font-bold transition-all cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 select-all">
                  {profile?.billing_email || profile?.email || 'No billing email provided'}
                </span>
                <button
                  onClick={() => setIsEditingBillingEmail(true)}
                  className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Edit2 className="w-3 h-3" />
                  <span>Edit</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <hr className="border-zinc-150 dark:border-zinc-800/80" />

      {/* Grid of details */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-1">
        <div>
          <div className="text-[10px] uppercase font-black tracking-wider text-zinc-400 dark:text-zinc-500 mb-1">Billing Provider</div>
          <div className="text-xs font-bold text-zinc-800 dark:text-zinc-200 capitalize">
            {profile?.subscription_provider || 'System Free'}
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase font-black tracking-wider text-zinc-400 dark:text-zinc-500 mb-1">Country</div>
          <div className="text-xs font-bold text-zinc-800 dark:text-zinc-200 uppercase">
            {profile?.billing_country || profile?.country_code || (region === 'nigeria' ? 'NG' : 'US')}
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase font-black tracking-wider text-zinc-400 dark:text-zinc-500 mb-1">Currency</div>
          <div className="text-xs font-bold text-zinc-800 dark:text-zinc-200 uppercase">
            {profile?.billing_currency || (region === 'nigeria' ? 'NGN' : 'USD')}
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase font-black tracking-wider text-zinc-400 dark:text-zinc-500 mb-1">Renewal / End</div>
          <div className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
            {profile?.subscription_expires_at ? (
              new Date(profile.subscription_expires_at).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
              })
            ) : 'Lifetime'}
          </div>
        </div>
      </div>

      {currentPlanId !== 'free' && (
        <div className="flex justify-end pt-1">
          {profile?.subscription_status === 'CANCELLED' || profile?.subscription_status === 'cancelled' ? (
            <button 
              onClick={handleResumeSubscription}
              disabled={isResuming}
              className="text-xs font-bold text-emerald-500 hover:text-emerald-600 dark:text-emerald-400 dark:hover:text-emerald-300 transition-colors flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
            >
              <Play className="w-3 h-3" />
              Resume Subscription
            </button>
          ) : (
            <button 
              onClick={() => setCancelConfirmOpen(true)}
              disabled={isCancelling}
              className="text-xs font-bold text-rose-500 hover:text-rose-600 dark:text-rose-400 dark:hover:text-rose-300 transition-colors flex items-center gap-1.5 active:scale-95"
            >
              <Trash2 className="w-3 h-3" />
              Cancel Subscription
            </button>
          )}
        </div>
      )}

      <hr className="border-zinc-150 dark:border-zinc-800/80" />

      {/* Centralized Capacity Tracker */}
      <div className="space-y-4 pt-2">
        <div className="space-y-0.5">
          <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">System Status & Capacity</h4>
          <p className="text-[10px] text-zinc-400 dark:text-zinc-500">Current availability of AI and speech models on your account.</p>
        </div>

        {isLoadingUsage ? (
          <div className="p-8 text-center border border-zinc-200 dark:border-zinc-800 rounded-2xl bg-zinc-50/50 dark:bg-zinc-900/50 flex flex-col items-center gap-2">
            <RefreshCw className="w-4 h-4 text-zinc-400 animate-spin" />
            <div className="text-[10px] font-bold text-zinc-400">Loading system status...</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* AI Capacity Card */}
            <div className="p-4 bg-white dark:bg-zinc-950/40 border border-zinc-150 dark:border-zinc-900 rounded-2xl flex flex-col justify-between h-28 hover:border-zinc-250 dark:hover:border-zinc-800 transition-all shadow-sm">
              <div className="flex items-start justify-between">
                <span className="text-xs font-bold text-zinc-800 dark:text-zinc-250">
                  AI Usage Engine
                </span>
                <span className={cn(
                  "text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border border-current bg-current/5",
                  isCapacityLow ? "text-amber-500 border-amber-500" : "text-emerald-500 border-emerald-500"
                )}>
                  {isCapacityLow ? "Running Low" : "Active"}
                </span>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "w-2 h-2 rounded-full animate-pulse",
                    isCapacityLow ? "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]" : "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"
                  )} />
                  <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-100">
                    {capacityStatus}
                  </span>
                </div>
                <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-medium leading-relaxed">
                  {isCapacityLow 
                    ? "Your high-speed daily limit is running low. Standard models remain operational."
                    : "All intelligence, generation, and extraction models are fully operational."}
                </p>
              </div>
            </div>

            {/* Voice synthesis card */}
            <div className="p-4 bg-white dark:bg-zinc-950/40 border border-zinc-150 dark:border-zinc-900 rounded-2xl flex flex-col justify-between h-28 hover:border-zinc-250 dark:hover:border-zinc-800 transition-all shadow-sm">
              <div className="flex items-start justify-between">
                <span className="text-xs font-bold text-zinc-800 dark:text-zinc-250">
                  Voice Synthesis
                </span>
                <span className={cn(
                  "text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border border-current bg-current/5",
                  isTtsLow ? "text-amber-500 border-amber-500" : "text-emerald-500 border-emerald-500"
                )}>
                  {isTtsLow ? "Running Low" : "Active"}
                </span>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "w-2 h-2 rounded-full animate-pulse",
                    isTtsLow ? "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]" : "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"
                  )} />
                  <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-100">
                    {ttsStatus}
                  </span>
                </div>
                <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-medium leading-relaxed">
                  {isTtsLow
                    ? "Monthly speech character allowance is low. Refills on subscription renewal."
                    : "High-fidelity text-to-speech character generation is active."}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      <hr className="border-zinc-150 dark:border-zinc-800/80" />

      {/* Connected Payment Channels */}
      <div className="space-y-4 pt-2">
        <div className="space-y-0.5">
          <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">Connected Payment Channels</h4>
          <p className="text-[10px] text-zinc-400 dark:text-zinc-500">Enable and configure checkout processors.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {PROVIDERS_CONFIG.map((prov) => {
            const isConnected = prov.status === 'connected';
            return (
              <div 
                key={prov.id}
                className={cn(
                  "p-3 rounded-2xl border flex items-center justify-between transition-all",
                  isConnected 
                    ? "bg-white dark:bg-zinc-950/40 border-zinc-200 dark:border-zinc-850" 
                    : "bg-zinc-50/50 dark:bg-zinc-900/10 border-zinc-100 dark:border-zinc-900 opacity-60"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-8 h-8 rounded-xl flex items-center justify-center shrink-0",
                    isConnected ? "bg-emerald-500/10" : "bg-zinc-100 dark:bg-zinc-800"
                  )}>
                    <CreditCard className={cn("w-3.5 h-3.5", isConnected ? "text-emerald-500" : "text-zinc-500")} />
                  </div>
                  <div>
                    <h6 className="font-bold text-xs text-zinc-800 dark:text-zinc-200">{prov.name}</h6>
                    <p className="text-[9px] text-zinc-400 leading-none mt-0.5">{prov.description}</p>
                  </div>
                </div>

                <span className={cn(
                  "px-2 py-0.5 text-[8px] font-black uppercase rounded tracking-wider",
                  isConnected 
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" 
                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500"
                )}>
                  {prov.badge}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <hr className="border-zinc-150 dark:border-zinc-800/80" />

      {/* Invoice Ledger */}
      <div className="space-y-4 pt-2">
        <div className="space-y-0.5">
          <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">Billing & Invoice Ledger</h4>
          <p className="text-[10px] text-zinc-400 dark:text-zinc-500">Historical transaction database and receipts.</p>
        </div>

        <div className="p-6 border border-zinc-200 dark:border-zinc-850 rounded-2xl bg-white dark:bg-zinc-950/40 text-center flex flex-col items-center justify-center gap-2 shadow-sm">
          <div className="w-8 h-8 rounded-full bg-zinc-50 dark:bg-zinc-900 flex items-center justify-center border border-zinc-100 dark:border-zinc-800">
            <FileText className="w-4 h-4 text-zinc-400" />
          </div>
          <div className="space-y-0.5">
            <div className="text-xs font-bold text-zinc-700 dark:text-zinc-300">No transaction records.</div>
            <p className="text-[9px] text-zinc-400 max-w-xs mx-auto">Your invoices will compile here.</p>
          </div>
        </div>
      </div>

      {/* Cancellation Confirmation Dialog */}
      <AnimatePresence>
        {cancelConfirmOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-6"
            >
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-rose-500/10 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5 text-rose-500" />
                </div>
                <div className="space-y-1">
                  <h6 className="font-extrabold text-base text-zinc-900 dark:text-white">Cancel Subscription?</h6>
                  <p className="text-xs text-zinc-500 leading-relaxed">
                    Are you sure you want to cancel your {currentPlanCatalog.identity.displayName} subscription? 
                  </p>
                </div>
              </div>

              <div className="p-4 bg-amber-500/5 border border-amber-500/10 rounded-2xl text-xs text-amber-600 dark:text-amber-400 flex items-start gap-2.5">
                <Info className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  You&apos;ll continue enjoying your benefits until your subscription expires on{' '}
                  <strong className="font-extrabold text-amber-700 dark:text-amber-300">
                    {profile?.subscription_expires_at ? new Date(profile.subscription_expires_at).toLocaleDateString() : 'expiry'}
                  </strong>.
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  onClick={() => setCancelConfirmOpen(false)}
                  disabled={isCancelling}
                  className="w-full py-2.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-xl text-xs font-bold transition-all"
                >
                  Keep Subscription
                </button>
                <button
                  onClick={handleCancelSubscription}
                  disabled={isCancelling}
                  className="w-full py-2.5 bg-rose-500 hover:bg-rose-600 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5"
                >
                  {isCancelling ? 'Processing...' : 'Confirm'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Choose Payment Method Modal */}
      <AnimatePresence>
        {paymentModalOpen && selectedPlanForUpgrade && (
          <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 10 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 10 }}
                className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl w-full max-w-lg p-6 shadow-2xl space-y-6 relative text-left my-8"
              >
              <button 
                onClick={() => setPaymentModalOpen(false)}
                className="absolute top-4 right-4 p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200" />
              </button>

              <div className="space-y-1.5 pr-8">
                <h3 className="text-xl font-black tracking-tight text-zinc-900 dark:text-white">
                  Choose Payment Method
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Select how you would like to complete your subscription.
                </p>
              </div>

              {/* Price context summary */}
              <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-150 dark:border-zinc-800 flex justify-between items-center text-xs font-bold">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-zinc-400 font-extrabold uppercase tracking-wider">Plan Summary</span>
                </div>
                <div className="text-zinc-800 dark:text-zinc-200 uppercase">
                  {selectedPlanForUpgrade} Plan — {getPlanPrice(selectedPlanForUpgrade as PlanId, region).currency === 'USD' ? '$' : '₦'}
                  {billingPeriod === 'month' 
                    ? getPlanPrice(selectedPlanForUpgrade as PlanId, region).price 
                    : Math.round(getPlanPrice(selectedPlanForUpgrade as PlanId, region).price * 10 * 0.8 / 10)
                  }/{billingPeriod === 'month' ? 'month' : 'year'}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {/* PayPal Card */}
                <div 
                  onClick={() => executeCheckout(selectedPlanForUpgrade, 'paypal')}
                  className="p-5 rounded-2xl border-2 border-zinc-200 dark:border-zinc-850 hover:border-[#19C37D] dark:hover:border-[#19C37D] bg-zinc-50/20 dark:bg-zinc-950 hover:bg-[#19C37D]/5 dark:hover:bg-[#19C37D]/5 cursor-pointer transition-all flex flex-col justify-between gap-4 group"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[#19C37D]/10 flex items-center justify-center group-hover:bg-[#19C37D]/20 transition-colors">
                        <CreditCard className="w-5 h-5 text-[#19C37D]" />
                      </div>
                      <div>
                        <h4 className="font-extrabold text-sm text-zinc-900 dark:text-white flex items-center gap-1.5">
                          PayPal
                          <span className="text-[10px] font-bold text-[#19C37D] px-1.5 py-0.5 bg-[#19C37D]/10 rounded">Popular</span>
                        </h4>
                        <p className="text-xs text-zinc-400 mt-0.5">Available Worldwide</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-black uppercase bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                      Available
                    </span>
                  </div>

                  {/* Payment Features List */}
                  <div className="space-y-2 text-xs text-zinc-600 dark:text-zinc-400 pl-1 py-1">
                    <div className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                      <span>Secure recurring payments</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                      <span>Cancel anytime from PayPal</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                      <span>Requires a PayPal account</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <button 
                      onClick={(e) => { e.stopPropagation(); executeCheckout(selectedPlanForUpgrade, 'paypal'); }}
                      className="w-full py-2.5 bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-zinc-900 rounded-xl text-xs font-extrabold uppercase tracking-wider transition-all flex items-center justify-center gap-2 group-hover:scale-[1.01]"
                    >
                      Continue with PayPal
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>
                    <p className="text-[10px] text-zinc-500 text-center leading-normal">
                      Requires a PayPal account for recurring subscriptions.
                    </p>
                  </div>
                </div>

                {/* Paystack Card */}
                <div 
                  onClick={() => {
                    toast.info("Paystack integration is coming soon. For now, you can subscribe securely using PayPal.");
                  }}
                  className="p-5 rounded-2xl border-2 border-dashed border-zinc-200 dark:border-zinc-850 bg-zinc-50/20 dark:bg-zinc-950 cursor-pointer opacity-80 hover:opacity-100 transition-all flex flex-col justify-between gap-4 group relative"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                        <CreditCard className="w-5 h-5 text-zinc-400" />
                      </div>
                      <div>
                        <h4 className="font-extrabold text-sm text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
                          Paystack
                          <span className="text-[10px] font-black bg-zinc-100 dark:bg-zinc-800 text-zinc-500 px-1.5 py-0.5 rounded uppercase">Soon</span>
                        </h4>
                        <p className="text-xs text-zinc-400 mt-0.5">African payment support coming soon.</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-black uppercase bg-amber-500/15 text-amber-600 dark:text-amber-400 px-2.5 py-0.5 rounded-full border border-amber-500/20">
                      Coming Soon
                    </span>
                  </div>
                  <button 
                    disabled
                    className="w-full py-2.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 rounded-xl text-xs font-extrabold uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-not-allowed"
                  >
                    Coming Soon
                  </button>
                </div>
              </div>

              <div className="text-[10px] text-zinc-400 text-center flex items-center justify-center gap-1.5">
                <Lock className="w-3 h-3" />
                <span>All transactions are secure and encrypted.</span>
              </div>
            </motion.div>
          </div>
        </div>
        )}
      </AnimatePresence>
    </div>
  );
};
