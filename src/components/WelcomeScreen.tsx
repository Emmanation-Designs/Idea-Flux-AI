import { 
  MessageSquare, 
  FileText, 
  Hash,
  Zap,
  Waves
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
    { 
      id: 'image', 
      title: 'Generate Image', 
      desc: 'DALL·E 3 AI images', 
      icon: Zap,
      color: 'text-orange-500',
      bg: 'bg-orange-50 dark:bg-orange-950/20'
    },
    { 
      id: 'voice', 
      title: 'Voice Chat', 
      desc: 'Real-time AI conversation', 
      icon: Waves,
      color: 'text-pink-500',
      bg: 'bg-pink-50 dark:bg-pink-950/20'
    },
  ];

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-12 w-full max-w-5xl mx-auto overflow-hidden">
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8 md:mb-12"
      >
        <div className="w-12 h-12 md:w-16 md:h-16 bg-zinc-900 dark:bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 md:mb-6 shadow-xl">
          <Zap className="w-6 h-6 md:w-8 md:h-8 text-white dark:text-zinc-900" />
        </div>
        <h1 className="text-2xl md:text-5xl font-bold tracking-tight mb-2 md:mb-4">What can I help with?</h1>
        <p className="text-zinc-500 dark:text-zinc-400 text-sm md:text-lg max-w-md mx-auto px-4">
          Choose a tool below to start creating viral content.
        </p>
      </motion.div>

      <div className="flex md:grid md:grid-cols-5 gap-4 md:gap-6 w-full overflow-x-auto md:overflow-x-visible pb-8 md:pb-0 snap-x snap-mandatory md:snap-none no-scrollbar px-4 md:px-0">
        {suggestions.map((s, i) => (
          <motion.button
            key={s.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            onClick={() => onSelectType(s.id as ConversationType)}
            className="flex-shrink-0 w-[160px] md:w-full snap-center group p-5 md:p-8 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl text-center md:text-left hover:border-zinc-400 dark:hover:border-zinc-600 transition-all hover:shadow-xl flex flex-col items-center md:items-start h-full"
          >
            <div className={cn("w-12 h-12 md:w-14 md:h-14 rounded-2xl flex items-center justify-center mb-4 md:mb-6 transition-transform group-hover:scale-110", s.bg)}>
              <s.icon className={cn("w-6 h-6 md:w-7 md:h-7", s.color)} />
            </div>
            <h3 className="text-sm md:text-xl font-bold mb-1 md:mb-2 group-hover:text-zinc-900 dark:group-hover:text-white transition-colors line-clamp-1">
              {s.title.replace('Create ', '')}
            </h3>
            <p className="text-[10px] md:text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed line-clamp-2">{s.desc}</p>
          </motion.button>
        ))}
      </div>
    </div>
  );
};
