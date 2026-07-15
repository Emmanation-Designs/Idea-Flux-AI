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
  Play
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
}

export const BillingCenter: React.FC<BillingCenterProps> = ({
  profile,
  onUpdateProfile,
  onClose
}) => {
  const [billingPeriod, setBillingPeriod] = useState<'month' | 'year'>('month');
  const [isSubscribing, setIsSubscribing] = useState<string | null>(null);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isResuming, setIsResuming] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Detailed usage state
  const [detailedUsage, setDetailedUsage] = useState<any | null>(null);
  const [isLoadingUsage, setIsLoadingUsage] = useState(true);

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
  const getProgressStatus = (used: number, limit: number) => {
    if (limit === 0 || isNaN(limit)) return { label: 'Available', color: 'text-emerald-500', barColor: 'bg-emerald-500' };
    const ratio = used / limit;
    if (ratio <= 0.6) {
      return { label: 'Available', color: 'text-emerald-500', barColor: 'bg-emerald-500' };
    } else if (ratio <= 0.85) {
      return { label: 'High Usage', color: 'text-amber-500', barColor: 'bg-amber-500' };
    } else if (ratio < 1.0) {
      return { label: 'Near Limit', color: 'text-orange-500', barColor: 'bg-orange-500' };
    } else {
      return { label: 'Limit Reached', color: 'text-rose-500', barColor: 'bg-rose-500' };
    }
  };

  // Pre-calculate usage progress lists safely
  const usageCards = [];
  if (detailedUsage?.usage && detailedUsage?.limits) {
    const u = detailedUsage.usage;
    const l = detailedUsage.limits;

    usageCards.push({
      title: 'Chat Messages',
      status: getProgressStatus(u.chat_today || 0, l.chat_limit || 999999999),
      used: u.chat_today || 0,
      limit: l.chat_limit,
      isUnlimited: l.chat_limit >= 999999999
    });
    usageCards.push({
      title: 'Voice Characters',
      status: getProgressStatus(u.tts_characters_used_monthly || 0, l.tts_monthly_limit || 0),
      used: u.tts_characters_used_monthly || 0,
      limit: l.tts_monthly_limit,
      isUnlimited: false
    });
    usageCards.push({
      title: 'Image Generations',
      status: getProgressStatus((u.image_generation_today || 0) + (u.image_edit_today || 0), l.image_generation_limit || 0),
      used: (u.image_generation_today || 0) + (u.image_edit_today || 0),
      limit: l.image_generation_limit,
      isUnlimited: false
    });
    usageCards.push({
      title: 'OCR Operations',
      status: getProgressStatus(u.ocr_today || 0, l.ocr_limit || 0),
      used: u.ocr_today || 0,
      limit: l.ocr_limit,
      isUnlimited: false
    });
    usageCards.push({
      title: 'Documents Processed',
      status: getProgressStatus(u.document_ai_today || 0, l.document_ai_limit || 0),
      used: u.document_ai_today || 0,
      limit: l.document_ai_limit,
      isUnlimited: false
    });
    usageCards.push({
      title: 'PDF Extractions',
      status: getProgressStatus(u.pdf_today || 0, l.pdf_limit || 0),
      used: u.pdf_today || 0,
      limit: l.pdf_limit,
      isUnlimited: false
    });
  }

  return (
    <div className="space-y-10 py-2">
      {/* Top Banner / Hero with sync - STEP 1 */}
      <div className="p-6 md:p-8 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-48 h-48 rounded-full bg-emerald-500/5 blur-3xl" />
        
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center shrink-0">
            <Zap className="w-6 h-6 text-emerald-500" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-bold text-zinc-400 uppercase tracking-widest">Active Level</span>
              <span className={cn("px-2.5 py-0.5 text-[9px] font-black rounded-md tracking-wider border", statusObj.classes)}>
                {statusObj.text}
              </span>
            </div>
            {/* Catalog dynamic name - STEP 2 */}
            <h4 className="text-2xl font-black tracking-tight mt-1">
              {currentPlanCatalog.identity.displayName} Tier
            </h4>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
              {currentPlanCatalog.identity.description}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleSync}
            disabled={isRefreshing}
            className="px-4 py-2 bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-xl text-xs font-bold transition-all flex items-center gap-2 active:scale-95 disabled:opacity-50"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", isRefreshing && "animate-spin")} />
            Sync Status
          </button>
        </div>
      </div>

      {/* Subscription SaaS Metadata Grid - STEP 1 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-white dark:bg-zinc-950 rounded-2xl border border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-2 text-[10px] text-zinc-400 font-bold uppercase tracking-wider mb-1">
            <CreditCard className="w-3.5 h-3.5 text-zinc-400" />
            Billing Provider
          </div>
          <div className="text-sm font-extrabold text-zinc-900 dark:text-zinc-100 capitalize">
            {profile?.subscription_provider || 'System Free'}
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-zinc-950 rounded-2xl border border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-2 text-[10px] text-zinc-400 font-bold uppercase tracking-wider mb-1">
            <Globe className="w-3.5 h-3.5 text-zinc-400" />
            Country
          </div>
          <div className="text-sm font-extrabold text-zinc-900 dark:text-zinc-100 uppercase">
            {profile?.billing_country || profile?.country_code || (region === 'nigeria' ? 'NG' : 'US')}
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-zinc-950 rounded-2xl border border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-2 text-[10px] text-zinc-400 font-bold uppercase tracking-wider mb-1">
            <DollarSign className="w-3.5 h-3.5 text-zinc-400" />
            Currency
          </div>
          <div className="text-sm font-extrabold text-zinc-900 dark:text-zinc-100 uppercase">
            {profile?.billing_currency || (region === 'nigeria' ? 'NGN' : 'USD')}
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-zinc-950 rounded-2xl border border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-2 text-[10px] text-zinc-400 font-bold uppercase tracking-wider mb-1">
            <Calendar className="w-3.5 h-3.5 text-zinc-400" />
            Renewal / End
          </div>
          <div className="text-sm font-extrabold text-zinc-900 dark:text-zinc-100">
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

      {/* Expanded Subscription details panel - STEP 1 */}
      {(profile?.subscription_start || profile?.subscription_end) && (
        <div className="p-4 bg-zinc-50/50 dark:bg-zinc-900/50 border border-zinc-100 dark:border-zinc-800/80 rounded-2xl grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-zinc-500">
          {profile?.subscription_start && (
            <div className="flex justify-between items-center px-2">
              <span>Subscription Started:</span>
              <span className="font-bold text-zinc-800 dark:text-zinc-200">
                {new Date(profile.subscription_start).toLocaleString()}
              </span>
            </div>
          )}
          {profile?.subscription_end && (
            <div className="flex justify-between items-center px-2">
              <span>Subscription Ends:</span>
              <span className="font-bold text-zinc-800 dark:text-zinc-200">
                {new Date(profile.subscription_end).toLocaleString()}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Available Plans and Upgrades Section (Catalog Driven - STEP 2, 3, 12) */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="space-y-1">
            <h5 className="font-bold text-lg">Subscription Plans & Management</h5>
            <p className="text-xs text-zinc-500">Explore dynamic tiers in the catalog. Actions are calculated automatically.</p>
          </div>

          {/* Monthly / Yearly period selector */}
          <div className="flex p-1 bg-zinc-100 dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shrink-0">
            <button 
              onClick={() => setBillingPeriod('month')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                billingPeriod === 'month' ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-sm" : "text-zinc-500"
              )}
            >
              Monthly
            </button>
            <button 
              onClick={() => setBillingPeriod('year')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5",
                billingPeriod === 'year' ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-sm" : "text-zinc-500"
              )}
            >
              Yearly
              <span className="px-1.5 py-0.5 bg-emerald-500 text-white text-[8px] rounded uppercase font-black">Save</span>
            </button>
          </div>
        </div>

        {/* Dynamic Catalog Cards - STEP 2, 3, 12 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {Object.entries(SUBSCRIPTION_CATALOG)
            .filter(([id]) => id !== 'free') // Only show paid upgrade options here
            .map(([id, entry]) => {
              const pricing = getPlanPrice(id as PlanId, region);
              const price = billingPeriod === 'month' ? pricing.price : Math.round(pricing.price * 10 * 0.8 / 10); // standard 20% savings representation if needed or literal price
              const isCurrent = currentPlanId === id;
              const isCancelled = profile?.subscription_status === 'CANCELLED' || profile?.subscription_status === 'cancelled';
              const isExpired = profile?.subscription_status === 'EXPIRED' || profile?.subscription_status === 'expired';

              return (
                <div 
                  key={id} 
                  className={cn(
                    "p-6 rounded-3xl border flex flex-col justify-between transition-all duration-300 hover:shadow-lg relative overflow-hidden",
                    isCurrent 
                      ? "bg-emerald-500/[0.02] border-emerald-500/20 dark:border-emerald-500/10 shadow-md" 
                      : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800"
                  )}
                >
                  {isCurrent && (
                    <div className="absolute top-0 right-0 px-3 py-1 bg-emerald-500 text-white text-[8px] font-black uppercase tracking-widest rounded-bl-xl">
                      Current Plan
                    </div>
                  )}

                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <h6 className="font-extrabold text-lg text-zinc-900 dark:text-white capitalize">
                        {entry.identity.displayName}
                      </h6>
                      <span className="px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 text-[8px] font-black uppercase rounded-full">
                        {entry.identity.badge}
                      </span>
                    </div>

                    <div className="flex items-baseline gap-1.5">
                      <span className="text-3xl font-black tracking-tighter text-zinc-900 dark:text-white">
                        {pricing.currency === 'USD' ? '$' : '₦'}{price}
                      </span>
                      <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">
                        /{billingPeriod === 'month' ? 'mo' : 'yr'}
                      </span>
                    </div>

                    <p className="text-xs text-zinc-500 leading-relaxed">
                      {entry.identity.description}
                    </p>

                    <hr className="border-zinc-100 dark:border-zinc-800/80" />

                    <div className="space-y-2">
                      <div className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Features included:</div>
                      <div className="grid grid-cols-1 gap-2">
                        {entry.marketing?.headline && (
                          <div className="flex items-center gap-2 text-xs font-bold text-zinc-700 dark:text-zinc-300">
                            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                            {entry.marketing.headline}
                          </div>
                        )}
                        <div className="flex items-center gap-2 text-xs text-zinc-500">
                          <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                          Unlimited chatbot assistance
                        </div>
                        <div className="flex items-center gap-2 text-xs text-zinc-500">
                          <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                          {entry.limits.image_generation} image generation daily limit
                        </div>
                        <div className="flex items-center gap-2 text-xs text-zinc-500">
                          <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                          {entry.limits.tts / 1000}k monthly TTS character limit
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 pt-4">
                    {/* STEP 3 Actions logic */}
                    {isCurrent ? (
                      isCancelled ? (
                        <button 
                          onClick={handleResumeSubscription}
                          disabled={isResuming}
                          className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-extrabold uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-md active:scale-95 disabled:opacity-50"
                        >
                          <Play className="w-3.5 h-3.5" />
                          {isResuming ? 'Resuming...' : 'Resume Subscription'}
                        </button>
                      ) : (
                        <div className="space-y-2">
                          <div className="w-full py-3 bg-zinc-100 dark:bg-zinc-800/50 text-zinc-500 dark:text-zinc-400 rounded-xl text-xs font-extrabold uppercase tracking-widest text-center border border-zinc-200 dark:border-zinc-800">
                            ✓ Your Current Plan
                          </div>
                          
                          {/* Upgrade from Plus to Pro logic - STEP 3 */}
                          {id === 'plus' && currentPlanId === 'plus' && (
                            <button
                              onClick={() => handleUpgrade('pro')}
                              disabled={isSubscribing !== null}
                              className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-xl text-xs font-extrabold uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-md active:scale-95"
                            >
                              Upgrade to Pro
                              <ArrowUpRight className="w-3.5 h-3.5" />
                            </button>
                          )}

                          <button 
                            onClick={() => setCancelConfirmOpen(true)}
                            className="w-full py-2.5 bg-transparent hover:bg-rose-500/5 text-rose-500 dark:text-rose-400 hover:text-rose-600 dark:hover:text-rose-300 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 border border-transparent hover:border-rose-500/20"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Cancel Subscription
                          </button>
                        </div>
                      )
                    ) : (
                      // Unsubscribed / Upgrading buttons - STEP 3 & STEP 7 (calls generic /api/payment/checkout)
                      <button 
                        onClick={() => handleUpgrade(id)}
                        disabled={isSubscribing !== null}
                        className={cn(
                          "w-full py-3 text-xs font-extrabold uppercase tracking-widest transition-all flex items-center justify-center gap-2 rounded-xl active:scale-95 disabled:opacity-50",
                          id === 'pro' 
                            ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-850 dark:hover:bg-zinc-200 shadow-lg" 
                            : "bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-750"
                        )}
                      >
                        {isSubscribing === id ? 'Connecting...' : (isExpired ? 'Upgrade Again' : `Upgrade to ${entry.identity.displayName}`)}
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* Usage Summary progression cards - STEP 10 */}
      <div className="space-y-4">
        <div className="space-y-1">
          <h5 className="font-bold text-lg">SaaS Usage Analyzer</h5>
          <p className="text-xs text-zinc-500">Live indicators of your current billing limits mapped cleanly to service levels.</p>
        </div>

        {isLoadingUsage ? (
          <div className="p-12 text-center border border-zinc-200 dark:border-zinc-800 rounded-3xl bg-zinc-50/50 dark:bg-zinc-900/50 flex flex-col items-center gap-3">
            <RefreshCw className="w-6 h-6 text-zinc-400 animate-spin" />
            <div className="text-xs font-bold text-zinc-500">Reading real-time usage registers...</div>
          </div>
        ) : usageCards.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {usageCards.map((card, idx) => (
              <div 
                key={idx}
                className="p-4 bg-white dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-850 rounded-2xl flex flex-col justify-between h-32 hover:border-zinc-200 dark:hover:border-zinc-800 transition-all shadow-sm"
              >
                <div className="flex items-start justify-between">
                  <div className="text-xs font-extrabold text-zinc-800 dark:text-zinc-200">
                    {card.title}
                  </div>
                  <span className={cn("text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border border-current", card.status.color, "bg-current/5")}>
                    {card.status.label}
                  </span>
                </div>

                <div className="space-y-2">
                  <div className="w-full bg-zinc-100 dark:bg-zinc-900 h-1.5 rounded-full overflow-hidden">
                    <div 
                      className={cn("h-full rounded-full transition-all duration-500", card.status.barColor)}
                      style={{ 
                        width: card.isUnlimited 
                          ? '10%' 
                          : `${Math.min(100, card.limit > 0 ? (card.used / card.limit) * 100 : 0)}%` 
                      }} 
                    />
                  </div>
                  <div className="flex justify-between items-center text-[10px] text-zinc-400 font-bold uppercase tracking-wider">
                    <span>Usage Status</span>
                    <span>
                      {card.isUnlimited ? 'Unlimited Active' : 'SaaS Monitored'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-6 text-center border border-dashed border-zinc-200 dark:border-zinc-800 rounded-3xl text-xs text-zinc-500">
            No active usage statistics. Use the application capabilities to populate logs.
          </div>
        )}
      </div>

      {/* Payment Method provider cards - STEP 5 */}
      <div className="space-y-4">
        <div className="space-y-1">
          <h5 className="font-bold text-lg">Connected Payment Channels</h5>
          <p className="text-xs text-zinc-500">Enable and configure authorized credit and gateway services.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {PROVIDERS_CONFIG.map((prov) => {
            const isConnected = prov.status === 'connected';
            return (
              <div 
                key={prov.id}
                className={cn(
                  "p-4 rounded-2xl border flex items-center justify-between transition-all",
                  isConnected 
                    ? "bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800" 
                    : "bg-zinc-50/50 dark:bg-zinc-900/10 border-zinc-100 dark:border-zinc-850 opacity-60"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-9 h-9 rounded-xl flex items-center justify-center shrink-0",
                    isConnected ? "bg-emerald-500/10" : "bg-zinc-100 dark:bg-zinc-800"
                  )}>
                    <CreditCard className={cn("w-4 h-4", isConnected ? "text-emerald-500" : "text-zinc-400")} />
                  </div>
                  <div>
                    <h6 className="font-bold text-xs text-zinc-800 dark:text-zinc-200">{prov.name}</h6>
                    <p className="text-[10px] text-zinc-400 leading-none mt-1">{prov.description}</p>
                  </div>
                </div>

                <span className={cn(
                  "px-2 py-0.5 text-[8px] font-black uppercase rounded tracking-wider",
                  isConnected 
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" 
                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400"
                )}>
                  {prov.badge}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Billing History container - STEP 4 */}
      <div className="space-y-4">
        <div className="space-y-1">
          <h5 className="font-bold text-lg">Billing & Invoice Ledger</h5>
          <p className="text-xs text-zinc-500">Historical transaction database and receipt storage portal.</p>
        </div>

        <div className="p-8 border border-zinc-200 dark:border-zinc-850 rounded-2xl bg-white dark:bg-zinc-950 text-center flex flex-col items-center justify-center gap-3 shadow-sm">
          <div className="w-10 h-10 rounded-full bg-zinc-50 dark:bg-zinc-900 flex items-center justify-center border border-zinc-100 dark:border-zinc-800">
            <FileText className="w-5 h-5 text-zinc-400" />
          </div>
          <div className="space-y-1">
            <div className="text-xs font-bold text-zinc-700 dark:text-zinc-300">No billing history yet.</div>
            <p className="text-[10px] text-zinc-400 max-w-xs mx-auto">Future transaction statements and tax invoices will compile directly in this portal.</p>
          </div>
        </div>
      </div>

      {/* Cancellation Confirmation Dialog - STEP 8 */}
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

              {/* Informative message (STEP 8 mandate) */}
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
    </div>
  );
};
