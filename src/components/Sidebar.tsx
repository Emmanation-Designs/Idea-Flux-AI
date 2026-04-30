import { 
  Plus, 
  Settings as SettingsIcon,
  X as CloseIcon,
  Image as ImageIcon,
  LayoutGrid,
  Zap,
  LogOut,
  MessageSquare,
  Trash2,
  Clock,
  Edit2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const Sidebar = ({ 
  isOpen, 
  setIsOpen, 
  onNewChat,
  onOpenSettings,
  onOpenApps,
  onOpenImages,
  onLogout,
  activeView,
  conversations = [],
  currentConversationId,
  onSelectConversation,
  onDeleteConversation,
  onRenameConversation
}: { 
  isOpen: boolean; 
  setIsOpen: (open: boolean) => void;
  onNewChat: () => void;
  onOpenSettings: () => void;
  onOpenApps: () => void;
  onOpenImages: () => void;
  onLogout: () => void;
  activeView: string;
  conversations?: any[];
  currentConversationId?: string;
  onSelectConversation: (id: string) => void;
  onDeleteConversation: (id: string) => void;
  onRenameConversation: (id: string, newTitle: string) => void;
}) => {
  return (
    <motion.aside
      initial={false}
      animate={{ width: isOpen ? 300 : 0, opacity: isOpen ? 1 : 0 }}
      className={cn(
        "fixed lg:relative inset-y-0 left-0 z-40 bg-zinc-50 dark:bg-zinc-950 border-r border-zinc-200 dark:border-zinc-800 overflow-hidden flex flex-col transition-all duration-300 ease-in-out shadow-2xl lg:shadow-none",
        !isOpen && "pointer-events-none lg:pointer-events-auto"
      )}
    >
      <div className="p-6 flex items-center justify-between">
        <h2 
          onClick={onNewChat}
          className="font-black text-xl flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
        >
          <Zap className="w-5 h-5 text-emerald-500" />
          Trelvix AI
        </h2>
        <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-md lg:hidden">
          <CloseIcon className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 px-4 space-y-1 overflow-y-auto scrollbar-hide py-2">
        <div className="space-y-1 mb-8">
          <button 
            onClick={onOpenImages}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 text-sm font-bold rounded-2xl transition-all",
              activeView === 'images' 
                ? "bg-zinc-200 dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-sm" 
                : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900"
            )}
          >
            <ImageIcon className="w-4 h-4" />
            Images
          </button>

          <button 
            onClick={onOpenApps}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 text-sm font-bold rounded-2xl transition-all",
              activeView === 'apps' 
                ? "bg-zinc-200 dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-sm" 
                : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900"
            )}
          >
            <LayoutGrid className="w-4 h-4" />
            Apps
          </button>

          <button 
            onClick={onOpenSettings}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 text-sm font-bold rounded-2xl transition-all",
              activeView === 'settings' 
                ? "bg-zinc-200 dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-sm" 
                : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900"
            )}
          >
            <SettingsIcon className="w-4 h-4" />
            Settings
          </button>
        </div>

        {/* Recent History Section */}
        <div className="pt-4">
          <div className="px-4 mb-4 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">
            <Clock className="w-3 h-3" />
            Recent
          </div>
          <div className="space-y-1">
            {conversations.length === 0 ? (
              <div className="px-4 py-8 text-center bg-zinc-100/50 dark:bg-zinc-900/30 rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800">
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">No recent chats</p>
              </div>
            ) : (
              <AnimatePresence mode="popLayout">
                {conversations.map((conv) => (
                  <motion.div
                    layout
                    key={conv.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="group relative"
                  >
                    <button
                      onClick={() => onSelectConversation(conv.id)}
                      className={cn(
                        "w-full text-left px-4 py-3 rounded-2xl text-sm transition-all flex items-center gap-3 relative pr-12",
                        currentConversationId === conv.id
                          ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-md ring-1 ring-zinc-200 dark:ring-zinc-800"
                          : "text-zinc-500 hover:bg-zinc-100/80 dark:hover:bg-zinc-900/80"
                      )}
                    >
                      <MessageSquare className={cn(
                        "w-3.5 h-3.5 shrink-0 transition-transform group-hover:scale-110",
                        currentConversationId === conv.id ? "text-emerald-500" : "text-zinc-400"
                      )} />
                      <div className="flex-1 min-w-0">
                        <p className="font-bold truncate">{conv.title || 'Untitled Chat'}</p>
                      </div>
                    </button>
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-all">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const newTitle = prompt('Rename conversation:', conv.title);
                          if (newTitle) onRenameConversation(conv.id, newTitle);
                        }}
                        className="p-1.5 text-zinc-400 hover:text-emerald-500 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-950/20 transition-all"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteConversation(conv.id);
                        }}
                        className="p-1.5 text-zinc-300 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/20 transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>
        </div>
      </div>

      <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 space-y-2">
        <button 
          onClick={onNewChat}
          className="w-full flex items-center justify-center gap-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 py-3.5 rounded-2xl font-black text-[10px] md:text-xs uppercase tracking-[0.2em] hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-black/10 dark:shadow-white/5"
        >
          <Plus className="w-4 h-4" />
          New chat
        </button>
        <button 
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-2xl transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Logout
        </button>
      </div>
    </motion.aside>
  );
};

