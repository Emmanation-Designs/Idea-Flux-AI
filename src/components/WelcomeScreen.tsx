import React, { useRef, useEffect } from 'react';
import { 
  Plus, 
  Image as ImageIcon, 
  FileText, 
  Globe, 
  Mic, 
  ArrowUp,
  X,
  Film,
  Edit3
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ModelSelector from './ModelSelector';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface WelcomeScreenProps {
  input: string;
  setInput: (value: string) => void;
  sendMessage: (value?: string) => void;
  selectedModelId: string;
  onSelectModel: (modelId: string) => void;
  userPlan: 'free' | 'plus' | 'pro';
  onUpgradeClick: () => void;
  onUploadClick: () => void;
  selectedAttachment: any;
  clearAttachment: () => void;
  isLoading: boolean;
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  isTemporaryChat?: boolean;
  activeTag: string | null;
  setActiveTag: (tag: string | null) => void;
  handleInputChange: (value: string) => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  input,
  setInput,
  sendMessage,
  selectedModelId,
  onSelectModel,
  userPlan,
  onUpgradeClick,
  onUploadClick,
  selectedAttachment,
  clearAttachment,
  isLoading,
  textareaRef,
  isTemporaryChat = false,
  activeTag,
  setActiveTag,
  handleInputChange,
}) => {

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Backspace' && textareaRef.current && textareaRef.current.selectionStart === 0 && textareaRef.current.selectionEnd === 0 && activeTag) {
      e.preventDefault();
      setActiveTag(null);
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(activeTag ? `${activeTag} ${input}` : input);
    }
  };

  // Adjust input box height dynamically
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [input, textareaRef]);

  const handleActionClick = (actionType: 'image' | 'write' | 'search') => {
    let tag = '';
    if (actionType === 'image') tag = '@Image';
    if (actionType === 'write') tag = '@Write';
    if (actionType === 'search') tag = '@WebSearch';

    if (activeTag === tag) {
      return;
    }

    setActiveTag(tag);
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 100);
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-end pb-6 sm:justify-center p-4 md:p-8 w-full max-w-md sm:max-w-3xl mx-auto overflow-hidden animate-fade-in">
      
      {/* Container that dynamically swaps layout order on mobile vs desktop */}
      <div className="w-full flex flex-col gap-6 md:gap-7 max-w-sm sm:max-w-2xl relative z-30">
        
        {isTemporaryChat ? (
          <div className="text-center mb-2 animate-fade-in">
            <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 mb-3 font-sans">
              Temporary Chat
            </h1>
            <p className="text-xs md:text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed max-w-xl mx-auto font-normal">
              This chat won't appear in history or be used to train our models. For safety purposes, we may keep a copy of this chat for up to 30 days.
            </p>
          </div>
        ) : (
          /* Desktop Title Header (Hidden on Mobile) */
          <h1 className="hidden sm:block text-3xl md:text-4xl font-semibold tracking-tight text-center text-zinc-900 dark:text-zinc-50 mb-2 font-sans">
            Where should we begin?
          </h1>
        )}

        {/* Quick Actions List (Stacked vertically, left-aligned, matching style perfectly) - ABOVE prompt bar */}
        <div className="w-full flex flex-col gap-1 pl-1">
          
          {/* Card 1: Create an image */}
          <button
            onClick={() => handleActionClick('image')}
            className="flex items-center gap-3 text-left text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-100 hover:bg-zinc-100/50 dark:hover:bg-zinc-800/40 border border-transparent hover:border-zinc-200/20 dark:hover:border-zinc-800/20 px-3.5 py-2.5 rounded-2xl transition-all duration-200 select-none group w-full"
          >
            <div className="w-5 h-5 flex items-center justify-center shrink-0">
              <ImageIcon className="w-4.5 h-4.5 text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-800 dark:group-hover:text-zinc-200 transition-colors" />
            </div>
            <span className="text-xs sm:text-sm font-medium tracking-tight">Create an image</span>
          </button>

          {/* Card 2: Write or edit */}
          <button
            onClick={() => handleActionClick('write')}
            className="flex items-center gap-3 text-left text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-100 hover:bg-zinc-100/50 dark:hover:bg-zinc-800/40 border border-transparent hover:border-zinc-200/20 dark:hover:border-zinc-800/20 px-3.5 py-2.5 rounded-2xl transition-all duration-200 select-none group w-full"
          >
            <div className="w-5 h-5 flex items-center justify-center shrink-0">
              <Edit3 className="w-4.5 h-4.5 text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-800 dark:group-hover:text-zinc-200 transition-colors" />
            </div>
            <span className="text-xs sm:text-sm font-medium tracking-tight">Write or edit</span>
          </button>

          {/* Card 3: Look something up */}
          <button
            onClick={() => handleActionClick('search')}
            className="flex items-center gap-3 text-left text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-100 hover:bg-zinc-100/50 dark:hover:bg-zinc-800/40 border border-transparent hover:border-zinc-200/20 dark:hover:border-zinc-800/20 px-3.5 py-2.5 rounded-2xl transition-all duration-200 select-none group w-full"
          >
            <div className="w-5 h-5 flex items-center justify-center shrink-0">
              <Globe className="w-4.5 h-4.5 text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-800 dark:group-hover:text-zinc-200 transition-colors" />
            </div>
            <span className="text-xs sm:text-sm font-medium tracking-tight">Look something up</span>
          </button>
        </div>

        {/* Prompt Input Bar (Desktop or Mobile) */}
        <div className="w-full">
          {/* Attachment preview inside the input container frame */}
          <AnimatePresence>
            {selectedAttachment && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="mb-3 p-2 bg-zinc-100/80 dark:bg-zinc-800/50 rounded-2xl border border-zinc-200/50 dark:border-zinc-700/50 flex items-center justify-between"
              >
                <div className="flex items-center gap-2.5 overflow-hidden">
                  <div className="w-12 h-10 rounded-xl overflow-hidden bg-white dark:bg-zinc-850 flex items-center justify-center border border-zinc-200/60 dark:border-zinc-700/60 shadow-xs shrink-0">
                    {selectedAttachment.type === 'image' ? (
                      <img src={selectedAttachment.preview} alt="Attachment" className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-zinc-400">
                        {selectedAttachment.type === 'video' ? <Film className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200 truncate max-w-[150px]">
                      {selectedAttachment.file.name}
                    </span>
                    <span className="text-[10px] text-zinc-400 uppercase tracking-widest font-black">
                      {selectedAttachment.type}
                    </span>
                  </div>
                </div>
                <button 
                  onClick={clearAttachment}
                  className="p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 rounded-full transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Fully compliant styled pill matching images exactly */}
          <div className="bg-zinc-100 dark:bg-[#1E1F22] border border-zinc-200/40 dark:border-zinc-800/60 rounded-[24px] sm:rounded-[32px] shadow-lg focus-within:ring-2 focus-within:ring-zinc-900/5 dark:focus-within:ring-white/5 dark:focus-within:border-zinc-700 transition-all flex flex-col sm:flex-row sm:items-center px-3 py-2.5 sm:px-4 sm:py-2 min-h-[96px] sm:min-h-[60px] relative overflow-visible">
            
            {/* Input Row: Plus, Tag Pill, and Textarea */}
            <div className="flex-1 flex items-center gap-1.5 sm:gap-2 w-full min-w-0">
              {/* Left Plus button (visible on desktop only) */}
              <button 
                type="button"
                onClick={onUploadClick}
                className="hidden sm:flex p-2 text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 rounded-full hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50 transition-colors shrink-0"
                title="Upload file or attachment"
              >
                <Plus className="w-5 h-5 font-bold" />
              </button>

              {activeTag && (
                <div className="flex items-center gap-1 bg-zinc-200 dark:bg-zinc-800 border border-zinc-300/40 dark:border-zinc-700/40 text-zinc-800 dark:text-zinc-200 px-2.5 py-1 rounded-full text-xs font-semibold select-none shrink-0 animate-fade-in">
                  {activeTag === '@Image' && <ImageIcon className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />}
                  {activeTag === '@Write' && <Edit3 className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />}
                  {activeTag === '@WebSearch' && <Globe className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />}
                  <span>{activeTag}</span>
                  <button 
                    type="button"
                    onClick={() => setActiveTag(null)}
                    className="p-0.5 hover:bg-zinc-300 dark:hover:bg-zinc-700 rounded-full transition-colors ml-0.5"
                  >
                    <X className="w-3 h-3 text-zinc-500 dark:text-zinc-400" />
                  </button>
                </div>
              )}

              {/* Top row: Textarea */}
              <textarea
                ref={textareaRef}
                rows={1}
                value={input}
                onChange={(e) => handleInputChange(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={activeTag ? "" : "Ask anything"}
                className="flex-1 bg-transparent border-none outline-none focus:ring-0 resize-none px-1.5 py-1.5 sm:py-2 text-sm md:text-base text-zinc-900 dark:text-zinc-50 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 font-normal max-h-[120px] sm:max-h-[140px] leading-relaxed min-w-0"
              />
            </div>

            {/* Controls row: separate bottom row on mobile, inline on desktop */}
            <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto px-1 sm:px-0 mt-1.5 sm:mt-0 pt-2 sm:pt-0 border-t border-zinc-200/20 sm:border-t-0 shrink-0 gap-2">
              {/* Left Plus button (visible on mobile only) */}
              <button 
                type="button"
                onClick={onUploadClick}
                className="flex sm:hidden p-2 text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 rounded-full hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50 transition-colors shrink-0"
                title="Upload file or attachment"
              >
                <Plus className="w-5 h-5 font-bold" />
              </button>

              {/* Right container containing select, mic, and the brand green action button */}
              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                <ModelSelector 
                  selectedModelId={selectedModelId} 
                  userPlan={userPlan} 
                  onSelectModel={onSelectModel}
                  onUpgradeClick={onUpgradeClick}
                  variant="compact"
                />

                {/* Microphone Button */}
                <button
                  type="button"
                  className="p-2 text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 rounded-full hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50 transition-colors shrink-0"
                  title="Voice input"
                >
                  <Mic className="w-4 h-4" />
                </button>

                {/* Action Button: Brand Green Send button */}
                <button 
                  type="button"
                  onClick={() => sendMessage(activeTag ? `${activeTag} ${input}` : input)}
                  disabled={(!input.trim() && !selectedAttachment) || isLoading}
                  className={cn(
                    "w-9 h-9 rounded-full flex items-center justify-center transform active:scale-95 shrink-0 transition-all duration-200",
                    (input.trim() || selectedAttachment)
                      ? "bg-[#19C37D] hover:bg-[#15a86b] text-white shadow-md shadow-emerald-500/10" 
                      : "bg-zinc-200/50 dark:bg-zinc-800/50 text-zinc-400 dark:text-zinc-600 cursor-not-allowed border border-zinc-200/20 dark:border-zinc-800/20"
                  )}
                  title="Send message"
                >
                  <ArrowUp className="w-4 h-4 stroke-[2.5]" />
                </button>
              </div>
            </div>
          </div>
        </div>

      </div>
      
      {isTemporaryChat && (
        <div className="mt-8 text-[10px] sm:text-xs text-zinc-400 dark:text-zinc-600 font-normal tracking-wide text-center">
          For safety, we may keep a copy of this chat for up to 30 days.
        </div>
      )}
    </div>
  );
};
