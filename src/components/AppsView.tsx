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
      desc: 'Discover viral content concepts for any niche.', 
      icon: MessageSquare,
      color: 'text-blue-500',
      bg: 'bg-blue-50 dark:bg-blue-950/20'
    },
    { 
      id: 'script', 
      title: 'Script Writer', 
      desc: 'Craft high-retention scripts for videos and ads.', 
      icon: FileText,
      color: 'text-purple-500',
      bg: 'bg-purple-50 dark:bg-purple-950/20'
    },
    { 
      id: 'hashtag', 
      title: 'Hashtag Studio', 
      desc: 'Generate optimized tags for maximum reach.', 
      icon: Hash,
      color: 'text-emerald-500',
      bg: 'bg-emerald-50 dark:bg-emerald-950/20'
    },
    { 
      id: 'image', 
      title: 'Visual Artist', 
      desc: 'Create professional assets with proprietary AI.', 
      icon: Zap,
      color: 'text-orange-500',
      bg: 'bg-orange-50 dark:bg-orange-950/20'
    }
  ];

  return (
    <div className="flex-1 flex flex-col h-full bg-zinc-50 dark:bg-zinc-950">
      <div className="px-6 py-10 md:px-12 md:py-16 flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">AI Toolkit</h2>
          <p className="text-sm text-zinc-500 font-medium">Professional instruments for your creative workflow.</p>
        </div>
        {onBack && (
          <button 
            onClick={onBack}
            className="px-5 py-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs font-semibold shadow-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all"
          >
            Back to Chat
          </button>
        )}
      </div>

      <div className="flex-1 flex items-center px-6 md:px-12 pb-12 overflow-x-auto gap-6 no-scrollbar">
        {apps.map((app, i) => (
          <motion.button
            key={`app-${app.id}-${i}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            onClick={() => onSelectApp(app.id as ConversationType)}
            className="group min-w-[280px] md:min-w-[320px] p-10 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[2.5rem] text-left hover:border-zinc-400 dark:hover:border-zinc-600 transition-all hover:shadow-xl flex flex-col items-start shrink-0"
          >
            <div className={cn("w-14 h-14 flex items-center justify-center mb-6 transition-transform group-hover:rotate-6")}>
              <app.icon className={cn("w-10 h-10", app.color)} />
            </div>
            <h3 className="text-xl font-bold mb-2 group-hover:text-zinc-900 dark:group-hover:text-white transition-colors">
              {app.title}
            </h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed font-medium line-clamp-2">{app.desc}</p>
            
            <div className="mt-8 flex items-center gap-2 text-xs font-bold text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-white transition-colors">
              <span>Launch App</span>
              <LayoutGrid className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" />
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );
};

