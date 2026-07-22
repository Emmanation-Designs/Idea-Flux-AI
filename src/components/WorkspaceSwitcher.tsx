import React, { useState, useRef, useEffect } from 'react';
import { 
  Building2, 
  User, 
  ChevronDown, 
  Plus, 
  Check, 
  Settings, 
  Users, 
  Sparkles,
  Shield,
  Layers
} from 'lucide-react';
import { useOrganization } from '../context/OrganizationContext';
import { CreateOrganizationModal } from './CreateOrganizationModal';

interface WorkspaceSwitcherProps {
  onOpenOrgSettings?: () => void;
}

export const WorkspaceSwitcher: React.FC<WorkspaceSwitcherProps> = ({ onOpenOrgSettings }) => {
  const { currentWorkspace, userOrganizations, switchWorkspace } = useOrganization();
  const [isOpen, setIsOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isPersonal = currentWorkspace.type === 'personal';
  const activeOrg = currentWorkspace.organization;

  return (
    <div className="relative w-full px-3 pt-2 pb-3 border-b border-zinc-200/80 dark:border-zinc-800/80" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-2 rounded-xl bg-zinc-100 hover:bg-zinc-200/80 dark:bg-zinc-900 dark:hover:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-800 transition-all text-left group"
        title="Switch Workspace"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 font-bold text-xs shadow-sm transition-transform group-hover:scale-105 bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900">
            {isPersonal ? (
              <User className="w-4 h-4" />
            ) : activeOrg?.logo_url ? (
              <img src={activeOrg.logo_url} alt={activeOrg.name} className="w-full h-full rounded-lg object-cover" />
            ) : (
              (activeOrg?.name || 'O').charAt(0).toUpperCase()
            )}
          </div>

          <div className="flex flex-col min-w-0">
            <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">
              {isPersonal ? 'Personal Workspace' : activeOrg?.name}
            </span>
            <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium tracking-wide uppercase flex items-center gap-1">
              {isPersonal ? (
                'Private'
              ) : (
                <>
                  <Users className="w-2.5 h-2.5 inline" /> Team Workspace
                </>
              )}
            </span>
          </div>
        </div>

        <ChevronDown className={`w-4 h-4 text-zinc-400 transition-transform duration-200 shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-full left-3 right-3 mt-1.5 z-50 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl py-1.5 max-h-80 overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
          {/* Section: Personal */}
          <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
            Workspaces
          </div>

          <button
            onClick={() => {
              switchWorkspace({ type: 'personal', organization: null });
              setIsOpen(false);
            }}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
              isPersonal 
                ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white' 
                : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-6 h-6 rounded-md bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center shrink-0">
                <User className="w-3.5 h-3.5 text-zinc-700 dark:text-zinc-300" />
              </div>
              <span className="truncate">Personal Workspace</span>
            </div>
            {isPersonal && <Check className="w-4 h-4 text-zinc-900 dark:text-zinc-100 shrink-0" />}
          </button>

          {/* Section: Organizations */}
          {userOrganizations.length > 0 && (
            <>
              <div className="my-1 border-t border-zinc-100 dark:border-zinc-800/60" />
              <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 flex items-center justify-between">
                <span>Organizations</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500">
                  {userOrganizations.length}
                </span>
              </div>

              {userOrganizations.map((org) => {
                const isActive = !isPersonal && activeOrg?.id === org.id;
                return (
                  <button
                    key={org.id}
                    onClick={() => {
                      switchWorkspace({ type: 'organization', organization: org });
                      setIsOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                      isActive 
                        ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white' 
                        : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-6 h-6 rounded-md bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 flex items-center justify-center font-bold text-[10px] shrink-0">
                        {org.logo_url ? (
                          <img src={org.logo_url} alt={org.name} className="w-full h-full rounded-md object-cover" />
                        ) : (
                          org.name.charAt(0).toUpperCase()
                        )}
                      </div>
                      <span className="truncate">{org.name}</span>
                    </div>
                    {isActive && <Check className="w-4 h-4 text-zinc-900 dark:text-zinc-100 shrink-0" />}
                  </button>
                );
              })}
            </>
          )}

          {/* Action Buttons */}
          <div className="my-1 border-t border-zinc-100 dark:border-zinc-800/60" />

          {!isPersonal && onOpenOrgSettings && (
            <button
              onClick={() => {
                setIsOpen(false);
                onOpenOrgSettings();
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 rounded-lg transition-colors"
            >
              <Settings className="w-4 h-4 text-zinc-500" />
              <span>Organization Settings</span>
            </button>
          )}

          <button
            onClick={() => {
              setIsOpen(false);
              setIsCreateModalOpen(true);
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Create Organization</span>
          </button>
        </div>
      )}

      {/* Create Organization Modal */}
      <CreateOrganizationModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />
    </div>
  );
};
