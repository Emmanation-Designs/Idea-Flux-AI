import { 
  MessageSquare, 
  FileText, 
  Hash
} from 'lucide-react';
import { motion } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { ConversationType } from '../types';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const WelcomeScreen = ({ onSelectType }: { onSelectType: (type: ConversationType) => void }) => {
  const suggestions = [
    { 
      id: 'idea', 
      title: 'Create Idea', 
      desc: 'Viral content ideas for any niche', 
      icon: MessageSquare,
      color: 'text-blue-500',
      bg: 'bg-blue-50 dark:bg-blue-950/20'
    },
    { 
      id: 'script', 
      title: 'Create Script', 
      desc: 'High-retention video scripts', 
      icon: FileText,
      color: 'text-purple-500',
      bg: 'bg-purple-50 dark:bg-purple-950/20'
    },
    { 
      id: 'hashtag', 
      title: 'Create Hashtags', 
      desc: 'Optimized tags for reach', 
      icon: Hash,
      color: 'text-emerald-500',
      bg: 'bg-emerald-50 dark:bg-emerald-950/20'
    },
  ];

  return (
    <div className="max-w-3xl mx-auto w-full flex flex-col items-center justify-start pt-12 md:justify-center md:pt-0 min-h-[60vh] px-4">
      <div className="flex flex-row gap-3 w-full overflow-x-auto pb-4 no-scrollbar md:grid md:grid-cols-3 md:gap-4 md:overflow-visible">
        {suggestions.map((s, i) => (
          <motion.button
            key={s.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            onClick={() => onSelectType(s.id as ConversationType)}
            className="flex-shrink-0 w-[140px] md:w-full group p-4 md:p-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-left hover:border-zinc-400 dark:hover:border-zinc-600 transition-all hover:shadow-lg"
          >
            <div className={cn("w-9 h-9 md:w-12 md:h-12 rounded-xl flex items-center justify-center mb-2.5 md:mb-4 transition-transform group-hover:scale-110", s.bg)}>
              <s.icon className={cn("w-4 h-4 md:w-6 h-6", s.color)} />
            </div>
            <h3 className="font-bold text-xs md:text-lg mb-0.5 md:mb-1">{s.title}</h3>
            <p className="text-[9px] md:text-sm text-zinc-500 dark:text-zinc-400 line-clamp-2">{s.desc}</p>
          </motion.button>
        ))}
      </div>
    </div>
  );
};
