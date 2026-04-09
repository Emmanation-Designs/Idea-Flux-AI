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
      title: 'About Ideaflux AI',
      body: (
        <div className="space-y-6 text-sm">
          <p className="opacity-80">
            Ideaflux AI is a smart AI companion designed specifically for content creators. 
            Whether you're a YouTuber, TikToker, or social media manager, Ideaflux AI helps you 
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
            At Ideaflux AI, we take your privacy seriously. This policy describes how we collect, 
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
            By using Ideaflux AI, you agree to be bound by these Terms of Service. 
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-2xl p-6 shadow-2xl max-h-[80vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-6 sticky top-0 bg-white dark:bg-zinc-900 pb-4 border-b border-zinc-200 dark:border-zinc-800">
          <h2 className="text-xl font-bold">{active.title}</h2>
          <button onClick={onClose} className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div>
          {active.body}
        </div>
      </motion.div>
    </div>
  );
};
