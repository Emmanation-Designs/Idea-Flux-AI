import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Folder, 
  Search, 
  UploadCloud, 
  Film, 
  Image as ImageIcon, 
  Mic, 
  Music, 
  FileText, 
  Download, 
  Trash2, 
  HardDrive, 
  ArrowLeft, 
  Filter, 
  Sparkles, 
  Layers, 
  FileUp, 
  Check, 
  Copy, 
  Share2, 
  Edit3, 
  CopyPlus, 
  ExternalLink, 
  X, 
  Volume2, 
  SlidersHorizontal,
  ArrowUpDown,
  Clock,
  Sparkle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import type { Profile, MediaFileItem, MediaType, LibrarySection } from '../types';
import { downloadFile } from '../utils/nativeCompat';
import { 
  fetchLibraryItems, 
  uploadLibraryFile, 
  deleteLibraryItem, 
  renameLibraryItem, 
  duplicateLibraryItem 
} from '../lib/libraryService';

interface LibraryViewProps {
  profile?: Profile | null;
  onUpgradeClick?: () => void;
  onBack?: () => void;
}

type FilterType = 'all' | 'image' | 'video' | 'audio' | 'speech' | 'document' | 'pdf' | 'ai-image' | 'ai-voice' | 'ai-video';
type SortOrder = 'newest' | 'oldest' | 'size-desc' | 'size-asc';

export const LibraryView: React.FC<LibraryViewProps> = ({
  profile,
  onUpgradeClick,
  onBack
}) => {
  const [activeTab, setActiveTab] = useState<LibrarySection>('uploaded');
  const [selectedFilter, setSelectedFilter] = useState<FilterType>('all');
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [uploadedFiles, setUploadedFiles] = useState<MediaFileItem[]>([]);
  const [generatedFiles, setGeneratedFiles] = useState<MediaFileItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Modal / Action states
  const [previewingFile, setPreviewingFile] = useState<MediaFileItem | null>(null);
  const [renamingFile, setRenamingFile] = useState<MediaFileItem | null>(null);
  const [newNameInput, setNewNameInput] = useState('');
  const [isUploading, setIsUploading] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load real library items from Supabase & Storage
  const loadLibraryData = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await fetchLibraryItems();
      setUploadedFiles(data.uploaded);
      setGeneratedFiles(data.generated);
    } catch (err) {
      console.error('Failed to load library items:', err);
      toast.error('Failed to load library items from server.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLibraryData();
    const handleLibraryUpdated = () => {
      loadLibraryData();
    };
    window.addEventListener('library-updated', handleLibraryUpdated);
    return () => {
      window.removeEventListener('library-updated', handleLibraryUpdated);
    };
  }, [loadLibraryData]);

  // Handle local user file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    const toastId = toast.loading(`Uploading ${files.length} file(s)...`);

    try {
      const uploadedList: MediaFileItem[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.size > 50 * 1024 * 1024) {
          toast.error(`File "${file.name}" exceeds 50MB limit.`);
          continue;
        }
        const uploaded = await uploadLibraryFile(file, 'Library');
        uploadedList.push(uploaded);
      }

      setUploadedFiles(prev => [...uploadedList, ...prev]);
      setActiveTab('uploaded');
      toast.success(`Successfully uploaded ${uploadedList.length} asset(s) to Library`, { id: toastId });
    } catch (err) {
      console.error('Upload error:', err);
      toast.error('Failed to upload file. Please try again.', { id: toastId });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Delete item
  const handleDelete = async (file: MediaFileItem) => {
    try {
      await deleteLibraryItem(file);
      if (file.category === 'uploaded') {
        setUploadedFiles(prev => prev.filter(f => f.id !== file.id));
      } else {
        setGeneratedFiles(prev => prev.filter(f => f.id !== file.id));
      }
      if (previewingFile?.id === file.id) setPreviewingFile(null);
      toast.success(`Deleted "${file.name}"`);
    } catch (err) {
      console.error('Delete error:', err);
      toast.error(`Failed to delete "${file.name}"`);
    }
  };

  // Rename item
  const handleRenameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renamingFile || !newNameInput.trim()) return;

    const trimmed = newNameInput.trim();
    try {
      await renameLibraryItem(renamingFile, trimmed);
      const updateList = (items: MediaFileItem[]) =>
        items.map(f => f.id === renamingFile.id ? { ...f, name: trimmed } : f);

      if (renamingFile.category === 'uploaded') {
        setUploadedFiles(updateList);
      } else {
        setGeneratedFiles(updateList);
      }

      toast.success('Asset renamed successfully');
      setRenamingFile(null);
      setNewNameInput('');
    } catch (err) {
      console.error('Rename error:', err);
      toast.error('Failed to rename asset');
    }
  };

  // Duplicate item
  const handleDuplicate = async (file: MediaFileItem) => {
    try {
      const duplicated = await duplicateLibraryItem(file);
      if (file.category === 'uploaded') {
        setUploadedFiles(prev => [duplicated, ...prev]);
      } else {
        setGeneratedFiles(prev => [duplicated, ...prev]);
      }
      toast.success(`Created duplicate of "${file.name}"`);
    } catch (err) {
      console.error('Duplicate error:', err);
      toast.error('Failed to duplicate asset');
    }
  };

  // Download item
  const handleDownload = async (file: MediaFileItem) => {
    if (!file.url) {
      toast.error('Download link not available for this asset.');
      return;
    }
    try {
      await downloadFile(file.url, file.name, file.mimeType || 'application/octet-stream');
      toast.success(`Downloading ${file.name}...`);
    } catch (err) {
      console.error('Download error:', err);
      toast.error(`Failed to download ${file.name}`);
    }
  };

  // Copy public URL
  const handleCopyUrl = (file: MediaFileItem) => {
    const urlToCopy = file.shareableUrl || file.url;
    if (!urlToCopy) {
      toast.error('No public URL available for this file.');
      return;
    }
    navigator.clipboard.writeText(urlToCopy);
    toast.success('URL copied to clipboard!');
  };

  // Share item
  const handleShare = (file: MediaFileItem) => {
    const urlToShare = file.shareableUrl || file.url || window.location.href;
    if (navigator.share) {
      navigator.share({
        title: file.name,
        text: file.prompt || `Check out this asset on Trelvix AI: ${file.name}`,
        url: urlToShare
      }).catch(() => {
        handleCopyUrl(file);
      });
    } else {
      handleCopyUrl(file);
    }
  };

  // Active files list based on tab
  const currentTabFiles = activeTab === 'uploaded' ? uploadedFiles : generatedFiles;

  // Filter & Search logic
  const filteredFiles = currentTabFiles.filter(file => {
    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = file.name.toLowerCase().includes(q);
      const matchPrompt = file.prompt?.toLowerCase().includes(q);
      const matchModel = file.modelUsed?.toLowerCase().includes(q);
      const matchFeature = file.originatingFeature?.toLowerCase().includes(q);
      const matchFormat = file.fileFormat?.toLowerCase().includes(q);
      if (!matchName && !matchPrompt && !matchModel && !matchFeature && !matchFormat) return false;
    }

    // Filter type
    if (selectedFilter === 'image') return file.type === 'image';
    if (selectedFilter === 'video') return file.type === 'video';
    if (selectedFilter === 'audio') return file.type === 'audio';
    if (selectedFilter === 'speech') return file.type === 'speech';
    if (selectedFilter === 'document') return file.type === 'document';
    if (selectedFilter === 'pdf') return file.fileFormat?.toLowerCase() === 'pdf' || file.mimeType?.includes('pdf');
    if (selectedFilter === 'ai-image') return file.type === 'image' && file.category === 'generated';
    if (selectedFilter === 'ai-voice') return (file.type === 'speech' || file.type === 'audio') && file.category === 'generated';
    if (selectedFilter === 'ai-video') return file.type === 'video' && file.category === 'generated';

    return true;
  });

  // Sort logic
  const sortedFiles = [...filteredFiles].sort((a, b) => {
    if (sortOrder === 'newest') {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
    if (sortOrder === 'oldest') {
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    }
    if (sortOrder === 'size-desc') {
      return (b.size || '').localeCompare(a.size || '');
    }
    if (sortOrder === 'size-asc') {
      return (a.size || '').localeCompare(b.size || '');
    }
    return 0;
  });

  const getTypeBadge = (type: MediaType, generatorType?: string) => {
    if (generatorType) {
      if (generatorType.includes('Video')) return { label: 'AI Video', icon: Film, bg: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20' };
      if (generatorType.includes('Voice') || generatorType.includes('Speech')) return { label: 'AI Voice', icon: Mic, bg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' };
      if (generatorType.includes('Image')) return { label: 'AI Image', icon: ImageIcon, bg: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20' };
    }

    switch (type) {
      case 'video':
        return { label: 'Video', icon: Film, bg: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20' };
      case 'image':
        return { label: 'Image', icon: ImageIcon, bg: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20' };
      case 'speech':
        return { label: 'Speech', icon: Mic, bg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' };
      case 'audio':
        return { label: 'Audio', icon: Music, bg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' };
      case 'document':
        return { label: 'Document', icon: FileText, bg: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20' };
      default:
        return { label: 'File', icon: HardDrive, bg: 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20' };
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 overflow-y-auto overscroll-y-contain animate-fade-in">
      {/* Hidden File Input */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileUpload} 
        className="hidden" 
        multiple 
        accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt,.csv,.xlsx"
      />

      {/* STICKY TOP HEADER */}
      <div className="sticky top-0 z-20 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800/80 px-6 py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="p-2 bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-xl text-zinc-600 dark:text-zinc-400 transition-all cursor-pointer mr-1"
              title="Return to Chat"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}

          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
              <Folder className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
                Library
              </h1>
              <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                Global asset browser for uploaded media and AI-generated content
              </p>
            </div>
          </div>
        </div>

        {/* Top Right Action */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition-all shadow-sm hover:shadow-emerald-500/20 flex items-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
          >
            <UploadCloud className="w-4 h-4" />
            <span>{isUploading ? 'Uploading...' : 'Upload Files'}</span>
          </button>
        </div>
      </div>

      {/* MAIN CONTAINER */}
      <div className="max-w-7xl mx-auto w-full p-6 space-y-6 pb-24">
        
        {/* TABS & SEARCH BAR */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-4">
          
          {/* Main 2 Tabs */}
          <div className="flex items-center bg-zinc-100 dark:bg-zinc-900/90 p-1 rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 w-full sm:w-auto">
            <button
              onClick={() => {
                setActiveTab('uploaded');
                setSelectedFilter('all');
              }}
              className={`flex-1 sm:flex-initial px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'uploaded'
                  ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
            >
              <FileUp className="w-4 h-4 text-emerald-500" />
              <span>Uploaded Files</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-zinc-200/60 dark:bg-zinc-700/60 text-zinc-600 dark:text-zinc-300">
                {uploadedFiles.length}
              </span>
            </button>

            <button
              onClick={() => {
                setActiveTab('generated');
                setSelectedFilter('all');
              }}
              className={`flex-1 sm:flex-initial px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'generated'
                  ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
            >
              <Sparkles className="w-4 h-4 text-purple-500" />
              <span>AI Generated</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-zinc-200/60 dark:bg-zinc-700/60 text-zinc-600 dark:text-zinc-300">
                {generatedFiles.length}
              </span>
            </button>
          </div>

          {/* Search Input & Sort Dropdown */}
          <div className="flex flex-col sm:flex-row items-center gap-3 flex-1 max-w-xl">
            <div className="relative w-full flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={`Search ${activeTab === 'uploaded' ? 'uploaded files' : 'AI generated assets'} by name, prompt, or model...`}
                className="w-full pl-10 pr-9 py-2.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs font-medium text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
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

            {/* Sort Select */}
            <div className="relative w-full sm:w-auto shrink-0">
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as SortOrder)}
                className="w-full sm:w-auto px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs font-bold text-zinc-700 dark:text-zinc-300 focus:outline-none cursor-pointer"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="size-desc">Size (Largest)</option>
                <option value="size-asc">Size (Smallest)</option>
              </select>
            </div>
          </div>
        </div>

        {/* SECONDARY CATEGORY FILTERS */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
          <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mr-1 shrink-0 flex items-center gap-1">
            <Filter className="w-3 h-3" />
            Filter:
          </span>

          {[
            { id: 'all', label: 'All', icon: Layers },
            { id: 'image', label: 'Images', icon: ImageIcon },
            { id: 'video', label: 'Videos', icon: Film },
            { id: 'audio', label: 'Audio', icon: Music },
            { id: 'speech', label: 'Voice / Speech', icon: Mic },
            { id: 'document', label: 'Documents', icon: FileText },
            { id: 'pdf', label: 'PDFs', icon: FileText },
            ...(activeTab === 'generated' ? [
              { id: 'ai-image', label: 'AI Images', icon: Sparkles },
              { id: 'ai-voice', label: 'AI Voice', icon: Mic },
              { id: 'ai-video', label: 'AI Videos', icon: Film }
            ] : [])
          ].map(f => {
            const Icon = f.icon;
            const isSelected = selectedFilter === f.id;
            return (
              <button
                key={`filter-${f.id}`}
                onClick={() => setSelectedFilter(f.id as FilterType)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                  isSelected
                    ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 shadow-sm'
                    : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{f.label}</span>
              </button>
            );
          })}
        </div>

        {/* ASSET GRID / CONTENT AREA */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 py-8">
            {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
              <div key={i} className="h-56 bg-zinc-100 dark:bg-zinc-900 rounded-2xl animate-pulse p-4 space-y-3">
                <div className="w-full h-32 bg-zinc-200 dark:bg-zinc-800 rounded-xl" />
                <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-3/4" />
                <div className="h-3 bg-zinc-200 dark:bg-zinc-800 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : sortedFiles.length === 0 ? (
          /* EMPTY STATE */
          <div className="text-center py-20 px-6 bg-zinc-50/50 dark:bg-zinc-900/30 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-3xl space-y-4 max-w-md mx-auto my-8 animate-fade-in">
            <div className="w-14 h-14 rounded-2xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-400 flex items-center justify-center mx-auto">
              <Folder className="w-7 h-7 opacity-60" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                {searchQuery || selectedFilter !== 'all' ? 'No matching files found' : 'No files yet'}
              </h3>
              <p className="text-xs text-zinc-500 leading-relaxed max-w-xs mx-auto">
                {searchQuery || selectedFilter !== 'all'
                  ? 'Try clearing your search terms or choosing a different category filter.'
                  : activeTab === 'uploaded'
                    ? 'Upload images, audio clips, videos, or documents to manage them across your workspace.'
                    : 'AI-generated images, speech, and videos will appear in this section automatically when created.'}
              </p>
            </div>
            {activeTab === 'uploaded' && !searchQuery && (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition-all shadow-sm inline-flex items-center gap-2 cursor-pointer"
              >
                <UploadCloud className="w-4 h-4" />
                <span>Upload First File</span>
              </button>
            )}
          </div>
        ) : (
          /* ASSET CARDS GRID */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {sortedFiles.map((file) => {
              const badge = getTypeBadge(file.type, file.generatorType);
              const BadgeIcon = badge.icon;

              return (
                <div
                  key={`lib-item-${file.id}`}
                  className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 rounded-2xl p-4 transition-all duration-200 flex flex-col justify-between group relative shadow-xs hover:shadow-md hover:border-zinc-300 dark:hover:border-zinc-700"
                >
                  <div className="space-y-3">
                    {/* THUMBNAIL / PREVIEW AREA */}
                    <div 
                      onClick={() => setPreviewingFile(file)}
                      className="relative w-full aspect-video rounded-xl bg-zinc-950 border border-zinc-200/60 dark:border-zinc-800/60 overflow-hidden flex items-center justify-center cursor-pointer group/thumb"
                    >
                      {file.thumbnailUrl || (file.type === 'image' && file.url) ? (
                        <img 
                          src={file.thumbnailUrl || file.url} 
                          alt={file.name} 
                          className="w-full h-full object-cover group-hover/thumb:scale-105 transition-transform duration-300"
                        />
                      ) : file.type === 'video' ? (
                        <div className="flex flex-col items-center gap-2 text-purple-400">
                          <Film className="w-8 h-8 opacity-80 group-hover/thumb:scale-110 transition-transform" />
                          <span className="text-[10px] font-mono text-zinc-400">{file.duration || 'Video'}</span>
                        </div>
                      ) : file.type === 'speech' || file.type === 'audio' ? (
                        <div className="flex flex-col items-center gap-2 text-emerald-400">
                          <Volume2 className="w-8 h-8 opacity-80 group-hover/thumb:scale-110 transition-transform" />
                          <span className="text-[10px] font-mono text-zinc-400">{file.duration || 'Audio track'}</span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-2 text-indigo-400">
                          <FileText className="w-8 h-8 opacity-80 group-hover/thumb:scale-110 transition-transform" />
                          <span className="text-[10px] font-mono text-zinc-400">{file.fileFormat || 'Document'}</span>
                        </div>
                      )}

                      {/* Hover Overlay */}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-center justify-center gap-2 backdrop-blur-[2px]">
                        <span className="px-3 py-1 bg-white/20 hover:bg-white/30 text-white rounded-full text-xs font-bold backdrop-blur-md flex items-center gap-1.5">
                          <ExternalLink className="w-3.5 h-3.5" />
                          Open
                        </span>
                      </div>

                      {/* Type Badge */}
                      <div className="absolute top-2 left-2">
                        <span className={`px-2 py-0.5 rounded-md border text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 backdrop-blur-md bg-white/90 dark:bg-zinc-900/90 ${badge.bg}`}>
                          <BadgeIcon className="w-3 h-3" />
                          {badge.label}
                        </span>
                      </div>

                      {/* Originating feature or model badge */}
                      {(file.originatingFeature || file.modelUsed) && (
                        <div className="absolute bottom-2 right-2">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-medium bg-black/70 text-zinc-300 border border-white/10 backdrop-blur-md">
                            {file.originatingFeature || file.modelUsed}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* FILE METADATA */}
                    <div className="space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-bold text-sm text-zinc-900 dark:text-white line-clamp-1 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                          {file.name}
                        </h3>
                      </div>

                      {file.prompt && (
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2 leading-relaxed font-normal">
                          "{file.prompt}"
                        </p>
                      )}

                      <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400 pt-1">
                        <span>{file.size || 'Size N/A'}</span>
                        <span>{new Date(file.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* ACTION BAR FOR EVERY ASSET */}
                  <div className="pt-3 mt-3 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between gap-1">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 uppercase">
                      {file.fileFormat || file.type}
                    </span>

                    <div className="flex items-center gap-1">
                      {/* COPY URL */}
                      <button
                        onClick={() => handleCopyUrl(file)}
                        className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-lg transition-colors cursor-pointer"
                        title="Copy Public URL"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>

                      {/* RENAME */}
                      <button
                        onClick={() => {
                          setRenamingFile(file);
                          setNewNameInput(file.name);
                        }}
                        className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-lg transition-colors cursor-pointer"
                        title="Rename Asset"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>

                      {/* DUPLICATE */}
                      <button
                        onClick={() => handleDuplicate(file)}
                        className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-lg transition-colors cursor-pointer"
                        title="Duplicate Asset"
                      >
                        <CopyPlus className="w-3.5 h-3.5" />
                      </button>

                      {/* SHARE */}
                      <button
                        onClick={() => handleShare(file)}
                        className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-lg transition-colors cursor-pointer"
                        title="Share Asset"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                      </button>

                      {/* DOWNLOAD */}
                      <button
                        onClick={() => handleDownload(file)}
                        className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-emerald-600 dark:hover:text-emerald-400 rounded-lg transition-colors cursor-pointer"
                        title="Download Asset"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>

                      {/* DELETE */}
                      <button
                        onClick={() => handleDelete(file)}
                        className="p-1.5 hover:bg-red-50 dark:hover:bg-red-950/30 text-zinc-400 hover:text-red-500 rounded-lg transition-colors cursor-pointer"
                        title="Delete Asset"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* RENAME MODAL */}
      <AnimatePresence>
        {renamingFile && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
                <h3 className="font-bold text-base text-zinc-900 dark:text-white flex items-center gap-2">
                  <Edit3 className="w-4 h-4 text-emerald-500" />
                  <span>Rename Asset</span>
                </h3>
                <button
                  onClick={() => setRenamingFile(null)}
                  className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleRenameSubmit} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Filename / Title</label>
                  <input
                    type="text"
                    value={newNameInput}
                    onChange={(e) => setNewNameInput(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs font-semibold text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    placeholder="Enter new filename..."
                    autoFocus
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setRenamingFile(null)}
                    className="px-4 py-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold rounded-xl text-xs cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs shadow-sm cursor-pointer"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* FULL PREVIEW MODAL */}
      <AnimatePresence>
        {previewingFile && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-4 relative overflow-hidden"
            >
              <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                    {previewingFile.type}
                  </span>
                  <h3 className="font-bold text-base text-zinc-900 dark:text-white truncate max-w-sm">
                    {previewingFile.name}
                  </h3>
                </div>

                <button
                  onClick={() => setPreviewingFile(null)}
                  className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* MEDIA PREVIEW VIEWPORT */}
              <div className="bg-zinc-950 rounded-2xl overflow-hidden min-h-[220px] max-h-[400px] flex items-center justify-center relative">
                {previewingFile.type === 'video' && previewingFile.url ? (
                  <video src={previewingFile.url} controls autoPlay className="w-full max-h-[380px] object-contain" />
                ) : (previewingFile.type === 'image' || previewingFile.thumbnailUrl) && previewingFile.url ? (
                  <img src={previewingFile.url} alt={previewingFile.name} className="w-full max-h-[380px] object-contain" />
                ) : previewingFile.type === 'speech' || previewingFile.type === 'audio' ? (
                  <div className="p-8 text-center space-y-4 text-white">
                    <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                      <Volume2 className="w-8 h-8" />
                    </div>
                    <div>
                      <p className="font-bold text-sm">{previewingFile.name}</p>
                      <p className="text-xs text-zinc-400 font-mono mt-1">{previewingFile.duration || 'Audio track'}</p>
                    </div>
                    {previewingFile.url && (
                      <audio src={previewingFile.url} controls className="mx-auto max-w-sm w-full" />
                    )}
                  </div>
                ) : (
                  <div className="p-8 text-center space-y-3 text-zinc-400">
                    <FileText className="w-12 h-12 mx-auto text-indigo-400 opacity-80" />
                    <p className="text-xs font-medium text-zinc-300">{previewingFile.name}</p>
                    <p className="text-[11px] text-zinc-500 font-mono">Format: {previewingFile.fileFormat || 'Document'}</p>
                  </div>
                )}
              </div>

              {/* METADATA INFO */}
              {previewingFile.prompt && (
                <div className="p-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">Prompt / Description</span>
                  <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed">{previewingFile.prompt}</p>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between text-xs text-zinc-500 font-mono pt-2 gap-2">
                <span>Created: {new Date(previewingFile.createdAt).toLocaleString()}</span>
                <span>Size: {previewingFile.size || 'N/A'}</span>
                {previewingFile.originatingFeature && <span>Feature: {previewingFile.originatingFeature}</span>}
              </div>

              {/* FOOTER ACTIONS */}
              <div className="flex items-center justify-between border-t border-zinc-200 dark:border-zinc-800 pt-4">
                <button
                  onClick={() => handleCopyUrl(previewingFile)}
                  className="px-3 py-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-bold rounded-xl text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy URL</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPreviewingFile(null)}
                    className="px-4 py-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                  >
                    Close
                  </button>
                  <button
                    onClick={() => handleDownload(previewingFile)}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition-all shadow-sm flex items-center gap-2 cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download File</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
