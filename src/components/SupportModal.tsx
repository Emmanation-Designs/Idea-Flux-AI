import React, { useState } from 'react';
import { X, Send, Mail, User, MessageSquareText, HelpCircle, Copy, Check, ExternalLink, LifeBuoy, Sparkles, MessageCircleCode } from 'lucide-react';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import type { Profile } from '../types';

export const SupportModal = ({ 
  profile,
  onClose 
}: { 
  profile?: Profile | null;
  onClose: () => void;
}) => {
  const [supportName, setSupportName] = useState(profile?.name || profile?.email?.split('@')[0] || '');
  const [supportEmail, setSupportEmail] = useState(profile?.email || '');
  const [category, setCategory] = useState<'general' | 'technical' | 'billing' | 'feedback'>('general');
  const [supportMessage, setSupportMessage] = useState('');
  const [copied, setCopied] = useState(false);

  const officialEmail = 'ingeniumvirtualassistant@zohomail.com';

  const handleCopyEmail = () => {
    navigator.clipboard.writeText(officialEmail);
    setCopied(true);
    toast.success('Support email copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendSupportEmail = (e: React.FormEvent) => {
    e.preventDefault();
    if (!supportMessage.trim()) {
      toast.error('Please write a message before sending.');
      return;
    }

    const categoryLabels = {
      general: 'General Inquiry',
      technical: 'Technical Support',
      billing: 'Billing & Subscriptions',
      feedback: 'Feature Request & Feedback'
    };

    const subject = `[${categoryLabels[category]}] Support Request from ${supportName || 'User'}`;
    const body = `Name: ${supportName}\nEmail: ${supportEmail}\nCategory: ${categoryLabels[category]}\n\nMessage:\n${supportMessage}`;

    const mailtoUrl = `mailto:${officialEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

    window.open(mailtoUrl, '_blank');
    toast.success('Opening email client...');
  };

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
        className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[2.25rem] w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] cursor-default"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 sm:px-8 py-5 border-b border-zinc-100 dark:border-zinc-800/80 shrink-0 bg-zinc-50/50 dark:bg-zinc-950/40">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center shadow-xs overflow-hidden shrink-0">
              <img src="/icon.png" alt="Trelvix AI Logo" className="w-full h-full object-cover" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-zinc-900 dark:text-white leading-tight">Help & Support</h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">Contact Trelvix AI Customer Assistance</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2.5 text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6">
          {/* Quick Info & Direct Email Banner */}
          <div className="bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-transparent border border-emerald-500/20 rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-xs font-extrabold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                Direct Email Assistance
              </span>
              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                24/7 Response Queue
              </span>
            </div>
            
            <div className="flex items-center justify-between gap-3 p-3 bg-white/80 dark:bg-zinc-950/80 rounded-xl border border-zinc-200/80 dark:border-zinc-800">
              <div className="flex items-center gap-2.5 min-w-0">
                <Mail className="w-4 h-4 text-emerald-500 shrink-0" />
                <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate">{officialEmail}</span>
              </div>
              <button
                onClick={handleCopyEmail}
                className="px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 shrink-0 cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>

          {/* Support Form */}
          <form onSubmit={handleSendSupportEmail} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Your Name</span>
                </label>
                <input
                  type="text"
                  required
                  value={supportName}
                  onChange={(e) => setSupportName(e.target.value)}
                  placeholder="Your Name"
                  className="w-full px-4 py-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs font-semibold text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
                />
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Email Address</span>
                </label>
                <input
                  type="email"
                  required
                  value={supportEmail}
                  onChange={(e) => setSupportEmail(e.target.value)}
                  placeholder="your.email@example.com"
                  className="w-full px-4 py-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs font-semibold text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
                />
              </div>
            </div>

            {/* Category selection */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                <HelpCircle className="w-3.5 h-3.5 text-zinc-400" />
                <span>Issue Category</span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: 'general', label: 'General' },
                  { id: 'technical', label: 'Technical' },
                  { id: 'billing', label: 'Billing' },
                  { id: 'feedback', label: 'Feedback' },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setCategory(item.id as any)}
                    className={`py-2 px-3 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                      category === item.id
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Message */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                <MessageSquareText className="w-3.5 h-3.5 text-zinc-400" />
                <span>Message</span>
              </label>
              <textarea
                required
                rows={4}
                value={supportMessage}
                onChange={(e) => setSupportMessage(e.target.value)}
                placeholder="Describe your question or issue in detail..."
                className="w-full p-3.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs font-medium text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all resize-none"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3.5 px-6 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md hover:shadow-emerald-500/20 flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
            >
              <Send className="w-4 h-4" />
              <span>Submit Support Ticket</span>
            </button>
          </form>

          {/* Company info footer */}
          <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between text-[11px] text-zinc-400 font-medium">
            <span>Operated by Ingenium Virtual Assistant Limited</span>
            <a
              href="https://www.ingeniumvirtualassistant.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-600 dark:text-emerald-400 font-bold hover:underline flex items-center gap-1"
            >
              <span>Visit Website</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
