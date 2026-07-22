import React, { useState } from 'react';
import { Building2, X, Sparkles, Image, Link, Globe } from 'lucide-react';
import { useOrganization } from '../context/OrganizationContext';
import { organizationService } from '../lib/organizationService';

interface CreateOrganizationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CreateOrganizationModal: React.FC<CreateOrganizationModalProps> = ({ isOpen, onClose }) => {
  const { createOrganization } = useOrganization();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [slug, setSlug] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setName(val);
    setSlug(organizationService.generateSlug(val));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      setIsSubmitting(true);
      const created = await createOrganization(name.trim(), description.trim() || undefined, logoUrl.trim() || undefined);
      if (created) {
        setName('');
        setDescription('');
        setLogoUrl('');
        setSlug('');
        onClose();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="w-full max-w-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-800/80">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 flex items-center justify-center font-bold">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">Create Organization</h3>
              <p className="text-xs text-zinc-500">Collaborate with your team, share projects, and build together.</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1.5">
              Organization Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={handleNameChange}
              placeholder="e.g. Acme Corp or Design Team"
              className="w-full px-3.5 py-2.5 text-sm bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/70 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 text-zinc-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1.5">
              Organization Slug
            </label>
            <div className="relative flex items-center">
              <div className="absolute left-3.5 text-xs text-zinc-400 select-none flex items-center gap-1">
                <Globe className="w-3.5 h-3.5" />
                <span>trelvix.ai/org/</span>
              </div>
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                className="w-full pl-28 pr-3.5 py-2.5 text-sm bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/70 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 text-zinc-900 dark:text-white font-mono text-xs"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1.5">
              Description (Optional)
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does your team build?"
              className="w-full px-3.5 py-2.5 text-sm bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/70 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 text-zinc-900 dark:text-white resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1.5">
              Logo URL (Optional)
            </label>
            <div className="relative flex items-center">
              <Link className="w-4 h-4 absolute left-3.5 text-zinc-400" />
              <input
                type="url"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="https://example.com/logo.png"
                className="w-full pl-10 pr-3.5 py-2.5 text-sm bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/70 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 text-zinc-900 dark:text-white"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-zinc-100 dark:border-zinc-800/80">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || isSubmitting}
              className="px-5 py-2.5 text-xs font-semibold text-white bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 rounded-xl shadow-md disabled:opacity-50 transition-all"
            >
              {isSubmitting ? 'Creating...' : 'Create Organization'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
