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
  Edit2,
  Search,
  MoreVertical
} from 'lucide-react';
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import type { Profile } from '../types';

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
  profile,
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
  profile: Profile | null;
  conversations?: any[];
  currentConversationId?: string;
  onSelectConversation: (id: string) => void;
  onDeleteConversation: (id: string) => void;
  onRenameConversation: (id: string, newTitle: string) => void;
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [revealedActionsId, setRevealedActionsId] = useState<string | null>(null);

  const filteredConversations = conversations.filter(conv => 
    (conv.title || 'Untitled Chat').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <motion.aside
      initial={false}
      animate={{ width: isOpen ? 300 : 0, opacity: isOpen ? 1 : 0 }}
      className={cn(
        "fixed lg:relative inset-y-0 left-0 z-40 bg-zinc-50 dark:bg-zinc-950 border-r border-zinc-200 dark:border-zinc-800 overflow-hidden flex flex-col transition-all duration-300 ease-in-out shadow-2xl lg:shadow-none",
        !isOpen && "pointer-events-none lg:pointer-events-auto"
      )}
    >
      <div className="p-6 flex items-center justify-between mb-2">
        <h2 
          onClick={onNewChat}
          className="font-black text-xs uppercase tracking-[0.2em] flex items-center gap-2 cursor-pointer transition-opacity"
        >
          <Zap className="w-4 h-4 text-emerald-500" />
          Trelvix AI
        </h2>
        <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-md lg:hidden text-zinc-400">
          <CloseIcon className="w-5 h-5" />
        </button>
      </div>

      <div className="px-4 mb-6">
        <button 
          onClick={onNewChat}
          className="w-full flex items-center gap-3 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest hover:brightness-110 active:scale-[0.98] transition-all shadow-xl shadow-zinc-500/10"
        >
          <Plus className="w-4 h-4" />
          New Conversation
        </button>
      </div>

      <div className="flex-1 px-4 space-y-1 overflow-y-auto scrollbar-hide py-2">
        <div className="space-y-1 mb-8">
          <div className="relative mb-6">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
            <input 
              type="text"
              placeholder="Search chats..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all placeholder:text-zinc-400 placeholder:font-black placeholder:tracking-widest"
            />
          </div>

          <button 
            onClick={onOpenImages}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-xl transition-all",
              activeView === 'images' 
                ? "bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-sm" 
                : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900"
            )}
          >
            <ImageIcon className="w-4 h-4" />
            Images
          </button>

          <button 
            onClick={onOpenApps}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-xl transition-all",
              activeView === 'apps' 
                ? "bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-sm" 
                : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900"
            )}
          >
            <LayoutGrid className="w-4 h-4" />
            Apps
          </button>

          <button 
            onClick={onOpenSettings}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-xl transition-all",
              activeView === 'settings' 
                ? "bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-sm" 
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
            {filteredConversations.length === 0 ? (
              <div className="px-4 py-8 text-center bg-zinc-100/50 dark:bg-zinc-900/30 rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800">
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                  {searchQuery ? 'No matches found' : 'No recent chats'}
                </p>
              </div>
            ) : (
              <AnimatePresence mode="popLayout">
                {filteredConversations.map((conv, idx) => (
                  <motion.div
                    layout
                    key={conv.id ? `side-conv-${conv.id}` : `side-conv-idx-${idx}`}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="group relative"
                  >
                    <div className="flex items-center w-full gap-1">
                      <button
                        onClick={() => onSelectConversation(conv.id)}
                        className={cn(
                          "flex-1 text-left px-4 py-2.5 rounded-xl text-sm transition-all flex items-center gap-3 relative min-w-0",
                          currentConversationId === conv.id
                            ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-sm border border-zinc-200 dark:border-zinc-800"
                            : "text-zinc-500 hover:bg-zinc-100/80 dark:hover:bg-zinc-900/80"
                        )}
                      >
                        <MessageSquare className={cn(
                          "w-3.5 h-3.5 shrink-0 transition-transform group-hover:scale-110",
                          currentConversationId === conv.id ? "text-emerald-500" : "text-zinc-400"
                        )} />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{conv.title || 'Untitled Chat'}</p>
                        </div>
                      </button>
                      
                      <div className="flex items-center shrink-0">
                        {revealedActionsId === conv.id ? (
                          <motion.div 
                            initial={{ opacity: 0, x: 10 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-900 rounded-xl p-1 border border-zinc-200 dark:border-zinc-800"
                          >
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const newTitle = prompt('Rename conversation:', conv.title);
                                if (newTitle) {
                                  onRenameConversation(conv.id, newTitle);
                                  setRevealedActionsId(null);
                                }
                              }}
                              className="p-1.5 text-zinc-400 hover:text-emerald-500 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-950/20 transition-all"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeleteConversation(conv.id);
                                setRevealedActionsId(null);
                              }}
                              className="p-1.5 text-zinc-300 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/20 transition-all"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                               onClick={() => setRevealedActionsId(null)}
                               className="p-1.5 text-zinc-300 hover:text-zinc-500 rounded-lg transition-all"
                             >
                               <CloseIcon className="w-3.5 h-3.5" />
                             </button>
                          </motion.div>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setRevealedActionsId(conv.id);
                            }}
                            className="p-2.5 text-zinc-300 hover:text-zinc-500 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>
        </div>
      </div>

      <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-950 px-2 space-y-1">
        <button 
          onClick={onOpenSettings}
          className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-all text-left outline-none"
        >
          <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center border border-zinc-200 dark:border-zinc-800 overflow-hidden shrink-0">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <LogOut className="w-4 h-4 text-zinc-400 rotate-180" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-black text-zinc-900 dark:text-zinc-100 truncate uppercase tracking-widest">
              {profile?.name || profile?.email?.split('@')[0] || 'User'}
            </p>
            <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest truncate">
              {profile?.plan || 'Free'} Plan
            </p>
          </div>
          <SettingsIcon className="w-4 h-4 text-zinc-300" />
        </button>

        <button 
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-xl transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          Sign Out
        </button>
      </div>
    </motion.aside>
  );
};

