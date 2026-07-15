import React from 'react';
import { Zap, X, Check, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { openExternalLink } from '../utils/nativeCompat';
import { TrelvixLogo } from './TrelvixLogo';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { toast } from 'sonner';
import { getPlan, getPlanPrice, getPlanLimits, PlanId } from '../subscription/catalog';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  reason?: 'usage' | 'images' | 'manual';
  profile?: any;
}

export const UpgradeModal: React.FC<UpgradeModalProps> = ({ isOpen, onClose, reason = 'manual', profile }) => {
  const [billingPeriod, setBillingPeriod] = React.useState<'monthly' | 'yearly'>('monthly');

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

  const [isSubscribing, setIsSubscribing] = React.useState<string | null>(null);

  const handleSubscribe = async (planId: string) => {
    if (!profile?.id) {
      toast.error('Please log in to subscribe');
      return;
    }
    
    setIsSubscribing(planId);
    try {
      const response = await fetch('/api/payment/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan: planId,
          interval: billingPeriod === 'monthly' ? 'month' : 'year',
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
      toast.error(err.message || 'Subscription failed to start');
      setIsSubscribing(null);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div 
          onClick={onClose}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md overflow-y-auto cursor-pointer"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[2.5rem] w-full max-w-2xl p-8 md:p-12 shadow-2xl relative overflow-hidden my-8 cursor-default"
          >
            <button 
              onClick={onClose}
              className="absolute top-6 right-6 p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors z-10"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex flex-col items-center text-center relative z-10">
              <div className="w-16 h-16 bg-zinc-950 rounded-2xl flex items-center justify-center mb-6 shadow-xl border border-zinc-800 p-2">
                <TrelvixLogo className="w-8 h-8" glow={true} />
              </div>

              {reason !== 'manual' && (
                <div className="mb-4 px-4 py-1.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs font-black rounded-full uppercase tracking-widest">
                  Limit Reached
                </div>
              )}

              <h2 className="text-3xl font-black mb-2">Upgrade to Premium</h2>
              <p className="text-zinc-500 dark:text-zinc-400 text-sm mb-8 max-w-sm mx-auto">
                Unlock the full power of Trelvix AI and remove all daily limitations.
              </p>

              {/* Billing Toggle */}
              <div className="flex p-1 bg-zinc-100 dark:bg-zinc-800 rounded-2xl mb-10 w-fit mx-auto">
                <button 
                  onClick={() => setBillingPeriod('monthly')}
                  className={cn(
                    "px-6 py-2 rounded-xl text-xs font-black transition-all uppercase tracking-widest",
                    billingPeriod === 'monthly' ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm" : "text-zinc-500"
                  )}
                >
                  Monthly
                </button>
                <button 
                  onClick={() => setBillingPeriod('yearly')}
                  className={cn(
                    "px-6 py-2 rounded-xl text-xs font-black transition-all uppercase tracking-widest flex items-center gap-2",
                    billingPeriod === 'yearly' ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm" : "text-zinc-500"
                  )}
                >
                  Yearly
                  <span className="px-1.5 py-0.5 bg-emerald-500 text-white text-[8px] rounded-md">-15%</span>
                </button>
              </div>

              <div className="grid md:grid-cols-2 gap-6 w-full">
                {Object.entries(plans).map(([id, plan]) => (
                  <div 
                    key={id}
                    className={cn(
                      "p-8 rounded-[2rem] border-2 transition-all flex flex-col text-left group hover:scale-[1.02]",
                      id === 'pro' 
                        ? "border-amber-500 bg-amber-50/30 dark:bg-amber-900/10" 
                        : "border-zinc-200 dark:border-zinc-800 bg-zinc-50/30 dark:bg-zinc-800/20"
                    )}
                  >
                    <div className="mb-6">
                      <h3 className="text-xl font-black mb-1">{plan.name}</h3>
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-black">${billingPeriod === 'monthly' ? plan.monthly : plan.yearly}</span>
                        <span className="text-xs font-bold opacity-40 uppercase tracking-widest">/{billingPeriod === 'monthly' ? 'mo' : 'yr'}</span>
                      </div>
                    </div>

                    <ul className="space-y-3 mb-8 flex-1">
                      {plan.features.map((feature, i) => (
                        <li key={i} className="flex items-start gap-3 text-sm font-medium">
                          <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>

                    <button 
                      onClick={() => handleSubscribe(id)}
                      disabled={isSubscribing !== null}
                      className={cn(
                        "w-full py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 shadow-xl disabled:opacity-50",
                        id === 'pro' 
                          ? "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 shadow-zinc-900/20 dark:shadow-white/10" 
                          : "bg-white dark:bg-zinc-800 border-2 border-zinc-900 dark:border-white text-zinc-900 dark:text-white"
                      )}
                    >
                      {isSubscribing === id ? 'Connecting...' : plan.marketing.buttonText}
                    </button>
                  </div>
                ))}
              </div>

              {reason === 'usage' && (
                <div className="mt-8 w-full">
                  <button 
                    onClick={() => toast.error('Ad integration coming soon. Upgrade to Pro or Plus for higher limits.')}
                    className="w-full py-4 bg-emerald-50 dark:bg-emerald-950/20 border-2 border-emerald-500 border-dashed rounded-3xl text-emerald-600 dark:text-emerald-400 font-black text-sm uppercase tracking-widest hover:bg-emerald-100 transition-all flex items-center justify-center gap-3"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Watch Short Ad to Continue
                  </button>
                  <p className="mt-4 text-[10px] text-zinc-400 font-bold uppercase tracking-widest leading-relaxed">
                    Ads are being verified. For now, please upgrade to bypass all limits.
                  </p>
                </div>
              )}

              <button 
                onClick={onClose}
                className="mt-8 text-xs font-black uppercase tracking-widest text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
              >
                Maybe later
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
