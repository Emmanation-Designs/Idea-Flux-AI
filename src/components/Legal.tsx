import React, { useState } from 'react';
import { X, Shield, FileText, Info, Building2, ExternalLink } from 'lucide-react';
import { motion } from 'motion/react';

export const LegalModal = ({ 
  type = 'about', 
  onClose 
}: { 
  type?: 'about' | 'privacy' | 'terms'; 
  onClose: () => void 
}) => {
  const [activeTab, setActiveTab] = useState<'about' | 'privacy' | 'terms'>(type || 'about');

  return (
    <div 
      onClick={onClose}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 font-sans"
    >
      <motion.div 
        initial={{ scale: 0.94, opacity: 0, y: 15 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.94, opacity: 0, y: 15 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[2.25rem] w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[88vh] cursor-default"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 sm:px-8 py-5 border-b border-zinc-100 dark:border-zinc-800 shrink-0 bg-zinc-50/50 dark:bg-zinc-950/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 flex items-center justify-center shadow-xs">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-zinc-900 dark:text-white leading-tight">Legal & Governance</h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">Official Policies & Organization Terms</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2.5 text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 px-6 sm:px-8 pt-3 pb-2 border-b border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/30 dark:bg-zinc-950/30">
          <button
            onClick={() => setActiveTab('about')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'about' 
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20' 
                : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800'
            }`}
          >
            <Info className="w-3.5 h-3.5" />
            <span>About</span>
          </button>

          <button
            onClick={() => setActiveTab('privacy')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'privacy' 
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20' 
                : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Privacy Policy</span>
          </button>

          <button
            onClick={() => setActiveTab('terms')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'terms' 
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20' 
                : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Terms of Service</span>
          </button>
        </div>

        {/* Modal Content Body */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8">
          {activeTab === 'about' && (
            <div className="space-y-6 text-sm text-zinc-700 dark:text-zinc-300">
              <p className="leading-relaxed">
                Trelvix AI is a next-generation AI companion built for content creators, managers, and creative professionals. 
                Designed to deliver high-retention content ideas, script frameworks, multi-modal image generation, and intelligent automation.
              </p>

              <div className="p-5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200/80 dark:border-zinc-800 rounded-2xl space-y-3">
                <div className="flex items-center gap-2 text-zinc-900 dark:text-white font-extrabold text-base">
                  <Building2 className="w-4 h-4 text-emerald-500" />
                  <span>Corporate Entity</span>
                </div>
                <p className="font-semibold text-emerald-600 dark:text-emerald-400">Ingenium Virtual Assistant Limited</p>
                <p className="opacity-80 text-xs">Registered in the United Kingdom</p>
                <p className="opacity-80 text-xs">Specialized in creative artificial intelligence & virtual assistance services</p>
                <div className="pt-2 border-t border-zinc-200/60 dark:border-zinc-800/80">
                  <a 
                    href="https://www.ingeniumvirtualassistant.com" 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-zinc-900 dark:text-white hover:text-emerald-500 dark:hover:text-emerald-400 underline transition-colors"
                  >
                    <span>www.ingeniumvirtualassistant.com</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'privacy' && (
            <div className="space-y-4 text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">
              <p className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400">Effective Date: March 2026</p>
              <p>
                At Trelvix AI, operated by Ingenium Virtual Assistant Limited, we safeguard your data and respect your personal privacy.
              </p>
              <h4 className="font-bold text-zinc-900 dark:text-white pt-2">1. Data Collection</h4>
              <p>We collect account details (email, display name) and user-generated prompts to provide AI response generation and workspace storage.</p>
              <h4 className="font-bold text-zinc-900 dark:text-white pt-2">2. Data Usage</h4>
              <p>Your workspace data is stored securely to support chat history, image history, and account settings. We do not sell your personal data.</p>
              <h4 className="font-bold text-zinc-900 dark:text-white pt-2">3. Security Standards</h4>
              <p>We implement modern encryption and firewalls to protect all user accounts against unauthorized access.</p>
            </div>
          )}

          {activeTab === 'terms' && (
            <div className="space-y-4 text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">
              <p className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400">Effective Date: March 2026</p>
              <p>
                By accessing Trelvix AI, you agree to comply with these terms governed by Ingenium Virtual Assistant Limited.
              </p>
              <h4 className="font-bold text-zinc-900 dark:text-white pt-2">1. Acceptance</h4>
              <p>Your use of the services implies full agreement with these terms and conditions.</p>
              <h4 className="font-bold text-zinc-900 dark:text-white pt-2">2. Acceptable Use</h4>
              <p>You agree not to use Trelvix AI for illicit activities, hate speech, or automated scraping that disrupts system operations.</p>
              <h4 className="font-bold text-zinc-900 dark:text-white pt-2">3. Ownership & Content</h4>
              <p>Outputs generated through your account belong to you subject to model license guidelines. Software rights belong to Ingenium Virtual Assistant Limited.</p>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};
