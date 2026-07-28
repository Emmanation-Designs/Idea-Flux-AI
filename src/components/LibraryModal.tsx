import React, { useState, useRef } from 'react';
import { 
  X, 
  Search, 
  Upload, 
  UploadCloud, 
  Sparkles, 
  Film, 
  Image as ImageIcon, 
  Mic, 
  Music, 
  FileText, 
  Play, 
  Pause, 
  Download, 
  Copy, 
  Trash2, 
  Eye, 
  Check, 
  Folder, 
  HardDrive, 
  Clock, 
  Filter, 
  Plus, 
  FileUp, 
  ExternalLink,
  Volume2,
  VolumeX,
  FileCode,
  Tag,
  Layers
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

export type MediaType = 'video' | 'image' | 'speech' | 'audio' | 'document' | 'other';
export type LibrarySection = 'uploaded' | 'generated';

export interface MediaFileItem {
  id: string;
  name: string;
  type: MediaType;
  category: LibrarySection;
  createdAt: string;
  size?: string;
  url?: string;
  thumbnailUrl?: string;
  duration?: string;
  resolution?: string;
  prompt?: string;
  modelUsed?: string;
  fileFormat?: string;
}

interface LibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectFile?: (file: MediaFileItem) => void;
  extraGeneratedFiles?: MediaFileItem[];
}

// Initial mock data covering all media types across both Uploaded & Generated categories
const DEFAULT_FILES: MediaFileItem[] = [
  // GENERATED FILES
  {
    id: 'gen-1',
    name: 'Cyberpunk Tokyo Rainstorm',
    type: 'video',
    category: 'generated',
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    size: '18.4 MB',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    duration: '10s',
    resolution: '1080p',
    fileFormat: 'MP4',
    modelUsed: 'OpenAI Sora v1.0',
    prompt: 'A neon-lit cyberpunk street in Tokyo during a rainstorm, reflections on wet pavement, cinematic 8k'
  },
  {
    id: 'gen-2',
    name: 'Futuristic Alpine Sanctuary',
    type: 'image',
    category: 'generated',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    size: '4.2 MB',
    url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1200&q=80',
    thumbnailUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=400&q=80',
    resolution: '3840x2160',
    fileFormat: 'PNG',
    modelUsed: 'Trelvix Imagen 3',
    prompt: 'Ultra realistic alpine sanctuary surrounded by glowing auroras at dusk'
  },
  {
    id: 'gen-3',
    name: 'Product Launch Voiceover Narration',
    type: 'speech',
    category: 'generated',
    createdAt: new Date(Date.now() - 172800000).toISOString(),
    size: '1.8 MB',
    duration: '0:45',
    fileFormat: 'MP3',
    modelUsed: 'ElevenLabs v3 Custom Voice',
    prompt: 'Welcome to the future of AI video creation. Trelvix Video Studio empowers creators worldwide.'
  },
  {
    id: 'gen-4',
    name: 'Lo-Fi Chill Synth Ambient Loop',
    type: 'audio',
    category: 'generated',
    createdAt: new Date(Date.now() - 259200000).toISOString(),
    size: '8.1 MB',
    duration: '2:15',
    fileFormat: 'WAV',
    modelUsed: 'Suno Music v3.5',
    prompt: 'Relaxing lo-fi ambient electronic soundtrack with soft vinyl crackle'
  },
  {
    id: 'gen-5',
    name: 'Video Script & Shotlist Analysis',
    type: 'document',
    category: 'generated',
    createdAt: new Date(Date.now() - 345600000).toISOString(),
    size: '640 KB',
    fileFormat: 'PDF',
    modelUsed: 'Gemini 1.5 Pro',
    prompt: 'Generate scene breakdown and timing queue for 30s promo video'
  },

  // UPLOADED FILES
  {
    id: 'upl-1',
    name: 'Raw Drone B-Roll Footage.mp4',
    type: 'video',
    category: 'uploaded',
    createdAt: new Date(Date.now() - 7200000).toISOString(),
    size: '42.5 MB',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    duration: '15s',
    resolution: '4K 60fps',
    fileFormat: 'MP4'
  },
  {
    id: 'upl-2',
    name: 'Brand Logo Vector Dark.png',
    type: 'image',
    category: 'uploaded',
    createdAt: new Date(Date.now() - 120000000).toISOString(),
    size: '1.2 MB',
    url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80',
    resolution: '2048x2048',
    fileFormat: 'PNG'
  },
  {
    id: 'upl-3',
    name: 'Client Interview Audio Clip.m4a',
    type: 'speech',
    category: 'uploaded',
    createdAt: new Date(Date.now() - 200000000).toISOString(),
    size: '3.4 MB',
    duration: '1:30',
    fileFormat: 'M4A'
  },
  {
    id: 'upl-4',
    name: 'Background Cinematic Track.wav',
    type: 'audio',
    category: 'uploaded',
    createdAt: new Date(Date.now() - 300000000).toISOString(),
    size: '22.1 MB',
    duration: '3:40',
    fileFormat: 'WAV'
  },
  {
    id: 'upl-5',
    name: 'OpenAI Sora Motion Prompt Spec.pdf',
    type: 'document',
    category: 'uploaded',
    createdAt: new Date(Date.now() - 400000000).toISOString(),
    size: '2.1 MB',
    fileFormat: 'PDF'
  }
];

export const LibraryModal: React.FC<LibraryModalProps> = ({
  isOpen,
  onClose,
  onSelectFile,
  extraGeneratedFiles = []
}) => {
  const [activeSection, setActiveSection] = useState<LibrarySection>('uploaded');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<MediaType | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [files, setFiles] = useState<MediaFileItem[]>(DEFAULT_FILES);
  const [previewingFile, setPreviewingFile] = useState<MediaFileItem | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Combine default files with any newly generated files passed down
  const allFiles = React.useMemo(() => {
    const existingIds = new Set(files.map(f => f.id));
    const newItems = extraGeneratedFiles.filter(item => !existingIds.has(item.id));
    return [...newItems, ...files];
  }, [files, extraGeneratedFiles]);

  // Filter files by section, type, and search query
  const filteredFiles = allFiles.filter(file => {
    if (file.category !== activeSection) return false;
    if (selectedTypeFilter !== 'all' && file.type !== selectedTypeFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = file.name.toLowerCase().includes(q);
      const matchPrompt = file.prompt?.toLowerCase().includes(q);
      const matchModel = file.modelUsed?.toLowerCase().includes(q);
      const matchFormat = file.fileFormat?.toLowerCase().includes(q);
      if (!matchName && !matchPrompt && !matchModel && !matchFormat) return false;
    }
    return true;
  });

  // Upload handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFiles = e.target.files;
    if (!uploadedFiles || uploadedFiles.length === 0) return;

    Array.from(uploadedFiles).forEach(file => {
      let detectedType: MediaType = 'other';
      if (file.type.startsWith('video/')) detectedType = 'video';
      else if (file.type.startsWith('image/')) detectedType = 'image';
      else if (file.type.startsWith('audio/')) detectedType = 'audio';
      else if (file.type.includes('pdf') || file.type.includes('text') || file.type.includes('doc')) detectedType = 'document';

      const fileUrl = URL.createObjectURL(file);
      const sizeMb = (file.size / (1024 * 1024)).toFixed(1) + ' MB';

      const newItem: MediaFileItem = {
        id: `upl-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        name: file.name,
        type: detectedType,
        category: 'uploaded',
        createdAt: new Date().toISOString(),
        size: sizeMb,
        url: fileUrl,
        fileFormat: file.name.split('.').pop()?.toUpperCase() || 'FILE'
      };

      setFiles(prev => [newItem, ...prev]);
    });

    toast.success(`Successfully uploaded ${uploadedFiles.length} file(s) to Library`);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDeleteFile = (id: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFiles(prev => prev.filter(f => f.id !== id));
    if (previewingFile?.id === id) setPreviewingFile(null);
    toast.success(`Deleted "${name}" from Library`);
  };

  const getTypeBadge = (type: MediaType) => {
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

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 lg:p-8">
        
        {/* BACKDROP */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/60 backdrop-blur-md"
        />

        {/* MODAL DIALOG CONTAINER */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 12 }}
          className="relative w-full max-w-5xl h-[85vh] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden z-10"
        >
          {/* HEADER */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                <Folder className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                  <span>Media Library</span>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                    {allFiles.length} Items
                  </span>
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Manage uploaded assets and AI-generated outputs across video, image, speech, audio, and documents.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                multiple
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-sm transition-all"
              >
                <UploadCloud className="w-4 h-4" />
                <span>Upload Files</span>
              </button>

              <button
                onClick={onClose}
                className="p-2 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* NAVBAR SECTION TABS & SEARCH BAR */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 px-6 py-3 border-b border-zinc-100 dark:border-zinc-800/80 bg-white dark:bg-zinc-900">
            
            {/* 2 MAIN SECTIONS: Uploaded Files | Generated Files */}
            <div className="flex items-center p-1 bg-zinc-100 dark:bg-zinc-800/80 rounded-2xl w-full sm:w-auto">
              <button
                onClick={() => setActiveSection('uploaded')}
                className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  activeSection === 'uploaded'
                    ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'
                }`}
              >
                <UploadCloud className="w-3.5 h-3.5 text-indigo-500" />
                <span>Uploaded Files</span>
                <span className="ml-1 text-[10px] px-1.5 py-0.2 rounded-full bg-zinc-200 dark:bg-zinc-800">
                  {allFiles.filter(f => f.category === 'uploaded').length}
                </span>
              </button>

              <button
                onClick={() => setActiveSection('generated')}
                className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  activeSection === 'generated'
                    ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-purple-500" />
                <span>Generated Files</span>
                <span className="ml-1 text-[10px] px-1.5 py-0.2 rounded-full bg-zinc-200 dark:bg-zinc-800">
                  {allFiles.filter(f => f.category === 'generated').length}
                </span>
              </button>
            </div>

            {/* SEARCH INPUT */}
            <div className="relative flex-1 sm:max-w-xs">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search files, prompts, formats..."
                className="w-full pl-9 pr-3 py-1.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* MEDIA TYPE FILTER PILLS */}
          <div className="flex items-center gap-2 px-6 py-2.5 border-b border-zinc-100 dark:border-zinc-800/50 bg-zinc-50/40 dark:bg-zinc-950/40 overflow-x-auto no-scrollbar">
            <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 mr-1 flex items-center gap-1">
              <Filter className="w-3 h-3" /> Filter:
            </span>

            {[
              { id: 'all', label: 'All Media', icon: Layers },
              { id: 'video', label: 'Videos', icon: Film },
              { id: 'image', label: 'Images', icon: ImageIcon },
              { id: 'speech', label: 'Speech', icon: Mic },
              { id: 'audio', label: 'Audio', icon: Music },
              { id: 'document', label: 'Documents', icon: FileText },
            ].map((filter) => {
              const Icon = filter.icon;
              const isSelected = selectedTypeFilter === filter.id;
              return (
                <button
                  key={filter.id}
                  onClick={() => setSelectedTypeFilter(filter.id as MediaType | 'all')}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                    isSelected
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-white dark:bg-zinc-800/80 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{filter.label}</span>
                </button>
              );
            })}
          </div>

          {/* MAIN GRID WORKSPACE */}
          <div className="flex-1 overflow-y-auto p-6">
            {filteredFiles.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-4">
                <div className="w-16 h-16 rounded-3xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400">
                  <Folder className="w-8 h-8" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-200">
                    No files found in {activeSection === 'uploaded' ? 'Uploaded Files' : 'Generated Files'}
                  </h3>
                  <p className="text-xs text-zinc-500 max-w-sm">
                    {searchQuery
                      ? `No items matching "${searchQuery}". Try clearing your search.`
                      : activeSection === 'uploaded'
                      ? 'Upload videos, images, audio files or documents using the button above.'
                      : 'AI generated videos, images, speech, and documents will be saved here automatically.'}
                  </p>
                </div>
                {activeSection === 'uploaded' && (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Upload First File</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {filteredFiles.map((file) => {
                  const typeInfo = getTypeBadge(file.type);
                  const TypeIcon = typeInfo.icon;

                  return (
                    <motion.div
                      layout
                      key={file.id}
                      onClick={() => setPreviewingFile(file)}
                      className="group bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800/80 hover:border-indigo-500/50 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between space-y-3 relative overflow-hidden"
                    >
                      {/* PREVIEW CONTAINER */}
                      <div className="relative aspect-video rounded-xl bg-zinc-900 border border-zinc-800 overflow-hidden flex items-center justify-center group-hover:scale-[1.02] transition-transform">
                        {file.type === 'image' && (file.url || file.thumbnailUrl) ? (
                          <img
                            src={file.thumbnailUrl || file.url}
                            alt={file.name}
                            className="w-full h-full object-cover"
                          />
                        ) : file.type === 'video' && file.url ? (
                          <div className="relative w-full h-full flex items-center justify-center bg-black">
                            <video src={file.url} className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                              <Play className="w-6 h-6 text-white" />
                            </div>
                          </div>
                        ) : file.type === 'speech' || file.type === 'audio' ? (
                          <div className="w-full h-full bg-gradient-to-br from-zinc-900 to-indigo-950/60 p-4 flex flex-col items-center justify-center gap-2">
                            <TypeIcon className="w-8 h-8 text-indigo-400" />
                            <span className="text-[10px] font-mono font-bold text-indigo-300">
                              {file.duration || 'AUDIO'}
                            </span>
                          </div>
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-zinc-900 to-zinc-800 p-4 flex flex-col items-center justify-center gap-2">
                            <TypeIcon className="w-8 h-8 text-zinc-400" />
                            <span className="text-[10px] font-mono text-zinc-500 uppercase font-bold">
                              {file.fileFormat || 'DOC'}
                            </span>
                          </div>
                        )}

                        {/* TYPE BADGE */}
                        <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-md text-[9px] font-bold text-white flex items-center gap-1 uppercase tracking-wider">
                          <TypeIcon className="w-3 h-3" />
                          <span>{typeInfo.label}</span>
                        </div>

                        {/* HOVER OVERLAY ACTIONS */}
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 backdrop-blur-xs">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setPreviewingFile(file);
                            }}
                            className="p-2 rounded-xl bg-white/20 text-white hover:bg-white/40 transition-colors"
                            title="Preview File"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          
                          <button
                            onClick={(e) => handleDeleteFile(file.id, file.name, e)}
                            className="p-2 rounded-xl bg-red-500/30 text-red-200 hover:bg-red-500/50 transition-colors"
                            title="Delete File"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* FILE INFO */}
                      <div className="space-y-1.5 flex-1 flex flex-col justify-between">
                        <div>
                          <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                            {file.name}
                          </h4>
                          {file.prompt && (
                            <p className="text-[11px] text-zinc-500 line-clamp-2 mt-0.5 leading-snug">
                              &ldquo;{file.prompt}&rdquo;
                            </p>
                          )}
                        </div>

                        <div className="flex items-center justify-between text-[10px] text-zinc-400 font-mono pt-1 border-t border-zinc-100 dark:border-zinc-800/60">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-zinc-400" />
                            {new Date(file.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                          </span>
                          <span>{file.size || file.resolution || file.duration || file.fileFormat}</span>
                        </div>
                      </div>

                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>

          {/* PREVIEW MODAL / DRAWER IF FILE SELECTED */}
          <AnimatePresence>
            {previewingFile && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="absolute inset-x-0 bottom-0 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 p-6 shadow-2xl z-20 flex flex-col md:flex-row items-start md:items-center justify-between gap-6"
              >
                <div className="flex items-start gap-4 flex-1 min-w-0">
                  <div className="w-16 h-16 shrink-0 rounded-2xl bg-zinc-950 border border-zinc-800 flex items-center justify-center text-indigo-400 overflow-hidden">
                    {previewingFile.type === 'image' && previewingFile.url ? (
                      <img src={previewingFile.url} className="w-full h-full object-cover" />
                    ) : (
                      React.createElement(getTypeBadge(previewingFile.type).icon, { className: 'w-7 h-7' })
                    )}
                  </div>

                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold uppercase border ${getTypeBadge(previewingFile.type).bg}`}>
                        {previewingFile.type}
                      </span>
                      <span className="text-xs font-mono text-zinc-400">
                        {previewingFile.fileFormat || 'FILE'} • {previewingFile.size || 'N/A'}
                      </span>
                    </div>

                    <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 truncate">
                      {previewingFile.name}
                    </h3>

                    {previewingFile.prompt && (
                      <p className="text-xs text-zinc-500 line-clamp-1 italic">
                        Prompt: &ldquo;{previewingFile.prompt}&rdquo;
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto justify-end">
                  {onSelectFile && (
                    <button
                      onClick={() => {
                        onSelectFile(previewingFile);
                        toast.success(`Loaded "${previewingFile.name}" into studio`);
                        onClose();
                      }}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-sm transition-all flex items-center gap-1.5"
                    >
                      <Check className="w-4 h-4" />
                      <span>Use in Studio</span>
                    </button>
                  )}

                  <button
                    onClick={() => {
                      toast.info(`Downloading ${previewingFile.name}...`);
                    }}
                    className="px-4 py-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download</span>
                  </button>

                  <button
                    onClick={() => setPreviewingFile(null)}
                    className="p-2 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 rounded-xl"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

        </motion.div>

      </div>
    </AnimatePresence>
  );
};
