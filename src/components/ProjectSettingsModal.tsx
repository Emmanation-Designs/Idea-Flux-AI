import React, { useState, useEffect } from 'react';
import { 
  X as CloseIcon, 
  Folder, 
  Globe, 
  Briefcase, 
  GraduationCap, 
  User, 
  Sparkles, 
  Code, 
  BookOpen, 
  Rocket, 
  Zap,
  Loader2,
  Check
} from 'lucide-react';
import type { Project } from '../types';

interface ProjectSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project;
  onSave: (updates: { title: string; description: string; color: string; icon: string }) => Promise<void>;
}

const ICON_OPTIONS = [
  { name: 'Folder', icon: Folder },
  { name: 'Globe', icon: Globe },
  { name: 'Briefcase', icon: Briefcase },
  { name: 'GraduationCap', icon: GraduationCap },
  { name: 'User', icon: User },
  { name: 'Sparkles', icon: Sparkles },
  { name: 'Code', icon: Code },
  { name: 'BookOpen', icon: BookOpen },
  { name: 'Rocket', icon: Rocket },
  { name: 'Zap', icon: Zap },
];

const COLOR_OPTIONS = [
  { name: 'emerald', bg: 'bg-emerald-500', ring: 'ring-emerald-500' },
  { name: 'blue', bg: 'bg-blue-500', ring: 'ring-blue-500' },
  { name: 'purple', bg: 'bg-purple-500', ring: 'ring-purple-500' },
  { name: 'pink', bg: 'bg-pink-500', ring: 'ring-pink-500' },
  { name: 'amber', bg: 'bg-amber-500', ring: 'ring-amber-500' },
  { name: 'red', bg: 'bg-red-500', ring: 'ring-red-500' },
  { name: 'teal', bg: 'bg-teal-500', ring: 'ring-teal-500' },
  { name: 'indigo', bg: 'bg-indigo-500', ring: 'ring-indigo-500' },
  { name: 'zinc', bg: 'bg-zinc-500', ring: 'ring-zinc-500' },
];

export const ProjectSettingsModal: React.FC<ProjectSettingsModalProps> = ({
  isOpen,
  onClose,
  project,
  onSave
}) => {
  const [title, setTitle] = useState(project.title || '');
  const [description, setDescription] = useState(project.description || '');
  const [color, setColor] = useState(project.color || 'emerald');
  const [icon, setIcon] = useState(project.icon || 'Folder');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setTitle(project.title || '');
    setDescription(project.description || '');
    setColor(project.color || 'emerald');
    setIcon(project.icon || 'Folder');
  }, [project]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setIsSaving(true);
    try {
      await onSave({
        title: title.trim(),
        description: description.trim(),
        color,
        icon
      });
      onClose();
    } catch (err) {
      console.error('Failed to update project settings:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-lg bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl p-6 sm:p-8 space-y-6 relative overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-zinc-800">
          <div className="space-y-1">
            <h3 className="text-xl font-black text-zinc-900 dark:text-white tracking-tight">Project Settings</h3>
            <p className="text-xs text-zinc-500 font-medium">Customize your workspace details, icon, and accent theme.</p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-xl transition-all cursor-pointer"
          >
            <CloseIcon className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-zinc-400 mb-2">
              Project Name
            </label>
            <input 
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Workspace title..."
              required
              className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl px-4 py-3 text-sm text-zinc-900 dark:text-zinc-100 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-zinc-400 mb-2">
              Description
            </label>
            <textarea 
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this workspace used for?"
              rows={3}
              className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl px-4 py-3 text-sm text-zinc-900 dark:text-zinc-100 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all resize-none"
            />
          </div>

          {/* Icon Picker */}
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-zinc-400 mb-2">
              Icon
            </label>
            <div className="grid grid-cols-5 gap-2">
              {ICON_OPTIONS.map((item) => {
                const ItemIcon = item.icon;
                const isSelected = icon === item.name;
                return (
                  <button
                    key={`icon-opt-${item.name}`}
                    type="button"
                    onClick={() => setIcon(item.name)}
                    className={`flex items-center justify-center p-3 rounded-2xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-500/10 border-emerald-500 text-emerald-600 dark:text-emerald-400'
                        : 'bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                    }`}
                  >
                    <ItemIcon className="w-5 h-5" />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Color Picker */}
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-zinc-400 mb-2">
              Color Accent
            </label>
            <div className="flex items-center gap-3 flex-wrap">
              {COLOR_OPTIONS.map((c) => {
                const isSelected = color === c.name;
                return (
                  <button
                    key={`color-opt-${c.name}`}
                    type="button"
                    onClick={() => setColor(c.name)}
                    className={`w-8 h-8 rounded-full ${c.bg} flex items-center justify-center transition-all cursor-pointer ${
                      isSelected ? 'ring-4 ring-offset-2 ring-offset-white dark:ring-offset-zinc-950 ' + c.ring : 'opacity-80 hover:opacity-100'
                    }`}
                  >
                    {isSelected && <Check className="w-4 h-4 text-white" />}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-100 dark:border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-5 py-2.5 bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-2xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving || !title.trim()}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-2xl text-xs font-bold uppercase tracking-wider transition-all shadow-md hover:shadow-emerald-500/20 flex items-center gap-2 cursor-pointer"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>Save Changes</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
