import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { getModel, canUseModel } from '../ai/modelCatalog';

interface ModelSelectorProps {
  selectedModelId: string;
  userPlan: 'free' | 'plus' | 'pro';
  onSelectModel: (modelId: string) => void;
  onUpgradeClick?: () => void;
  variant?: 'default' | 'compact';
}

export default function ModelSelector({
  selectedModelId,
  userPlan,
  onSelectModel,
  onUpgradeClick,
  variant = 'default',
}: ModelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const activeModel = getModel(selectedModelId);

  const modelItems = [
    {
      id: 'thinking',
      displayName: 'Thinking',
      description: 'For everyday chats',
    },
    {
      id: 'extendedThinking',
      displayName: 'Extended Thinking',
      description: 'More capable reasoning & coding',
    },
    {
      id: 'maximumThinking',
      displayName: 'Maximum Thinking',
      description: 'Highest intelligence & speed',
    }
  ];

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div className="relative inline-block text-left animate-fade-in" ref={dropdownRef} id="model-selector-container">
      {/* Target Trigger Button */}
      {variant === 'compact' ? (
        <button
          type="button"
          id="model-selector-trigger"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1 px-2.5 py-1.5 hover:bg-zinc-100/80 dark:hover:bg-zinc-800/50 rounded-xl text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 text-xs font-semibold transition-all duration-200 active:scale-95 focus:outline-none shrink-0"
        >
          <span className="truncate max-w-[120px]">{activeModel ? activeModel.displayName : 'Select'}</span>
          <ChevronDown className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500 transition-transform duration-200" style={{ transform: isOpen ? 'rotate(180deg)' : 'none' }} />
        </button>
      ) : (
        <button
          type="button"
          id="model-selector-trigger"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-900/60 dark:hover:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-800/80 rounded-xl text-zinc-700 dark:text-zinc-300 text-xs font-semibold shadow-xs transition-all duration-200 active:scale-95 focus:outline-none"
        >
          <span className="truncate max-w-[120px]">{activeModel ? activeModel.displayName : 'Select'}</span>
          <ChevronDown className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500 transition-transform duration-200" style={{ transform: isOpen ? 'rotate(180deg)' : 'none' }} />
        </button>
      )}

      {/* Dropdown Menu - Opens upwards */}
      {isOpen && (
        <div
          id="model-selector-dropdown"
          className="absolute bottom-full right-[-42px] sm:right-0 mb-2 w-72 max-w-[calc(100vw-32px)] rounded-2xl bg-white dark:bg-[#1E1F22] border border-zinc-200 dark:border-zinc-800/80 shadow-xl ring-1 ring-black/5 focus:outline-none z-50 overflow-hidden"
        >
          <div className="p-1.5">
            {/* Header style matching the image */}
            <div className="px-3 py-1.5 text-[10px] md:text-xs font-semibold text-zinc-400 dark:text-zinc-500 tracking-wider uppercase">
              Intelligence
            </div>
            
            <div className="space-y-1 mt-1">
              {modelItems.map((item) => {
                const isSelected = item.id === selectedModelId;
                const isLocked = !canUseModel(item.id, userPlan);

                return (
                  <button
                    key={item.id}
                    id={`model-option-${item.id}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      if (isLocked) {
                        onUpgradeClick?.();
                      } else {
                        onSelectModel(item.id);
                      }
                      setIsOpen(false);
                    }}
                    className={`w-full text-left flex items-center justify-between px-3 py-2 rounded-xl transition-all duration-150 ${
                      isSelected
                        ? 'bg-zinc-100 dark:bg-zinc-800/60 text-zinc-950 dark:text-zinc-50'
                        : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/30 text-zinc-700 dark:text-zinc-300'
                    }`}
                  >
                    <div className="flex flex-col pr-2">
                      <span className={`text-xs ${isSelected ? 'font-bold' : 'font-semibold'}`}>
                        {item.displayName}
                      </span>
                      <span className="text-[10px] md:text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5 line-clamp-1 font-normal">
                        {item.description}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {isLocked ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            onUpgradeClick?.();
                            setIsOpen(false);
                          }}
                          className="bg-[#19C37D]/15 hover:bg-[#19C37D]/25 text-[#19C37D] px-2.5 py-1 rounded-full text-[10px] font-bold transition-all duration-150 shrink-0 select-none cursor-pointer"
                        >
                          Upgrade
                        </button>
                      ) : (
                        isSelected && <Check className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
