import { X } from 'lucide-react';
import { motion } from 'motion/react';

export const LegalModal = ({ 
  type, 
  onClose 
}: { 
  type: 'about' | 'privacy' | 'terms'; 
  onClose: () => void 
}) => {
  const content = {
    about: {
      title: 'About Trelvix AI',
      body: (
        <div className="space-y-6 text-sm">
          <p className="opacity-80">
            Trelvix AI is a smart AI companion designed specifically for content creators. 
            Whether you're a YouTuber, TikToker, or social media manager, Trelvix AI helps you 
            generate viral ideas, high-retention scripts, and optimized hashtags in seconds.
          </p>
          <div className="space-y-2">
            <h4 className="font-bold text-zinc-900 dark:text-white text-base">Ownership</h4>
            <p className="font-medium">Owned by: Ingenium Virtual Assistant Limited</p>
            <p className="opacity-80">Registered in the United Kingdom</p>
            <p className="opacity-80">Focused on creative ideas and virtual services</p>
            <p>Website: <a href="https://www.ingeniumvirtualassistant.com" target="_blank" rel="noopener noreferrer" className="text-zinc-900 dark:text-white underline font-medium">www.ingeniumvirtualassistant.com</a></p>
          </div>
        </div>
      )
    },
    privacy: {
      title: 'Privacy Policy',
      body: (
        <div className="space-y-4 text-sm opacity-80">
          <p>Last updated: March 2026</p>
          <p>
            At Trelvix AI, we take your privacy seriously. This policy describes how we collect, 
            use, and protect your personal information.
          </p>
          <h4 className="font-bold text-zinc-900 dark:text-white">1. Information We Collect</h4>
          <p>We collect information you provide directly to us, such as when you create an account, use our AI services, or contact support.</p>
          <h4 className="font-bold text-zinc-900 dark:text-white">2. How We Use Your Information</h4>
          <p>We use your information to provide and improve our services, communicate with you, and ensure the security of our platform.</p>
          <h4 className="font-bold text-zinc-900 dark:text-white">3. Data Security</h4>
          <p>We implement industry-standard security measures to protect your data from unauthorized access or disclosure.</p>
        </div>
      )
    },
    terms: {
      title: 'Terms of Service',
      body: (
        <div className="space-y-4 text-sm opacity-80">
          <p>Last updated: March 2026</p>
          <p>
            By using Trelvix AI, you agree to be bound by these Terms of Service. 
            Please read them carefully.
          </p>
          <h4 className="font-bold text-zinc-900 dark:text-white">1. Acceptance of Terms</h4>
          <p>Your access to and use of the Service is conditioned on your acceptance of and compliance with these Terms.</p>
          <h4 className="font-bold text-zinc-900 dark:text-white">2. Use of Service</h4>
          <p>You agree to use the Service only for lawful purposes and in accordance with these Terms.</p>
          <h4 className="font-bold text-zinc-900 dark:text-white">3. Intellectual Property</h4>
          <p>The Service and its original content, features, and functionality are and will remain the exclusive property of Ingenium Virtual Assistant Limited.</p>
        </div>
      )
    }
  };

  const active = content[type];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[2.5rem] w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]"
      >
        <div className="flex items-center justify-between px-8 py-6 border-b border-zinc-100 dark:border-zinc-800 shrink-0">
          <h2 className="text-xl font-black uppercase tracking-tight">{active.title}</h2>
          <button onClick={onClose} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-all">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-8 md:p-12">
          {active.body}
        </div>
      </motion.div>
    </div>
  );
};
