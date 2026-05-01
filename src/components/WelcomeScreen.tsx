import { 
  MessageSquare, 
  FileText, 
  Hash,
  Zap,
  Waves,
  Image as ImageIcon
} from 'lucide-react';
import { motion } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { ConversationType } from '../types';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const WelcomeScreen = () => {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-8 w-full max-w-6xl mx-auto overflow-hidden">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 0.2, scale: 1 }}
        transition={{ duration: 1, ease: "easeOut" }}
        className="flex flex-col items-center gap-6"
      >
        <Zap className="w-32 h-32 text-emerald-500 drop-shadow-[0_0_30px_rgba(16,185,129,0.3)]" />
        <h1 className="text-4xl font-black tracking-tighter uppercase dark:text-white">
          Trelvix AI
        </h1>
      </motion.div>
    </div>
  );
};


