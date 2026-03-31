export const Footer = ({ 
  onShowLegal 
}: { 
  onShowLegal: (type: 'about' | 'privacy' | 'terms') => void 
}) => {
  return (
    <footer className="w-full py-6 px-4 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-500 dark:text-zinc-400 text-xs text-center">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        <p>© 2026 Ingenium Virtual Assistant Limited</p>
        <div className="flex items-center gap-4">
          <button onClick={() => onShowLegal('about')} className="hover:text-zinc-900 dark:hover:text-white transition-colors">About</button>
          <button onClick={() => onShowLegal('privacy')} className="hover:text-zinc-900 dark:hover:text-white transition-colors">Privacy Policy</button>
          <button onClick={() => onShowLegal('terms')} className="hover:text-zinc-900 dark:hover:text-white transition-colors">Terms of Service</button>
        </div>
      </div>
    </footer>
  );
};
