import { 
  Plus, 
  History, 
  X, 
  LogOut, 
  Zap, 
  MessageSquare, 
  FileText, 
  Hash
} from 'lucide-react';
import { motion } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const Sidebar = ({ 
  isOpen, 
  setIsOpen, 
  conversations, 
  onSelectConversation, 
  onNewChat,
  currentConversationId,
  onLogout
}: { 
  isOpen: boolean; 
  setIsOpen: (open: boolean) => void;
  conversations: any[];
  onSelectConversation: (id: string) => void;
  onNewChat: () => void;
  currentConversationId: string | null;
  onLogout: () => void;
}) => {
  return (
    <motion.aside
      initial={false}
      animate={{ width: isOpen ? 280 : 0, opacity: isOpen ? 1 : 0 }}
      className={cn(
        "fixed lg:relative inset-y-0 left-0 z-40 bg-zinc-50 dark:bg-zinc-950 border-r border-zinc-200 dark:border-zinc-800 overflow-hidden flex flex-col transition-all duration-300 ease-in-out",
        !isOpen && "pointer-events-none lg:pointer-events-auto"
      )}
    >
      <div className="p-4 flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800">
        <h2 className="font-bold text-lg flex items-center gap-2">
          <Zap className="w-5 h-5 text-zinc-900 dark:text-white" />
          Ideaflux AI
        </h2>
        <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-md lg:hidden">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="p-4">
        <button 
          onClick={onNewChat}
          className="w-full flex items-center justify-center gap-2 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 py-2.5 rounded-xl font-medium hover:opacity-90 transition-opacity"
        >
          <Plus className="w-4 h-4" />
          New Chat
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 space-y-1">
        <div className="px-3 py-2 text-xs font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-2">
          <History className="w-3 h-3" />
          History
        </div>
        {conversations.length === 0 ? (
          <div className="px-3 py-4 text-sm text-zinc-400 italic">No history yet</div>
        ) : (
          conversations.map((conv) => (
            <button
              key={conv.id}
              onClick={() => onSelectConversation(conv.id)}
              className={cn(
                "w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors flex flex-col gap-0.5",
                currentConversationId === conv.id 
                  ? "bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-white" 
                  : "hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-600 dark:text-zinc-400"
              )}
            >
              <div className="font-medium truncate">{conv.title}</div>
              <div className="flex items-center gap-2 text-[10px] opacity-60">
                {conv.type === 'idea' && <MessageSquare className="w-2.5 h-2.5" />}
                {conv.type === 'script' && <FileText className="w-2.5 h-2.5" />}
                {conv.type === 'hashtag' && <Hash className="w-2.5 h-2.5" />}
                <span className="capitalize">{conv.type}</span>
                <span>•</span>
                <span>{new Date(conv.created_at).toLocaleDateString()}</span>
              </div>
            </button>
          ))
        )}
      </div>

      <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 space-y-2">
        <button 
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-3 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Logout
        </button>
      </div>
    </motion.aside>
  );
};
