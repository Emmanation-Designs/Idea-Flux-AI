import React from 'react';
import { 
  MessageSquare, 
  FileText, 
  Hash,
  Zap,
  LayoutGrid
} from 'lucide-react';
import { motion } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { ConversationType } from '../types';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const AppsView = ({ onSelectApp, onBack }: { onSelectApp: (type: ConversationType) => void, onBack?: () => void }) => {
  const apps = [
    { 
      id: 'idea', 
      title: 'Idea Generator', 
      desc: 'Viral content concepts', 
      icon: MessageSquare,
      color: 'text-blue-500',
      bg: 'bg-blue-50 dark:bg-blue-950/20'
    },
    { 
      id: 'script', 
      title: 'Script Writer', 
      desc: 'High-retention scripts', 
      icon: FileText,
      color: 'text-purple-500',
      bg: 'bg-purple-50 dark:bg-purple-950/20'
    },
    { 
      id: 'hashtag', 
      title: 'Hashtag Studio', 
      desc: 'Optimized reach tags', 
      icon: Hash,
      color: 'text-emerald-500',
      bg: 'bg-emerald-50 dark:bg-emerald-950/20'
    },
    { 
      id: 'image', 
      title: 'Visual Artist', 
      desc: 'Proprietary image engine', 
      icon: Zap,
      color: 'text-orange-500',
      bg: 'bg-orange-50 dark:bg-orange-950/20'
    }
  ];

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-zinc-50 dark:bg-zinc-950">
      <div className="px-6 py-8 md:px-12 md:py-12 flex items-center justify-between">
        <div>
          <h2 className="text-4xl font-black tracking-tight uppercase">AI Gallery</h2>
          <p className="text-[10px] text-zinc-500 font-black uppercase tracking-[0.2em] mt-2">Professional Content Toolkit</p>
        </div>
        {onBack && (
          <button 
            onClick={onBack}
            className="px-6 py-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-sm hover:border-zinc-400 transition-all"
          >
            Back to Chat
          </button>
        )}
      </div>

      <div className="flex-1 flex items-center px-6 md:px-12 pb-12 overflow-x-auto gap-6 no-scrollbar">
        {apps.map((app, i) => (
          <motion.button
            key={`app-${app.id}-${i}`}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
            onClick={() => onSelectApp(app.id as ConversationType)}
            className="group min-w-[280px] md:min-w-[340px] p-10 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[3rem] text-left hover:border-zinc-400 dark:hover:border-zinc-700 transition-all hover:shadow-2xl flex flex-col items-center text-center justify-center shrink-0"
          >
            <div className={cn("w-20 h-20 rounded-[2rem] flex items-center justify-center mb-8 transition-all group-hover:scale-110 shadow-inner", app.bg)}>
              <app.icon className={cn("w-10 h-10", app.color)} />
            </div>
            <h3 className="text-2xl font-black mb-4 group-hover:text-zinc-900 dark:group-hover:text-white transition-colors">
              {app.title}
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed font-bold max-w-[200px]">{app.desc}</p>
            <div className="mt-10 px-6 py-3 bg-zinc-100 dark:bg-zinc-800 rounded-2xl opacity-0 group-hover:opacity-100 transition-all transform translate-y-4 group-hover:translate-y-0">
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-900 dark:text-white">
                Launch
              </span>
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );
};
