import React from 'react';
import { Zap, X, Check, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  reason: 'usage' | 'images';
}

export const UpgradeModal: React.FC<UpgradeModalProps> = ({ isOpen, onClose, reason }) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl w-full max-w-md p-8 shadow-2xl relative overflow-hidden"
          >
            {/* Background Glow */}
            <div className="absolute -top-24 -right-24 w-48 h-48 bg-amber-500/10 blur-[80px] rounded-full" />
            <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-blue-500/10 blur-[80px] rounded-full" />

            <button 
              onClick={onClose}
              className="absolute top-4 right-4 p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors z-10"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex flex-col items-center text-center relative z-10">
              <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/30 rounded-2xl flex items-center justify-center mb-6 shadow-inner">
                <Zap className="w-8 h-8 text-amber-600 dark:text-amber-400" />
              </div>

              <h2 className="text-2xl font-bold mb-2">Limit Reached</h2>
              <p className="text-zinc-500 dark:text-zinc-400 text-sm mb-8">
                {reason === 'usage' 
                  ? "You've used all your free generations. Upgrade to Pro for unlimited access!" 
                  : "You've reached your daily limit of 3 images. Upgrade to Pro for unlimited image generation!"}
              </p>

              <div className="w-full space-y-4 mb-8">
                <div className="flex items-center gap-3 text-sm font-medium p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-100 dark:border-zinc-800">
                  <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center">
                    <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <span>Unlimited Generations</span>
                </div>
                <div className="flex items-center gap-3 text-sm font-medium p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-100 dark:border-zinc-800">
                  <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center">
                    <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <span>Unlimited AI Images</span>
                </div>
                <div className="flex items-center gap-3 text-sm font-medium p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-100 dark:border-zinc-800">
                  <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center">
                    <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <span>Priority Support</span>
                </div>
              </div>

              <div className="w-full space-y-3">
                <a 
                  href="https://wa.me/447526596522" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="w-full py-4 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-2xl font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity shadow-lg"
                >
                  Upgrade to Pro – $7
                  <ExternalLink className="w-4 h-4" />
                </a>
                <button 
                  onClick={onClose}
                  className="w-full py-3 text-sm font-bold text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors"
                >
                  Maybe later
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
