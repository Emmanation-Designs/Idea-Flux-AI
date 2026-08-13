import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mic, ShieldCheck, Sparkles } from 'lucide-react';

interface LiveMicPermissionModalProps {
  isOpen: boolean;
  onAgree: () => void;
  onDecline: () => void;
}

export const LiveMicPermissionModal: React.FC<LiveMicPermissionModalProps> = ({
  isOpen,
  onAgree,
  onDecline,
}) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-2xl"
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          className="relative w-full max-w-sm p-6 bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl text-center overflow-hidden"
        >
          {/* Top Decorative Icon */}
          <div className="mx-auto w-14 h-14 mb-4 flex items-center justify-center rounded-2xl bg-purple-950/60 border border-purple-800/50 text-purple-400 shadow-inner">
            <Mic className="w-7 h-7" />
          </div>

          <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-purple-400 uppercase tracking-widest mb-1">
            <Sparkles className="w-3.5 h-3.5" />
            Trelvix AI Live Mode
          </div>

          <h3 className="text-lg font-bold text-white mb-2">Microphone Access Required</h3>

          <p className="text-xs text-zinc-400 leading-relaxed mb-6">
            Live Mode lets you have a real-time voice conversation with Trelvix AI. Your microphone is used to hear what you say and provide spoken responses. You can mute or end the conversation at any time.
          </p>

          <div className="flex items-center justify-center gap-2 text-[11px] text-zinc-500 mb-6">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>Audio stream is encrypted & short-lived</span>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2">
            <button
              onClick={onAgree}
              className="w-full py-3 text-xs font-bold text-white bg-purple-600 hover:bg-purple-500 rounded-xl transition shadow-lg shadow-purple-950/50"
            >
              Agree & Continue
            </button>
            <button
              onClick={onDecline}
              className="w-full py-2.5 text-xs font-medium text-zinc-400 hover:text-white bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl transition"
            >
              Not Now
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
