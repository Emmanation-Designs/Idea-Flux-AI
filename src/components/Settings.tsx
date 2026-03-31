import { 
  Settings as SettingsIcon, 
  X, 
  ExternalLink, 
  ChevronRight
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
                profile?.plan === 'pro' ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400" : "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400"
              )}>
                {profile?.plan === 'pro' ? 'PRO' : 'FREE'}
              </span>
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span>Usage</span>
                <span>{profile?.usage_count || 0} / {profile?.plan === 'pro' ? 'Unlimited' : '15'}</span>
              </div>
              <div className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-zinc-900 dark:bg-white transition-all duration-500" 
                  style={{ width: profile?.plan === 'pro' ? '0%' : `${Math.min(100, ((profile?.usage_count || 0) / 15) * 100)}%` }}
                />
              </div>
            </div>
            {profile?.plan === 'free' && (
              <div className="mt-3 text-[10px] text-zinc-500 text-center">
                Pro Plan – $7 per 30 days
              </div>
            )}
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
