import React, { useState, useEffect } from 'react';
import { 
  Brain, 
  Search, 
  Plus, 
  Trash2, 
  Edit3, 
  Archive, 
  RotateCcw, 
  Sparkles, 
  Check, 
  X, 
  ShieldAlert, 
  Briefcase, 
  User, 
  Code, 
  Folder, 
  Sliders, 
  Loader2,
  Info
} from 'lucide-react';
import type { UserMemory, MemoryCategory } from '../types';
import { 
  getUserMemories, 
  saveUserMemory, 
  updateUserMemory, 
  deleteUserMemory, 
  deleteAllUserMemories 
} from '../lib/memoryService';
import { toast } from 'sonner';

interface MemoryManagerProps {
  userId: string;
  isMemoryEnabled: boolean;
  onToggleMemoryEnabled: (enabled: boolean) => void;
}

const CATEGORIES: { id: string; label: string; icon: any }[] = [
  { id: 'all', label: 'All Memories', icon: Brain },
  { id: 'identity', label: 'Identity', icon: User },
  { id: 'work', label: 'Work', icon: Briefcase },
  { id: 'tech', label: 'Tech Stack', icon: Code },
  { id: 'preference', label: 'Preferences', icon: Sliders },
  { id: 'project', label: 'Projects', icon: Folder },
];

const IMPORTANCE_LABELS: Record<number, { label: string; bg: string; text: string }> = {
  1: { label: 'Low (Preference)', bg: 'bg-zinc-100 dark:bg-zinc-800', text: 'text-zinc-600 dark:text-zinc-400' },
  2: { label: 'Medium (Work)', bg: 'bg-blue-500/10', text: 'text-blue-600 dark:text-blue-400' },
  3: { label: 'High (Identity)', bg: 'bg-purple-500/10', text: 'text-purple-600 dark:text-purple-400' },
  4: { label: 'Critical (Core)', bg: 'bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400' },
};

export const MemoryManager: React.FC<MemoryManagerProps> = ({
  userId,
  isMemoryEnabled,
  onToggleMemoryEnabled
}) => {
  const [memories, setMemories] = useState<UserMemory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showArchived, setShowArchived] = useState(false);

  // Modals / Editing state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingMemory, setEditingMemory] = useState<UserMemory | null>(null);
  
  // Form fields
  const [memoryInput, setMemoryInput] = useState('');
  const [categoryInput, setCategoryInput] = useState<MemoryCategory>('general');
  const [importanceInput, setImportanceInput] = useState<number>(1);
  const [isSaving, setIsSaving] = useState(false);

  // Clear all confirmation
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  useEffect(() => {
    loadMemories();
  }, [userId, showArchived]);

  const loadMemories = async () => {
    if (!userId) return;
    setIsLoading(true);
    try {
      const data = await getUserMemories(userId, showArchived);
      setMemories(data);
    } catch (err) {
      console.error('Failed to load memories:', err);
      toast.error('Failed to load memories');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memoryInput.trim()) return;

    setIsSaving(true);
    try {
      const result = await saveUserMemory(
        userId,
        memoryInput.trim(),
        categoryInput,
        importanceInput
      );

      if (result.success) {
        toast.success(result.isDuplicate ? 'Memory updated' : 'Memory saved');
        setMemoryInput('');
        setIsAddModalOpen(false);
        loadMemories();
      } else {
        toast.error(result.error || 'Failed to save memory');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error saving memory');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateMemorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMemory || !memoryInput.trim()) return;

    setIsSaving(true);
    try {
      const updated = await updateUserMemory(userId, editingMemory.id, {
        memory: memoryInput.trim(),
        category: categoryInput,
        importance: importanceInput
      });

      if (updated) {
        toast.success('Memory updated');
        setEditingMemory(null);
        setMemoryInput('');
        loadMemories();
      } else {
        toast.error('Failed to update memory');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error updating memory');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (memoryId: string) => {
    try {
      const success = await deleteUserMemory(userId, memoryId);
      if (success) {
        toast.success('Memory deleted');
        setMemories(prev => prev.filter(m => m.id !== memoryId));
      } else {
        toast.error('Failed to delete memory');
      }
    } catch (err) {
      toast.error('Error deleting memory');
    }
  };

  const handleArchiveToggle = async (memory: UserMemory) => {
    try {
      const updated = await updateUserMemory(userId, memory.id, {
        archived: !memory.archived
      });
      if (updated) {
        toast.success(memory.archived ? 'Memory unarchived' : 'Memory archived');
        loadMemories();
      }
    } catch (err) {
      toast.error('Failed to archive memory');
    }
  };

  const handleClearAll = async () => {
    try {
      const success = await deleteAllUserMemories(userId);
      if (success) {
        toast.success('All memories deleted');
        setMemories([]);
        setShowClearConfirm(false);
      } else {
        toast.error('Failed to clear memories');
      }
    } catch (err) {
      toast.error('Error clearing memories');
    }
  };

  const openEditModal = (m: UserMemory) => {
    setEditingMemory(m);
    setMemoryInput(m.memory);
    setCategoryInput((m.category as MemoryCategory) || 'general');
    setImportanceInput(m.importance || 1);
  };

  const openAddModal = () => {
    setMemoryInput('');
    setCategoryInput('general');
    setImportanceInput(1);
    setIsAddModalOpen(true);
  };

  // Filter memories
  const filteredMemories = memories.filter(m => {
    const matchesSearch = m.memory.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (m.category || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || m.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6">
      {/* Header & Enable Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-2xl shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold shrink-0">
            <Brain className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-2">
              <span>Persistent Memory</span>
              <span className="text-[10px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                User Level
              </span>
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Allow Trelvix AI to remember your preferences, background, and tech stack across conversations.
            </p>
          </div>
        </div>

        {/* Toggle Switch */}
        <button
          onClick={() => onToggleMemoryEnabled(!isMemoryEnabled)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer shrink-0 ${
            isMemoryEnabled ? 'bg-emerald-600' : 'bg-zinc-300 dark:bg-zinc-700'
          }`}
          title={isMemoryEnabled ? 'Disable Memory' : 'Enable Memory'}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              isMemoryEnabled ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {/* Main Controls & Search */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search memories..."
              className="w-full pl-10 pr-9 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs font-medium text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setShowArchived(!showArchived)}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer flex items-center gap-1.5 ${
                showArchived
                  ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-zinc-900 dark:border-zinc-100'
                  : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300'
              }`}
            >
              <Archive className="w-3.5 h-3.5" />
              <span>{showArchived ? 'Include Archived' : 'Active Only'}</span>
            </button>

            <button
              onClick={openAddModal}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Memory</span>
            </button>
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {CATEGORIES.map(cat => {
            const Icon = cat.icon;
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={`cat-${cat.id}`}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
                  isSelected
                    ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                    : 'bg-white dark:bg-zinc-900/60 border border-zinc-200/80 dark:border-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Memory List */}
      {isLoading ? (
        <div className="py-12 flex flex-col items-center justify-center gap-2 text-zinc-400">
          <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
          <span className="text-xs font-medium">Loading memories...</span>
        </div>
      ) : filteredMemories.length === 0 ? (
        <div className="text-center py-12 px-6 bg-white dark:bg-zinc-900/40 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl space-y-3">
          <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-400 flex items-center justify-center mx-auto">
            <Brain className="w-5 h-5 opacity-60" />
          </div>
          <div className="space-y-1">
            <h4 className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
              {searchQuery ? 'No matching memories' : 'No memories saved yet'}
            </h4>
            <p className="text-[11px] text-zinc-500 max-w-sm mx-auto">
              {searchQuery
                ? 'Try adjusting your search or category filter.'
                : 'Trelvix AI automatically learns key facts from your chats, or you can add custom memories manually.'}
            </p>
          </div>
          {!searchQuery && (
            <button
              onClick={openAddModal}
              className="px-3.5 py-1.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 rounded-xl text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5 mt-2"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create First Memory</span>
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredMemories.map((item) => {
            const importanceInfo = IMPORTANCE_LABELS[item.importance] || IMPORTANCE_LABELS[1];
            return (
              <div
                key={`mem-${item.id}`}
                className={`p-4 bg-white dark:bg-zinc-900 border rounded-2xl transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 group ${
                  item.archived 
                    ? 'opacity-60 border-zinc-200/60 dark:border-zinc-800/60' 
                    : 'border-zinc-200/80 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
                }`}
              >
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${importanceInfo.bg} ${importanceInfo.text}`}>
                      {importanceInfo.label}
                    </span>
                    {item.category && (
                      <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-500 font-medium">
                        {item.category}
                      </span>
                    )}
                    {item.archived && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400">
                        Archived
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-medium text-zinc-900 dark:text-zinc-100 leading-relaxed break-words">
                    {item.memory}
                  </p>
                </div>

                <div className="flex items-center gap-1 shrink-0 self-end sm:self-center opacity-80 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => openEditModal(item)}
                    className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400 rounded-lg transition-all cursor-pointer"
                    title="Edit Memory"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => handleArchiveToggle(item)}
                    className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400 rounded-lg transition-all cursor-pointer"
                    title={item.archived ? 'Unarchive' : 'Archive'}
                  >
                    {item.archived ? <RotateCcw className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />}
                  </button>

                  <button
                    onClick={() => handleDelete(item.id)}
                    className="p-1.5 hover:bg-red-50 dark:hover:bg-red-950/30 text-red-500 rounded-lg transition-all cursor-pointer"
                    title="Delete Memory"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Clear All Section */}
      {memories.length > 0 && (
        <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
          <span className="text-xs text-zinc-400 font-mono">
            {memories.length} {memories.length === 1 ? 'memory' : 'memories'} stored
          </span>

          <button
            onClick={() => setShowClearConfirm(true)}
            className="text-xs font-bold text-red-500 hover:text-red-600 dark:hover:text-red-400 transition-colors flex items-center gap-1 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete All Memories</span>
          </button>
        </div>
      )}

      {/* Add / Edit Modal */}
      {(isAddModalOpen || editingMemory) && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
          onClick={() => {
            setIsAddModalOpen(false);
            setEditingMemory(null);
          }}
        >
          <div 
            className="w-full max-w-lg bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl p-6 space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <h3 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                <Brain className="w-4 h-4 text-emerald-500" />
                <span>{editingMemory ? 'Edit Memory' : 'Create New Memory'}</span>
              </h3>
              <button 
                onClick={() => {
                  setIsAddModalOpen(false);
                  setEditingMemory(null);
                }}
                className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-xl transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={editingMemory ? handleUpdateMemorySubmit : handleCreateMemory} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Memory Fact / Detail
                </label>
                <textarea
                  value={memoryInput}
                  onChange={(e) => setMemoryInput(e.target.value)}
                  placeholder="e.g. Uses React and TypeScript for frontend, prefers concise explanations..."
                  rows={3}
                  required
                  className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 text-xs text-zinc-900 dark:text-zinc-100 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                    Category
                  </label>
                  <select
                    value={categoryInput}
                    onChange={(e) => setCategoryInput(e.target.value as MemoryCategory)}
                    className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  >
                    <option value="identity">Identity</option>
                    <option value="work">Work</option>
                    <option value="tech">Tech Stack</option>
                    <option value="preference">Preference</option>
                    <option value="project">Project</option>
                    <option value="general">General</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                    Importance Level
                  </label>
                  <select
                    value={importanceInput}
                    onChange={(e) => setImportanceInput(Number(e.target.value))}
                    className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  >
                    <option value={1}>1 - Low (Preference)</option>
                    <option value={2}>2 - Medium (Work preference)</option>
                    <option value={3}>3 - High (Personal identity)</option>
                    <option value={4}>4 - Critical (Company / Primary project)</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setEditingMemory(null);
                  }}
                  disabled={isSaving}
                  className="px-4 py-2 bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 rounded-xl text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving || !memoryInput.trim()}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  <span>{editingMemory ? 'Save Changes' : 'Save Memory'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete All Confirmation Modal */}
      {showClearConfirm && (
        <div 
          className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
          onClick={() => setShowClearConfirm(false)}
        >
          <div 
            className="w-full max-w-md bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl p-6 space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 text-red-500">
              <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-950/40 flex items-center justify-center shrink-0">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-white">Delete All Memories?</h3>
                <p className="text-xs text-zinc-500">This action is permanent and cannot be reversed.</p>
              </div>
            </div>

            <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed bg-zinc-50 dark:bg-zinc-900 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800">
              Are you sure you want to clear all persistent long-term memories? The AI will forget all saved user details, preferences, and company facts.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="px-4 py-2 bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 rounded-xl text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleClearAll}
                className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer"
              >
                Clear Everything
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
