import { 
  Plus, 
  History, 
  X, 
  LogOut, 
  Zap, 
  MessageSquare, 
  FileText, 
  Hash,
  Trash2,
  Edit2,
  Check,
  X as CloseIcon
} from 'lucide-react';
import { motion } from 'motion/react';
import { useState } from 'react';
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
  onLogout,
  onRename,
  onDelete
}: { 
  isOpen: boolean; 
  setIsOpen: (open: boolean) => void;
  conversations: any[];
  onSelectConversation: (id: string) => void;
  onNewChat: () => void;
  currentConversationId: string | null;
  onLogout: () => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

  const startEditing = (e: React.MouseEvent, id: string, title: string) => {
    e.stopPropagation();
    setEditingId(id);
    setEditTitle(title);
  };

  const cancelEditing = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(null);
  };

  const saveEditing = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (editTitle.trim()) {
      onRename(id, editTitle.trim());
    }
    setEditingId(null);
  };

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
          <CloseIcon className="w-5 h-5" />
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
            <div
              key={conv.id}
              className="group relative"
            >
              <div
                role="button"
                tabIndex={0}
                onClick={() => !editingId && onSelectConversation(conv.id)}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    !editingId && onSelectConversation(conv.id);
                  }
                }}
                className={cn(
                  "w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors flex flex-col gap-0.5 pr-16 cursor-pointer outline-none",
                  currentConversationId === conv.id 
                    ? "bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-white" 
                    : "hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-600 dark:text-zinc-400"
                )}
              >
                {editingId === conv.id ? (
                  <div className="flex items-center gap-1 w-full" onClick={e => e.stopPropagation()}>
                    <input
                      autoFocus
                      value={editTitle}
                      onChange={e => setEditTitle(e.target.value)}
                      className="bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded px-1 py-0.5 w-full text-xs outline-none focus:ring-1 focus:ring-zinc-400"
                      onKeyDown={e => {
                        if (e.key === 'Enter') saveEditing(e as any, conv.id);
                        if (e.key === 'Escape') cancelEditing(e as any);
                        e.stopPropagation();
                      }}
                    />
                    <button onClick={e => saveEditing(e, conv.id)} className="p-1 hover:text-green-500">
                      <Check className="w-3 h-3" />
                    </button>
                    <button onClick={cancelEditing} className="p-1 hover:text-red-500">
                      <CloseIcon className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="font-medium truncate">{conv.title}</div>
                    <div className="flex items-center gap-2 text-[10px] opacity-60">
                      {conv.type === 'idea' && <MessageSquare className="w-2.5 h-2.5" />}
                      {conv.type === 'script' && <FileText className="w-2.5 h-2.5" />}
                      {conv.type === 'hashtag' && <Hash className="w-2.5 h-2.5" />}
                      <span className="capitalize">{conv.type}</span>
                      <span>•</span>
                      <span>{new Date(conv.created_at).toLocaleDateString()}</span>
                    </div>
                  </>
                )}
              </div>
              
              {!editingId && (
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={(e) => startEditing(e, conv.id, conv.title)}
                    className="p-1.5 hover:bg-zinc-300 dark:hover:bg-zinc-700 rounded-md text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
                  >
                    <Edit2 className="w-3 h-3" />
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); onDelete(conv.id); }}
                    className="p-1.5 hover:bg-zinc-300 dark:hover:bg-zinc-700 rounded-md text-zinc-500 hover:text-red-500"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
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
