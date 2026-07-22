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
  MoreVertical,
  Volume2,
  Folder,
  FolderPlus,
  FolderKanban,
  User,
  ChevronRight,
  Sparkles,
  Sliders,
  LifeBuoy,
  ShieldCheck
} from 'lucide-react';
import React, { useState, useRef, useEffect } from 'react';
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
  onOpenTTS,
  onOpenProjects,
  onLogout,
  onOpenUpgrade,
  onShowLegal,
  onOpenSupport,
  activeView,
  profile,
  conversations = [],
  currentConversationId,
  onSelectConversation,
  onDeleteConversation,
  onRenameConversation,
  projects = [],
  selectedProjectId = null,
  onSelectProject,
  onCreateProjectClick,
  onMoveConversationClick
}: { 
  isOpen: boolean; 
  setIsOpen: (open: boolean) => void;
  onNewChat: () => void;
  onOpenSettings: (section?: string) => void;
  onOpenApps: () => void;
  onOpenImages: () => void;
  onOpenTTS: () => void;
  onOpenProjects?: () => void;
  onLogout: () => void;
  onOpenUpgrade?: () => void;
  onShowLegal?: (type: 'about' | 'privacy' | 'terms' | 'support') => void;
  onOpenSupport?: () => void;
  activeView: string;
  profile: Profile | null;
  conversations?: any[];
  currentConversationId?: string;
  onSelectConversation: (id: string) => void;
  onDeleteConversation: (id: string) => void;
  onRenameConversation: (id: string, newTitle: string) => void;
  projects?: any[];
  selectedProjectId?: string | null;
  onSelectProject?: (id: string | null) => void;
  onCreateProjectClick?: () => void;
  onMoveConversationClick?: (id: string) => void;
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [revealedActionsId, setRevealedActionsId] = useState<string | null>(null);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleAction = (callback: () => void) => {
    callback();
    if (window.innerWidth < 1024) {
      setIsOpen(false);
    }
  };

  const userName = profile?.name || profile?.email?.split('@')[0] || 'Emmanuel Nwaije';
  const userInitials = userName
    .split(' ')
    .filter(Boolean)
    .map(n => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase() || 'EN';
  const userPlan = profile?.plan ? (profile.plan.charAt(0).toUpperCase() + profile.plan.slice(1)) : 'Free';

  const contextConversations = conversations.filter(conv => {
    if (selectedProjectId) {
      return conv.project_id === selectedProjectId;
    }
    return !conv.project_id;
  });

  const filteredConversations = contextConversations.filter(conv => 
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
          onClick={() => handleAction(onNewChat)}
          className="font-black text-xs uppercase tracking-[0.2em] cursor-pointer transition-opacity text-zinc-900 dark:text-white"
        >
          Trelvix AI
        </h2>
        <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-md lg:hidden text-zinc-400">
          <CloseIcon className="w-5 h-5" />
        </button>
      </div>

      <div className="px-4 mb-6">
        <button 
          onClick={() => handleAction(onNewChat)}
          className="w-full group flex items-center justify-between bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white px-4 py-3 border border-emerald-500/20 hover:border-emerald-400/30 rounded-xl font-bold text-[11px] uppercase tracking-[0.15em] transition-all duration-300 shadow-md hover:shadow-lg shadow-emerald-500/10 hover:shadow-emerald-500/25 active:scale-[0.98] hover:-translate-y-[1px] cursor-pointer"
        >
          <div className="flex items-center gap-2.5">
            <span className="flex items-center justify-center w-5.5 h-5.5 rounded-lg bg-white/11 group-hover:bg-white/20 border border-white/5 transition-colors">
              <Plus className="w-3.5 h-3.5 group-hover:rotate-90 transition-transform duration-300 ease-out" />
            </span>
            <span>New Conversation</span>
          </div>
          <span className="text-[8px] font-mono tracking-wider opacity-60 bg-black/10 dark:bg-white/10 px-1.5 py-0.5 rounded-md border border-white/5">
            NEW
          </span>
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
            onClick={() => handleAction(onOpenImages)}
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
            onClick={() => handleAction(onOpenApps)}
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
        </div>

        {/* Workspaces & Projects Section */}
        <div className="pt-4 border-t border-zinc-200/50 dark:border-zinc-800/50 my-2">
          <div className="px-4 mb-2 flex items-center justify-between text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 animate-fade-in">
            <div className="flex items-center gap-2">
              <FolderKanban className="w-3.5 h-3.5 text-zinc-400" />
              <span>Workspaces</span>
            </div>
          </div>
          
          <div className="space-y-1">
            {/* 1. Create Workspace */}
            <button
              onClick={() => handleAction(() => onCreateProjectClick?.())}
              className="w-full text-left px-4 py-2 rounded-xl text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100/80 dark:hover:bg-zinc-900/80 transition-all flex items-center justify-between group/create cursor-pointer"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <FolderPlus className="w-4 h-4 text-emerald-500 shrink-0 group-hover/create:scale-110 transition-transform" />
                <span className="truncate">Create Workspace</span>
              </div>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                + New
              </span>
            </button>

            {/* 2. Projects (opens screen listing created projects) */}
            <button
              onClick={() => handleAction(() => onOpenProjects?.())}
              className={cn(
                "w-full text-left px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center justify-between group/projs cursor-pointer",
                activeView === 'projects'
                  ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-sm border border-zinc-200 dark:border-zinc-800 font-bold"
                  : "text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100/80 dark:hover:bg-zinc-900/80"
              )}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <FolderKanban className="w-4 h-4 text-zinc-400 shrink-0 group-hover/projs:text-zinc-700 dark:group-hover/projs:text-zinc-200 transition-colors" />
                <span className="truncate">Projects</span>
              </div>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-900 text-zinc-400">
                {projects.length}
              </span>
            </button>

            {/* Active Workspace Banner if a specific project is selected */}
            {selectedProjectId !== null && (
              <div className="mt-2.5 mx-1 p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-between animate-fade-in">
                <div className="flex items-center gap-2 min-w-0">
                  <Folder className="w-4 h-4 text-emerald-500 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[9px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Active Workspace</p>
                    <p className="text-xs font-bold text-zinc-900 dark:text-white truncate">
                      {projects.find(p => p.id === selectedProjectId)?.title || 'Project'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleAction(() => onSelectProject?.(null))}
                  className="p-1 hover:bg-emerald-500/20 rounded-lg text-emerald-600 dark:text-emerald-400 transition-colors cursor-pointer"
                  title="Switch to Personal Workspace"
                >
                  <CloseIcon className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Recent History Section */}
        <div className="pt-4">
          <div className="px-4 mb-3 flex items-center justify-between text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">
            <div className="flex items-center gap-2">
              <Clock className="w-3 h-3" />
              <span>{selectedProjectId ? projects.find(p => p.id === selectedProjectId)?.title || 'Project Chats' : 'Personal Chats'}</span>
            </div>
            <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-900 font-mono">
              {filteredConversations.length}
            </span>
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
                {filteredConversations.map((conv, index) => (
                  <motion.div
                    layout
                    key={`sidebar-conv-${conv.id || index}`}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="group relative"
                  >
                    <div className="flex items-center w-full gap-1">
                      <button
                        onClick={() => handleAction(() => onSelectConversation(conv.id))}
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
                              onClick={(e) => {
                                e.stopPropagation();
                                onMoveConversationClick?.(conv.id);
                                setRevealedActionsId(null);
                              }}
                              className="p-1.5 text-zinc-400 hover:text-blue-500 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/20 transition-all cursor-pointer"
                              title="Move to Project"
                            >
                              <Folder className="w-3.5 h-3.5" />
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

      <div className="p-3 border-t border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-100/50 dark:bg-zinc-950 relative" ref={menuRef}>
        {/* Profile Popover Menu */}
        <AnimatePresence>
          {isUserMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.96 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="absolute bottom-full mb-2.5 left-2 right-2 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-800/90 rounded-2xl p-2 shadow-2xl z-50 overflow-hidden font-sans"
            >
              {/* Header item */}
              <button
                onClick={() => {
                  setIsUserMenuOpen(false);
                  handleAction(() => onOpenSettings('account'));
                }}
                className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800/80 transition-colors text-left group/usr cursor-pointer"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-emerald-500 text-white font-extrabold text-xs flex items-center justify-center shrink-0 shadow-xs overflow-hidden">
                    {profile?.avatar_url ? (
                      <img src={profile.avatar_url} alt="User" className="w-full h-full object-cover" />
                    ) : (
                      userInitials
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-zinc-900 dark:text-white truncate leading-tight">{userName}</p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium truncate">{userPlan} Plan</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-zinc-400 dark:text-zinc-500 group-hover/usr:text-zinc-700 dark:group-hover/usr:text-zinc-300 group-hover/usr:translate-x-0.5 transition-all shrink-0" />
              </button>

              <div className="my-1 border-t border-zinc-100 dark:border-zinc-800/80" />

              {/* Upgrade plan */}
              <button
                onClick={() => {
                  setIsUserMenuOpen(false);
                  handleAction(() => onOpenUpgrade ? onOpenUpgrade() : onOpenSettings('billing'));
                }}
                className="w-full flex items-center gap-3 px-3 py-2 text-xs font-semibold text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800/80 rounded-xl transition-colors text-left cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>Upgrade plan</span>
              </button>

              {/* Personalization */}
              <button
                onClick={() => {
                  setIsUserMenuOpen(false);
                  handleAction(() => onOpenSettings('personality'));
                }}
                className="w-full flex items-center gap-3 px-3 py-2 text-xs font-semibold text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800/80 rounded-xl transition-colors text-left cursor-pointer"
              >
                <Sliders className="w-4 h-4 text-zinc-400 shrink-0" />
                <span>Personalization</span>
              </button>

              {/* Profile */}
              <button
                onClick={() => {
                  setIsUserMenuOpen(false);
                  handleAction(() => onOpenSettings('account'));
                }}
                className="w-full flex items-center gap-3 px-3 py-2 text-xs font-semibold text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800/80 rounded-xl transition-colors text-left cursor-pointer"
              >
                <User className="w-4 h-4 text-zinc-400 shrink-0" />
                <span>Profile</span>
              </button>

              {/* Settings */}
              <button
                onClick={() => {
                  setIsUserMenuOpen(false);
                  handleAction(() => onOpenSettings('display'));
                }}
                className="w-full flex items-center gap-3 px-3 py-2 text-xs font-semibold text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800/80 rounded-xl transition-colors text-left cursor-pointer"
              >
                <SettingsIcon className="w-4 h-4 text-zinc-400 shrink-0" />
                <span>Settings</span>
              </button>

              <div className="my-1 border-t border-zinc-100 dark:border-zinc-800/80" />

              {/* Support */}
              <button
                onClick={() => {
                  setIsUserMenuOpen(false);
                  handleAction(() => onOpenSupport ? onOpenSupport() : onOpenSettings('support'));
                }}
                className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800/80 rounded-xl transition-colors text-left cursor-pointer group/sup"
              >
                <div className="flex items-center gap-3">
                  <LifeBuoy className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Support & Contact</span>
                </div>
                <ChevronRight className="w-4 h-4 text-zinc-400 dark:text-zinc-500 group-hover/sup:text-zinc-700 dark:group-hover/sup:text-zinc-300 group-hover/sup:translate-x-0.5 transition-all" />
              </button>

              {/* Legal */}
              <button
                onClick={() => {
                  setIsUserMenuOpen(false);
                  handleAction(() => onShowLegal ? onShowLegal('about') : onOpenSettings('legal'));
                }}
                className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800/80 rounded-xl transition-colors text-left cursor-pointer group/leg"
              >
                <div className="flex items-center gap-3">
                  <ShieldCheck className="w-4 h-4 text-zinc-400 shrink-0" />
                  <span>Legal Policies</span>
                </div>
                <ChevronRight className="w-4 h-4 text-zinc-400 dark:text-zinc-500 group-hover/leg:text-zinc-700 dark:group-hover/leg:text-zinc-300 group-hover/leg:translate-x-0.5 transition-all" />
              </button>

              <div className="my-1 border-t border-zinc-100 dark:border-zinc-800/80" />

              {/* Log out */}
              <button
                onClick={() => {
                  setIsUserMenuOpen(false);
                  onLogout();
                }}
                className="w-full flex items-center gap-3 px-3 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400 rounded-xl transition-colors text-left cursor-pointer"
              >
                <LogOut className="w-4 h-4 text-zinc-400 shrink-0" />
                <span>Log out</span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Trigger Button Card */}
        <div
          onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
          className="w-full flex items-center justify-between p-2 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 transition-all cursor-pointer shadow-xs hover:shadow-md hover:border-zinc-300 dark:hover:border-zinc-700 select-none group"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-emerald-500 text-white font-extrabold text-xs flex items-center justify-center shrink-0 shadow-xs overflow-hidden">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                userInitials
              )}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-zinc-900 dark:text-white truncate max-w-[100px] sm:max-w-[120px]">{userName}</p>
              <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium truncate">{userPlan} Plan</p>
            </div>
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpenUpgrade ? onOpenUpgrade() : onOpenSettings('billing');
            }}
            className="px-3 py-1 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-900 dark:text-white font-bold text-[11px] rounded-full transition-all border border-zinc-200 dark:border-zinc-700/80 cursor-pointer shrink-0 ml-1 active:scale-95"
          >
            Upgrade
          </button>
        </div>
      </div>
    </motion.aside>
  );
};

