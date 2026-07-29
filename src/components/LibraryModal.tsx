import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  X, 
  Search, 
  UploadCloud, 
  Sparkles, 
  Film, 
  Image as ImageIcon, 
  Mic, 
  Music, 
  FileText, 
  Download, 
  Copy, 
  Trash2, 
  Folder, 
  HardDrive, 
  Filter, 
  FileUp, 
  ExternalLink,
  Volume2,
  Layers,
  Check,
  Edit3,
  CopyPlus,
  Share2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import type { MediaFileItem, MediaType, LibrarySection } from '../types';
export type { MediaFileItem, MediaType, LibrarySection };
import { downloadFile } from '../utils/nativeCompat';
import { 
  fetchLibraryItems, 
  uploadLibraryFile, 
  deleteLibraryItem, 
  renameLibraryItem, 
  duplicateLibraryItem 
} from '../lib/libraryService';

interface LibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectFile?: (file: MediaFileItem) => void;
  extraGeneratedFiles?: MediaFileItem[];
}

type FilterType = 'all' | 'image' | 'video' | 'audio' | 'speech' | 'document' | 'pdf';

export const LibraryModal: React.FC<LibraryModalProps> = ({
  isOpen,
  onClose,
  onSelectFile,
  extraGeneratedFiles = []
}) => {
  const [activeTab, setActiveTab] = useState<LibrarySection>('uploaded');
  const [selectedFilter, setSelectedFilter] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [uploadedFiles, setUploadedFiles] = useState<MediaFileItem[]>([]);
  const [generatedFiles, setGeneratedFiles] = useState<MediaFileItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isUploading, setIsUploading] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load real library data from Supabase
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await fetchLibraryItems();
      setUploadedFiles(data.uploaded);

      // Merge extra generated files if provided
      const mergedGenerated = [...extraGeneratedFiles];
      const seen = new Set(mergedGenerated.map(g => g.id));
      data.generated.forEach(g => {
        if (!seen.has(g.id)) {
          seen.add(g.id);
          mergedGenerated.push(g);
        }
      });

      setGeneratedFiles(mergedGenerated);
    } catch (err) {
      console.error('Failed to load library items in modal:', err);
    } finally {
      setIsLoading(false);
    }
  }, [extraGeneratedFiles]);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, loadData]);

  // Upload file
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    const toastId = toast.loading('Uploading file...');
    try {
      const uploadedList: MediaFileItem[] = [];
      for (let i = 0; i < files.length; i++) {
        const item = await uploadLibraryFile(files[i], 'Library Modal');
        uploadedList.push(item);
      }
      setUploadedFiles(prev => [...uploadedList, ...prev]);
      setActiveTab('uploaded');
      toast.success('File uploaded successfully', { id: toastId });
    } catch (err) {
      toast.error('Failed to upload file', { id: toastId });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Delete
  const handleDelete = async (file: MediaFileItem, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteLibraryItem(file);
      if (file.category === 'uploaded') {
        setUploadedFiles(prev => prev.filter(f => f.id !== file.id));
      } else {
        setGeneratedFiles(prev => prev.filter(f => f.id !== file.id));
      }
      toast.success('Asset deleted');
    } catch (err) {
      toast.error('Failed to delete asset');
    }
  };

  if (!isOpen) return null;

  const currentTabFiles = activeTab === 'uploaded' ? uploadedFiles : generatedFiles;

  const filteredFiles = currentTabFiles.filter(file => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = file.name.toLowerCase().includes(q);
      const matchPrompt = file.prompt?.toLowerCase().includes(q);
      const matchModel = file.modelUsed?.toLowerCase().includes(q);
      if (!matchName && !matchPrompt && !matchModel) return false;
    }

    if (selectedFilter === 'image') return file.type === 'image';
    if (selectedFilter === 'video') return file.type === 'video';
    if (selectedFilter === 'audio') return file.type === 'audio';
    if (selectedFilter === 'speech') return file.type === 'speech';
    if (selectedFilter === 'document') return file.type === 'document';
    if (selectedFilter === 'pdf') return file.fileFormat?.toLowerCase() === 'pdf' || file.mimeType?.includes('pdf');

    return true;
  });

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileUpload} 
          className="hidden" 
          multiple 
          accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt"
        />

        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl max-w-5xl w-full h-[85vh] flex flex-col shadow-2xl overflow-hidden"
        >
          {/* HEADER */}
          <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-4 bg-zinc-50/50 dark:bg-zinc-950/50">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                <Folder className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-zinc-900 dark:text-white">
                  Media Library
                </h2>
                <p className="text-xs text-zinc-500">
                  Select an asset or upload new media from your device
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition-all shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <UploadCloud className="w-4 h-4" />
                <span>{isUploading ? 'Uploading...' : 'Upload File'}</span>
              </button>

              <button
                onClick={onClose}
                className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* CONTROLS BAR */}
          <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-zinc-900">
            {/* Tabs */}
            <div className="flex items-center bg-zinc-100 dark:bg-zinc-950 p-1 rounded-2xl border border-zinc-200 dark:border-zinc-800 w-full sm:w-auto">
              <button
                onClick={() => setActiveTab('uploaded')}
                className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                  activeTab === 'uploaded'
                    ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
                }`}
              >
                <FileUp className="w-3.5 h-3.5 text-emerald-500" />
                <span>Uploaded</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-200/60 dark:bg-zinc-700/60">
                  {uploadedFiles.length}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('generated')}
                className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                  activeTab === 'generated'
                    ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-purple-500" />
                <span>AI Generated</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-200/60 dark:bg-zinc-700/60">
                  {generatedFiles.length}
                </span>
              </button>
            </div>

            {/* Search */}
            <div className="relative w-full sm:w-72">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search assets..."
                className="w-full pl-9 pr-3 py-1.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs font-medium text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none"
              />
            </div>
          </div>

          {/* GRID CONTENT */}
          <div className="flex-1 p-6 overflow-y-auto">
            {isLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {[1, 2, 3, 4, 5, 6].map(i => (
                  <div key={i} className="h-44 bg-zinc-100 dark:bg-zinc-950 rounded-2xl animate-pulse" />
                ))}
              </div>
            ) : filteredFiles.length === 0 ? (
              <div className="text-center py-16 space-y-3">
                <Folder className="w-10 h-10 mx-auto text-zinc-400 opacity-60" />
                <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200">No files yet</p>
                <p className="text-xs text-zinc-500 max-w-xs mx-auto">
                  {activeTab === 'uploaded' ? 'Upload files to start building your library.' : 'AI generated assets will appear here automatically.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {filteredFiles.map(file => (
                  <div
                    key={`modal-file-${file.id}`}
                    onClick={() => {
                      if (onSelectFile) {
                        onSelectFile(file);
                        onClose();
                      }
                    }}
                    className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800/80 rounded-2xl p-3 hover:border-emerald-500/50 transition-all cursor-pointer group relative flex flex-col justify-between"
                  >
                    <div className="space-y-2">
                      <div className="w-full aspect-video rounded-xl bg-zinc-900 border border-zinc-800 overflow-hidden flex items-center justify-center relative">
                        {file.thumbnailUrl || (file.type === 'image' && file.url) ? (
                          <img src={file.thumbnailUrl || file.url} alt={file.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                        ) : file.type === 'video' ? (
                          <Film className="w-7 h-7 text-purple-400" />
                        ) : file.type === 'speech' || file.type === 'audio' ? (
                          <Volume2 className="w-7 h-7 text-emerald-400" />
                        ) : (
                          <FileText className="w-7 h-7 text-indigo-400" />
                        )}

                        <button
                          onClick={(e) => handleDelete(file, e)}
                          className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-red-600 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="space-y-0.5">
                        <h4 className="font-bold text-xs text-zinc-900 dark:text-white truncate">
                          {file.name}
                        </h4>
                        <div className="flex items-center justify-between text-[10px] text-zinc-500 font-mono">
                          <span>{file.size || file.type}</span>
                          <span>{new Date(file.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
