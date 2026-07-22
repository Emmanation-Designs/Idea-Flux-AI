import React from 'react';
import { 
  X, Check, ExternalLink, Lock, CreditCard, ArrowUpRight, 
  Sparkles, MessageSquare, Image, Layers, Brain, Code, Search, 
  LayoutGrid, Clock, FileText, Cpu, Shield 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { openExternalLink } from '../utils/nativeCompat';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { toast } from 'sonner';
import { getPlanPrice, PlanId } from '../subscription/catalog';

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
  const currentPlanId: PlanId = profile?.plan || 'free';

  // Format dynamic regional prices
  const currencySymbol = getPlanPrice('plus', region).currency === 'USD' ? '$' : '₦';

  const plusMonthly = getPlanPrice('plus', region).price;
  const plusPrice = billingPeriod === 'monthly' ? plusMonthly : Math.round(plusMonthly * 12 * 0.9);

  const proMonthly = getPlanPrice('pro', region).price;
  const proPrice = billingPeriod === 'monthly' ? proMonthly : Math.round(proMonthly * 12 * 0.9);

  const [isSubscribing, setIsSubscribing] = React.useState<string | null>(null);
  const [paymentModalOpen, setPaymentModalOpen] = React.useState(false);
  const [selectedPlanForUpgrade, setSelectedPlanForUpgrade] = React.useState<string | null>(null);

  const handleSubscribe = async (planId: string) => {
    if (!profile?.id) {
      toast.error('Please log in to subscribe');
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
          interval: billingPeriod === 'monthly' ? 'month' : 'year',
          userId: profile.id,
          region,
          provider
        })
      });

      const data = await response.json();
      if (data.url) {
        openExternalLink(data.url);
        setPaymentModalOpen(false);
        onClose();
      } else {
        throw new Error(data.error || 'Failed to create checkout session');
      }
    } catch (err: any) {
      console.error('[Checkout Error]:', err);
      toast.error(err.message || 'Subscription failed to start');
    } finally {
      setIsSubscribing(null);
    }
  };

  // Human-readable feature lists matching exact image style (no hard numbers for limits, simplified descriptors)
  const freeFeatures = [
    { text: "Thinking", icon: Sparkles },
    { text: "AI conversations", icon: MessageSquare },
    { text: "Image generation", icon: Image },
    { text: "Image editing", icon: Image },
    { text: "Vision & image analysis", icon: Brain },
    { text: "OCR text extraction", icon: FileText },
    { text: "Document AI", icon: FileText },
    { text: "PDF AI", icon: FileText },
    { text: "AI voice", icon: Cpu },
    { text: "Daily AI usage included", icon: Clock },
    { text: "Upgrade anytime for more intelligence", icon: Sparkles }
  ];

  const plusFeatures = [
    { text: "Everything in Free", icon: Check },
    { text: "Extended Thinking", icon: Sparkles },
    { text: "Higher daily AI usage", icon: MessageSquare },
    { text: "Faster request priority", icon: Clock },
    { text: "More voice generation", icon: Cpu },
    { text: "Better productivity for coding, writing and planning", icon: Code },
    { text: "Earlier access to new AI features", icon: Sparkles }
  ];

  const proFeatures = [
    { text: "Everything in Plus", icon: Check },
    { text: "Maximum Thinking", icon: Sparkles },
    { text: "Highest daily AI usage", icon: MessageSquare },
    { text: "Highest request priority", icon: Clock },
    { text: "Maximum voice generation", icon: Cpu },
    { text: "Best experience for software engineering", icon: Code },
    { text: "Research & complex reasoning", icon: Brain },
    { text: "Premium access to future AI capabilities", icon: Shield }
  ];

  const isFreeCurrent = currentPlanId === 'free';
  const isPlusCurrent = currentPlanId === 'plus';
  const isProCurrent = currentPlanId === 'pro';

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[100] bg-zinc-50 dark:bg-[#090A0C] text-zinc-900 dark:text-zinc-100 overflow-y-auto cursor-default transition-colors">
            <div className="min-h-screen flex flex-col items-center justify-start p-4 md:p-8 md:py-16 relative">
              
              {/* Back / Close button */}
              <button 
                onClick={onClose}
                className="absolute top-4 left-4 md:top-8 md:left-8 p-2.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white rounded-full transition-all active:scale-95 z-[110] shadow-xs cursor-pointer"
                title="Go Back"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Title Section */}
              <div className="text-center mt-12 md:mt-4 mb-10 space-y-4">
                <h1 className="text-3xl md:text-5xl font-black tracking-tight text-zinc-900 dark:text-white">
                  Upgrade your plan
                </h1>
                
                {/* Pill Toggle matching app design system */}
                <div className="flex p-1 bg-zinc-100/80 dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-full w-fit mx-auto shadow-inner">
                  <button
                    onClick={() => setBillingPeriod('monthly')}
                    className={cn(
                      "px-6 py-2 rounded-full text-xs font-bold transition-all whitespace-nowrap uppercase tracking-wider cursor-pointer",
                      billingPeriod === 'monthly' ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-xs" : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
                    )}
                  >
                    Personal
                  </button>
                  <button
                    onClick={() => setBillingPeriod('yearly')}
                    className={cn(
                      "px-6 py-2 rounded-full text-xs font-bold transition-all whitespace-nowrap uppercase tracking-wider flex items-center gap-1.5 cursor-pointer",
                      billingPeriod === 'yearly' ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-xs" : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
                    )}
                  >
                    Yearly
                    <span className="px-1.5 py-0.5 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[8px] rounded uppercase font-black tracking-widest">-10%</span>
                  </button>
                </div>
              </div>

              {/* 3 Column Grid for Free, Plus, Pro */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-6xl px-2 md:px-6">
                
                {/* Free Plan Card */}
                <div className="bg-white dark:bg-zinc-900/80 border border-zinc-200/90 dark:border-zinc-800/80 rounded-3xl p-6 md:p-8 flex flex-col justify-between min-h-[580px] shadow-sm relative overflow-hidden">
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <h3 className="text-2xl font-extrabold text-zinc-900 dark:text-white">Free</h3>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">Everything you need to get started with AI.</p>
                    </div>

                    <div className="flex items-baseline gap-0.5 py-2">
                      <span className="text-zinc-400 dark:text-zinc-500 text-2xl font-bold self-start mt-1">{currencySymbol}</span>
                      <span className="text-5xl md:text-6xl font-black text-zinc-900 dark:text-white tracking-tight">0</span>
                      <span className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 ml-1">{billingPeriod === 'monthly' ? '/ month' : '/ year'}</span>
                    </div>

                    <button 
                      disabled={isFreeCurrent}
                      className={cn(
                        "w-full py-3 px-6 rounded-full font-bold text-xs uppercase tracking-widest transition-all text-center border",
                        isFreeCurrent 
                          ? "bg-zinc-100 dark:bg-zinc-800/60 border-zinc-200 dark:border-zinc-800 text-zinc-400 dark:text-zinc-500 cursor-not-allowed" 
                          : "bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 cursor-pointer active:scale-95"
                      )}
                    >
                      {isFreeCurrent ? "Your current plan" : "Select Free"}
                    </button>

                    <hr className="border-zinc-200/80 dark:border-zinc-800/80" />

                    <div className="space-y-3.5">
                      {freeFeatures.map((feat, i) => {
                        const Icon = feat.icon;
                        return (
                          <div key={i} className="flex items-start gap-3 text-xs text-zinc-700 dark:text-zinc-300 font-medium">
                            <Icon className="w-4 h-4 text-zinc-400 dark:text-zinc-500 shrink-0 mt-0.5" />
                            <span>{feat.text}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Plus Plan Card (Highlighted / Accent) */}
                <div className="bg-gradient-to-b from-emerald-500/10 via-emerald-500/5 to-white dark:from-emerald-500/10 dark:via-zinc-900/90 dark:to-zinc-900/90 border-2 border-emerald-500 rounded-3xl p-6 md:p-8 flex flex-col justify-between min-h-[580px] shadow-xl shadow-emerald-500/10 relative overflow-hidden">
                  
                  {/* Popular Badge */}
                  <div className="absolute top-6 right-6">
                    <span className="px-2.5 py-1 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-[10px] font-black uppercase tracking-widest rounded-md border border-emerald-500/30">
                      Popular
                    </span>
                  </div>

                  <div className="space-y-6">
                    <div className="space-y-2">
                      <h3 className="text-2xl font-extrabold text-zinc-900 dark:text-white">Plus</h3>
                      <p className="text-xs text-zinc-600 dark:text-zinc-400">For creators, students and professionals who need more AI every day.</p>
                    </div>

                    <div className="py-2">
                      <div className="flex items-baseline gap-0.5">
                        <span className="text-emerald-600 dark:text-emerald-400 text-2xl font-bold self-start mt-1">{currencySymbol}</span>
                        <span className="text-5xl md:text-6xl font-black text-zinc-900 dark:text-white tracking-tight">{plusPrice}</span>
                        <span className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 ml-1">{billingPeriod === 'monthly' ? '/ month' : '/ year'}</span>
                      </div>
                      <div className="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mt-1.5 font-bold">
                        {billingPeriod === 'yearly' ? "Billed annually" : "Billed monthly"}
                      </div>
                    </div>

                    <button 
                      onClick={() => !isPlusCurrent && handleSubscribe('plus')}
                      disabled={isSubscribing !== null}
                      className={cn(
                        "w-full py-3 px-6 rounded-full font-bold text-xs uppercase tracking-widest transition-all text-center shadow-md",
                        isPlusCurrent 
                          ? "bg-zinc-100 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-800 text-zinc-400 dark:text-zinc-500 cursor-not-allowed" 
                          : "bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer active:scale-95 shadow-emerald-500/20"
                      )}
                    >
                      {isPlusCurrent ? "Your current plan" : (isSubscribing === 'plus' ? "Connecting..." : "Upgrade to Plus")}
                    </button>

                    <hr className="border-emerald-500/20 dark:border-emerald-500/20" />

                    <div className="space-y-3.5">
                      {plusFeatures.map((feat, i) => {
                        const Icon = feat.icon;
                        return (
                          <div key={i} className="flex items-start gap-3 text-xs text-zinc-800 dark:text-zinc-200 font-semibold">
                            <Icon className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                            <span>{feat.text}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Pro Plan Card */}
                <div className="bg-white dark:bg-zinc-900/80 border border-zinc-200/90 dark:border-zinc-800/80 hover:border-emerald-500/40 rounded-3xl p-6 md:p-8 flex flex-col justify-between min-h-[580px] shadow-sm relative overflow-hidden transition-all">
                  
                  {/* Pro Badge */}
                  <div className="absolute top-6 right-6">
                    <span className="px-2.5 py-1 bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 text-[10px] font-black uppercase tracking-widest rounded-md border border-zinc-200 dark:border-zinc-700">
                      Best Value
                    </span>
                  </div>

                  <div className="space-y-6">
                    <div className="space-y-2">
                      <h3 className="text-2xl font-extrabold text-zinc-900 dark:text-white">Pro</h3>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">Maximum intelligence for demanding work and advanced AI workflows.</p>
                    </div>

                    <div className="py-2">
                      <div className="flex items-baseline gap-0.5">
                        <span className="text-emerald-600 dark:text-emerald-400 text-2xl font-bold self-start mt-1">{currencySymbol}</span>
                        <span className="text-5xl md:text-6xl font-black text-zinc-900 dark:text-white tracking-tight">{proPrice}</span>
                        <span className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 ml-1">{billingPeriod === 'monthly' ? '/ month' : '/ year'}</span>
                      </div>
                      <div className="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mt-1.5 font-bold">
                        {billingPeriod === 'yearly' ? "Billed annually" : "Billed monthly"}
                      </div>
                    </div>

                    <button 
                      onClick={() => !isProCurrent && handleSubscribe('pro')}
                      disabled={isSubscribing !== null}
                      className={cn(
                        "w-full py-3 px-6 rounded-full font-bold text-xs uppercase tracking-widest transition-all text-center shadow-md",
                        isProCurrent 
                          ? "bg-zinc-100 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-800 text-zinc-400 dark:text-zinc-500 cursor-not-allowed" 
                          : "bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-zinc-900 cursor-pointer active:scale-95"
                      )}
                    >
                      {isProCurrent ? "Your current plan" : (isSubscribing === 'pro' ? "Connecting..." : "Upgrade to Pro")}
                    </button>

                    <hr className="border-zinc-200/80 dark:border-zinc-800/80" />

                    <div className="space-y-3.5">
                      {proFeatures.map((feat, i) => {
                        const Icon = feat.icon;
                        return (
                          <div key={i} className="flex items-start gap-3 text-xs text-zinc-700 dark:text-zinc-300 font-medium">
                            <Icon className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                            <span>{feat.text}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

              </div>

              {/* Ad Section if triggered by usage block */}
              {reason === 'usage' && (
                <div className="mt-12 w-full max-w-4xl p-6 bg-white dark:bg-zinc-900/60 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-3xl text-center space-y-3">
                  <div className="text-zinc-400 dark:text-zinc-500 font-bold text-xs uppercase tracking-widest">
                    Rewarded Ads
                  </div>
                  <button 
                    disabled
                    className="px-6 py-3 bg-zinc-100 dark:bg-zinc-800/50 text-zinc-400 dark:text-zinc-500 border border-zinc-200 dark:border-zinc-800 rounded-full font-extrabold text-xs uppercase tracking-widest cursor-not-allowed flex items-center justify-center gap-2 mx-auto"
                  >
                    Coming Soon
                  </button>
                  <p className="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">
                    Ad-supported credits are coming soon. Upgrade to immediately bypass all limits.
                  </p>
                </div>
              )}

              {/* Secure transaction lock statement */}
              <div className="mt-16 text-zinc-500 dark:text-zinc-400 text-xs flex items-center gap-1.5 justify-center">
                <Lock className="w-3.5 h-3.5 text-emerald-500" />
                <span>All transactions are secure, encrypted and PCI-compliant.</span>
              </div>

            </div>
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
                className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl w-full max-w-lg p-6 shadow-2xl space-y-6 relative text-left text-zinc-900 dark:text-white my-8"
              >
              <button 
                onClick={() => setPaymentModalOpen(false)}
                className="absolute top-4 right-4 p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors cursor-pointer"
                title="Close"
              >
                <X className="w-5 h-5 text-zinc-400 hover:text-zinc-700 dark:hover:text-white" />
              </button>

              <div className="space-y-1.5 pr-8">
                <h3 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white">
                  Choose Payment Method
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Select how you would like to complete your subscription.
                </p>
              </div>

              {/* Price context summary */}
              <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 flex justify-between items-center text-xs font-bold">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Plan Summary</span>
                </div>
                <div className="text-zinc-800 dark:text-zinc-200 uppercase">
                  {selectedPlanForUpgrade} Plan — {getPlanPrice(selectedPlanForUpgrade as PlanId, region).currency === 'USD' ? '$' : '₦'}
                  {selectedPlanForUpgrade === 'plus' ? plusPrice : proPrice}/{billingPeriod === 'monthly' ? 'month' : 'year'}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {/* PayPal Card */}
                <div 
                  onClick={() => executeCheckout(selectedPlanForUpgrade, 'paypal')}
                  className="p-5 rounded-2xl border-2 border-zinc-200 dark:border-zinc-800 hover:border-emerald-500 dark:hover:border-emerald-500 bg-zinc-50/50 dark:bg-zinc-950/40 hover:bg-emerald-500/5 cursor-pointer transition-all flex flex-col justify-between gap-4 group"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center group-hover:bg-emerald-500/20 transition-colors">
                        <CreditCard className="w-5 h-5 text-emerald-500" />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-zinc-900 dark:text-white flex items-center gap-1.5">
                          PayPal
                          <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 bg-emerald-500/10 rounded">Popular</span>
                        </h4>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">Available Worldwide</p>
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
                      className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 group-hover:scale-[1.01] shadow-md shadow-emerald-500/10 cursor-pointer"
                    >
                      Continue with PayPal
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>
                    <p className="text-[10px] text-zinc-400 dark:text-zinc-500 text-center leading-normal">
                      Requires a PayPal account for recurring subscriptions.
                    </p>
                  </div>
                </div>

                {/* Paystack Card */}
                <div 
                  onClick={() => {
                    toast.info("Paystack integration is coming soon. For now, you can subscribe securely using PayPal.");
                  }}
                  className="p-5 rounded-2xl border-2 border-dashed border-zinc-200 dark:border-zinc-800 bg-zinc-50/20 dark:bg-zinc-950/20 cursor-pointer opacity-80 hover:opacity-100 transition-all flex flex-col justify-between gap-4 group relative"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                        <CreditCard className="w-5 h-5 text-zinc-400 dark:text-zinc-500" />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
                          Paystack
                          <span className="text-[10px] font-black bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 px-1.5 py-0.5 rounded uppercase">Soon</span>
                        </h4>
                        <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">African payment support coming soon.</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-black uppercase bg-amber-500/15 text-amber-600 dark:text-amber-400 px-2.5 py-0.5 rounded-full border border-amber-500/20">
                      Coming Soon
                    </span>
                  </div>
                  <button 
                    disabled
                    className="w-full py-2.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-not-allowed"
                  >
                    Coming Soon
                  </button>
                </div>
              </div>

              <div className="text-[10px] text-zinc-400 dark:text-zinc-500 text-center flex items-center justify-center gap-1.5">
                <Lock className="w-3 h-3 text-emerald-500" />
                <span>All transactions are secure and encrypted.</span>
              </div>
            </motion.div>
          </div>
        </div>
        )}
      </AnimatePresence>
    </>
  );
};
