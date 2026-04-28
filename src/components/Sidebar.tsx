import { 
  Plus, 
  Settings as SettingsIcon,
  X as CloseIcon,
  Image as ImageIcon,
  LayoutGrid,
  Zap,
  LogOut
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
  onNewChat,
  onOpenSettings,
  onOpenApps,
  onOpenImages,
  onLogout,
  activeView
}: { 
  isOpen: boolean; 
  setIsOpen: (open: boolean) => void;
  onNewChat: () => void;
  onOpenSettings: () => void;
  onOpenApps: () => void;
  onOpenImages: () => void;
  onLogout: () => void;
  activeView: string;
}) => {
  return (
    <motion.aside
      initial={false}
      animate={{ width: isOpen ? 260 : 0, opacity: isOpen ? 1 : 0 }}
      className={cn(
        "fixed lg:relative inset-y-0 left-0 z-40 bg-zinc-50 dark:bg-zinc-950 border-r border-zinc-200 dark:border-zinc-800 overflow-hidden flex flex-col transition-all duration-300 ease-in-out",
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

      <div className="flex-1 px-4 space-y-2 mt-4">
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

      <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 space-y-2">
        <button 
          onClick={onNewChat}
          className="w-full flex items-center justify-center gap-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 py-3 rounded-2xl font-black text-xs uppercase tracking-widest hover:opacity-90 transition-opacity shadow-lg shadow-black/5"
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

