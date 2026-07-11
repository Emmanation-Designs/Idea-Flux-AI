import { 
  MessageSquare, 
  FileText, 
  Hash,
  Waves,
  Image as ImageIcon
} from 'lucide-react';
import { motion } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { ConversationType } from '../types';
import { TrelvixLogo } from './TrelvixLogo';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const WelcomeScreen = () => {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-8 w-full max-w-6xl mx-auto overflow-hidden">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 0.25, scale: 1 }}
        transition={{ duration: 1, ease: "easeOut" }}
        className="flex flex-col items-center gap-6"
      >
        <TrelvixLogo className="w-32 h-32" />
        <h1 className="text-4xl font-black tracking-tighter uppercase dark:text-white">
          Trelvix AI
        </h1>
      </motion.div>
    </div>
  );
};


