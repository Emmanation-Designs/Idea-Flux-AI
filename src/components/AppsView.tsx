import React from 'react';
import { 
  MessageSquare, 
  FileText, 
  Hash,
  Zap,
  ChevronRight,
  Volume2
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
      bg: 'bg-blue-50 dark:bg-blue-950/30'
    },
    { 
      id: 'script', 
      title: 'Script Writer', 
      desc: 'Craft high-retention scripts for videos and ads.', 
      icon: FileText,
      color: 'text-purple-500',
      bg: 'bg-purple-50 dark:bg-purple-950/30'
    },
    { 
      id: 'hashtag', 
      title: 'Hashtag Studio', 
      desc: 'Generate optimized tags for maximum reach.', 
      icon: Hash,
      color: 'text-emerald-500',
      bg: 'bg-emerald-50 dark:bg-emerald-950/30'
    },
    { 
      id: 'image', 
      title: 'Visual Artist', 
      desc: 'Create professional assets with proprietary AI.', 
      icon: Zap,
      color: 'text-orange-500',
      bg: 'bg-orange-50 dark:bg-orange-950/30'
    },
    { 
      id: 'tts', 
      title: 'Text to Speech', 
      desc: 'Convert text into realistic AI voices.', 
      icon: Volume2,
      color: 'text-rose-500',
      bg: 'bg-rose-50 dark:bg-rose-950/30'
    }
  ];

  return (
    <div className="flex-1 flex flex-col h-full bg-zinc-50 dark:bg-zinc-950 overflow-y-auto">
      <div className="px-6 py-8 md:px-12 md:py-12 max-w-3xl mx-auto w-full flex items-center justify-between shrink-0">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">AI Toolkit</h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium">Professional instruments for your creative workflow.</p>
        </div>
        {onBack && (
          <button 
            onClick={onBack}
            className="px-4 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs font-semibold shadow-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all text-zinc-700 dark:text-zinc-300"
          >
            Back to Chat
          </button>
        )}
      </div>

      <div className="flex-1 px-6 md:px-12 pb-12 max-w-3xl mx-auto w-full flex flex-col gap-3">
        {apps.map((app, i) => (
          <motion.button
            key={`app-${app.id}-${i}`}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            onClick={() => onSelectApp(app.id as ConversationType)}
            className="group w-full p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-left hover:border-zinc-300 dark:hover:border-zinc-700 transition-all hover:shadow-md flex items-center gap-4"
          >
            <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105", app.bg)}>
              <app.icon className={cn("w-6 h-6", app.color)} />
            </div>
            
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-bold text-zinc-800 dark:text-zinc-200 group-hover:text-zinc-950 dark:group-hover:text-white transition-colors">
                {app.title}
              </h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium truncate mt-0.5">
                {app.desc}
              </p>
            </div>

            <div className="flex items-center gap-1 text-xs font-bold text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-white transition-colors shrink-0">
              <span className="hidden sm:inline opacity-0 group-hover:opacity-100 transition-opacity">Launch</span>
              <ChevronRight className="w-5 h-5 transform group-hover:translate-x-1 transition-transform" />
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );
};

