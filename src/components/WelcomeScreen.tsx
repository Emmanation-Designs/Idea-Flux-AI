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
}) => {

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
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
    let text = '';
    if (actionType === 'image') text = 'Create an image of ';
    if (actionType === 'write') text = 'Help me write or edit ';
    if (actionType === 'search') text = 'Look up ';
    setInput(text);
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 100);
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-8 w-full max-w-3xl mx-auto overflow-hidden animate-fade-in">
      
      {/* Container that dynamically swaps layout order on mobile vs desktop */}
      <div className="w-full flex flex-col-reverse sm:flex-col gap-6 md:gap-8 max-w-2xl relative z-30">
        
        {/* Desktop Title Header (Hidden on Mobile) */}
        <h1 className="hidden sm:block text-3xl md:text-4xl font-semibold tracking-tight text-center text-zinc-900 dark:text-zinc-50 mb-2 font-sans">
          Where should we begin?
        </h1>

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
          <div className="bg-zinc-100 dark:bg-[#1E1F22] border border-zinc-200/40 dark:border-zinc-800/60 rounded-[32px] shadow-lg focus-within:ring-2 focus-within:ring-zinc-900/5 dark:focus-within:ring-white/5 dark:focus-within:border-zinc-700 transition-all flex items-center px-4 py-2.5 min-h-[60px] relative overflow-visible">
            
            {/* Left Plus button */}
            <button 
              type="button"
              onClick={onUploadClick}
              className="p-2 text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 rounded-full hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50 transition-colors shrink-0"
              title="Upload file or attachment"
            >
              <Plus className="w-5 h-5 font-bold" />
            </button>

            {/* Prompt textarea */}
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Message Trelvix AI..."
              className="flex-1 bg-transparent border-none outline-none focus:ring-0 resize-none px-3 py-2 text-sm md:text-base text-zinc-900 dark:text-zinc-50 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 font-normal max-h-[140px] leading-relaxed"
            />

            {/* Right container containing select, microphone and the brand green action button */}
            <div className="flex items-center gap-1.5 shrink-0 ml-1">
              <ModelSelector 
                selectedModelId={selectedModelId} 
                userPlan={userPlan} 
                onSelectModel={onSelectModel}
                onUpgradeClick={onUpgradeClick}
                variant="compact"
              />

              {/* Microphone button */}
              <button 
                type="button"
                className="p-2 text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 rounded-full hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50 transition-colors hidden sm:block"
                title="Voice Input"
              >
                <Mic className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
              </button>

              {/* Action Button: White circle on Desktop if input exists, Brand Green Wave/Send on Mobile/Empty */}
              {input.trim() || selectedAttachment ? (
                <button 
                  type="button"
                  onClick={() => sendMessage(input)}
                  disabled={isLoading}
                  className="w-9 h-9 rounded-full bg-white text-black dark:bg-white dark:text-zinc-900 shadow-md flex items-center justify-center transform active:scale-95 shrink-0 transition-all duration-200 hover:opacity-90"
                  title="Send message"
                >
                  <ArrowUp className="w-4 h-4 stroke-[2.5]" />
                </button>
              ) : (
                /* Soundwave button styled with brand green `#19C37D` */
                <button 
                  type="button"
                  className="w-9 h-9 rounded-full bg-[#19C37D] text-white flex items-center justify-center transform active:scale-95 shrink-0 transition-all duration-200 shadow-[0_4px_12px_rgba(25,195,125,0.2)]"
                  title="Voice waveform active"
                >
                  <div className="flex items-center gap-[2.5px] h-3.5">
                    <span className="w-[2px] h-2 bg-white rounded-full animate-pulse" />
                    <span className="w-[2px] h-3.5 bg-white rounded-full animate-pulse [animation-delay:0.15s]" />
                    <span className="w-[2px] h-2.5 bg-white rounded-full animate-pulse [animation-delay:0.3s]" />
                    <span className="w-[2px] h-1.5 bg-white rounded-full animate-pulse [animation-delay:0.45s]" />
                  </div>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Quick Actions List (Stacked vertically, left-aligned, matching style perfectly) */}
        <div className="w-full flex flex-col gap-3 pl-3 md:pl-4">
          
          {/* Card 1: Create an image */}
          <button
            onClick={() => handleActionClick('image')}
            className="flex items-center gap-3.5 text-left text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-100 transition-colors duration-200 select-none py-1 group w-fit"
          >
            <div className="w-5 h-5 flex items-center justify-center">
              <ImageIcon className="w-4.5 h-4.5 text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-800 dark:group-hover:text-zinc-200 transition-colors" />
            </div>
            <span className="text-xs sm:text-sm font-medium tracking-tight">Create an image</span>
          </button>

          {/* Card 2: Write or edit / soccer on mobile depending on size */}
          <button
            onClick={() => handleActionClick('write')}
            className="flex items-center gap-3.5 text-left text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-100 transition-colors duration-200 select-none py-1 group w-fit"
          >
            <div className="w-5 h-5 flex items-center justify-center">
              {/* Show soccer ball on small screens (Image 2 style), pencil on large screens */}
              <span className="sm:hidden text-base leading-none">⚽</span>
              <Edit3 className="hidden sm:block w-4.5 h-4.5 text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-800 dark:group-hover:text-zinc-200 transition-colors" />
            </div>
            <span className="text-xs sm:text-sm font-medium tracking-tight sm:block hidden">Write or edit</span>
            <span className="text-xs sm:text-sm font-medium tracking-tight sm:hidden block">Follow the World Cup</span>
          </button>

          {/* Card 3: Look something up */}
          <button
            onClick={() => handleActionClick('search')}
            className="flex items-center gap-3.5 text-left text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-100 transition-colors duration-200 select-none py-1 group w-fit"
          >
            <div className="w-5 h-5 flex items-center justify-center">
              <Globe className="w-4.5 h-4.5 text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-800 dark:group-hover:text-zinc-200 transition-colors" />
            </div>
            <span className="text-xs sm:text-sm font-medium tracking-tight">Look something up</span>
          </button>
        </div>

      </div>
    </div>
  );
};
