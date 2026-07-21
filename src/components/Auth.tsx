import { useState, useEffect } from 'react';
import { 
  Eye, 
  EyeOff,
  Copy,
  ExternalLink,
  AlertTriangle,
  Check,
  X
} from 'lucide-react';
import { openExternalLink, isKodularEnv } from '../utils/nativeCompat';
import { motion } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const Auth = ({ onAuthSuccess, isDarkMode }: { onAuthSuccess: () => void; isDarkMode: boolean }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Fallback states for Android APK WebViews / Disallowed Useragent protection
  const [googleAuthUrl, setGoogleAuthUrl] = useState('');
  const [showFallback, setShowFallback] = useState(false);
  const [copied, setCopied] = useState(false);

  // Package configuration for automated App return
  const [customPackageId, setCustomPackageId] = useState(() => {
    return typeof localStorage !== 'undefined' 
      ? localStorage.getItem('trelvix_apk_package_id') || 'io.kodular.emmanuelnwaije21.trelvix_ai'
      : 'io.kodular.emmanuelnwaije21.trelvix_ai';
  });

  // Detect Android WebView/WebViewer or APK runtime environments
  const isWebView = typeof window !== 'undefined' && (
    /wv|WebView|InAppBrowser|Android.*Version\/[0-9.]+/i.test(navigator.userAgent) ||
    (window as any).Android !== undefined ||
    window.location.search.includes('apk=true') ||
    window.location.search.includes('webview=true')
  );

  // Detect if current session is loading in external Chrome browser as OAuth Redirect page
  const hasAccessToken = typeof window !== 'undefined' && window.location.hash.includes('access_token=');
  const isChromeCallback = !isWebView && hasAccessToken;

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success('Welcome back!');
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        toast.success('Account created! Please check your email.');
      }
      onAuthSuccess();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = () => {
    if (googleAuthUrl) {
      navigator.clipboard.writeText(googleAuthUrl);
      setCopied(true);
      toast.success('Google Sign-In link copied!');
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      // Fetch the explicit OAuth Redirection URL from Supabase safely without executing redirect in browser
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
          skipBrowserRedirect: true
        }
      });
      if (error) throw error;

      if (data?.url) {
        setGoogleAuthUrl(data.url);
        if (isWebView) {
          // If in an APK WebViewer context, render the Chrome external browser bypass helper
          setShowFallback(true);
          if (isKodularEnv()) {
            openExternalLink(data.url);
          }
        } else {
          // Normal desktop or mobile web browser: redirect directly
          window.location.href = data.url;
        }
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  // Auto-trigger secure Chrome launch for seamless experience inside Android App!
  useEffect(() => {
    if (showFallback && googleAuthUrl) {
      if (isKodularEnv()) {
        openExternalLink(googleAuthUrl);
        return;
      }

      const cleanUrl = googleAuthUrl.replace(/^https?:\/\//, '');
      const chromeIntentUrl = `intent://${cleanUrl}#Intent;scheme=https;package=com.android.chrome;end`;
      const genericIntentUrl = `intent://${cleanUrl}#Intent;scheme=https;end`;

      toast.info('Auto-opening Google Chrome...');
      
      // Attempt Chrome Intent first to bypass WebView sandboxing completely
      try {
        window.location.href = chromeIntentUrl;
      } catch (e) {
        try {
          window.location.href = genericIntentUrl;
        } catch (e2) {
          window.open(googleAuthUrl, '_system');
        }
      }

      // Automatically fallback to standard system browser handler if needed
      const t = setTimeout(() => {
        window.open(googleAuthUrl, '_blank');
      }, 600);

      return () => clearTimeout(t);
    }
  }, [showFallback, googleAuthUrl]);

  const handleLaunchApkSync = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('trelvix_apk_package_id', customPackageId);
      
      // Extract active auth token hash to sync session directly inside the APK WebViewer
      const hash = window.location.hash;
      const targetUrl = window.location.origin + '/' + hash;
      const cleanTargetUrl = targetUrl.replace(/^https?:\/\//, '');
      
      // Intent URL forces Google Chrome to pass auth session directly inside the specific APK WebViewer
      const intentUrl = `intent://${cleanTargetUrl}#Intent;scheme=https;package=${customPackageId};end`;
      
      toast.success('Syncing session back to Trelvix APK...');
      
      try {
        window.location.href = intentUrl;
      } catch (e) {
        window.open(targetUrl, '_system');
      }
    }
  };

  // Automated hands-free synchronization once Chrome secures the login
  useEffect(() => {
    if (isChromeCallback) {
      const timer = setTimeout(() => {
        handleLaunchApkSync();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [isChromeCallback]);

  if (isChromeCallback) {
    return (
      <div className="h-screen w-screen overflow-y-auto bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 relative">
        <div className="absolute inset-0 opacity-10 dark:opacity-25 pointer-events-none overflow-hidden">
          <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-emerald-500 rounded-full blur-[140px]" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-500 rounded-full blur-[140px]" />
        </div>

        <div className="min-h-full w-full flex items-center justify-center py-12 px-6 relative z-10">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[2.5rem] p-10 shadow-2xl flex flex-col text-center"
          >
          <div className="w-20 h-20 rounded-3xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 dark:text-emerald-400 flex items-center justify-center mx-auto mb-6 shadow-glow">
            <Check className="w-10 h-10 animate-bounce" />
          </div>

          <h2 className="text-2xl font-black text-zinc-900 dark:text-white mb-3">Google Login Secured</h2>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm mb-6 leading-relaxed">
            Your login has been verified. We are automatically launching Trelvix AI to sync your workspace profile.
          </p>

          <div className="w-full bg-white dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 mb-6 text-left">
            <label className="block text-[10px] uppercase font-black text-zinc-400 dark:text-zinc-500 tracking-wider mb-2">
              Android APK Package ID (Configurable)
            </label>
            <input 
              type="text"
              value={customPackageId}
              onChange={(e) => setCustomPackageId(e.target.value)}
              className="w-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-805 text-zinc-900 dark:text-white rounded-xl px-3 py-2 text-xs font-mono focus:ring-1 focus:ring-emerald-500 outline-none"
              placeholder="e.g. io.kodular.emmanuelnwaije21.trelvix_ai"
            />
            <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-1.5 leading-normal">
              Change this if your custom built Kodular App is using a different package scheme.
            </p>
          </div>

          <div className="space-y-3">
            <button
              type="button"
              onClick={handleLaunchApkSync}
              className="w-full py-4 bg-[#19C37D] hover:bg-[#15a86b] text-white rounded-xl font-bold text-sm shadow-lg active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
            >
              <ExternalLink className="w-5 h-5" />
              Sync & Launch Trelvix App
            </button>

            <p className="text-[11px] text-zinc-400 dark:text-zinc-500 animate-pulse">
              Launching automatically in 1 second...
            </p>
          </div>
          </motion.div>
        </div>
      </div>
    );
  }

  if (showFallback) {
    return (
      <div className="h-screen w-screen overflow-y-auto bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 relative">
        <div className="absolute inset-0 opacity-10 dark:opacity-20 pointer-events-none overflow-hidden">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-500 rounded-full blur-[120px]" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500 rounded-full blur-[120px]" />
        </div>

        <div className="min-h-full w-full flex items-center justify-center py-12 px-4 relative z-10">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[2.5rem] p-10 md:p-12 shadow-2xl flex flex-col items-center text-center"
          >
          <h2 className="text-xl font-black text-zinc-900 dark:text-white mb-2">Opening Google Chrome...</h2>
          
          <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed mb-6 max-w-[280px]">
            To comply with Google safety guidelines, Sign-In runs in external Chrome. You will be redirected back automatically.
          </p>

          <div className="w-full space-y-3">
            <a
              href={googleAuthUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => {
                if (isKodularEnv()) {
                  e.preventDefault();
                  openExternalLink(googleAuthUrl);
                } else {
                  toast.success('Launching secure system browser...');
                }
              }}
              className="w-full py-4 bg-[#19C37D] hover:bg-[#15a86b] text-white rounded-xl font-bold text-sm active:scale-[0.98] flex items-center justify-center gap-2 shadow-lg cursor-pointer"
            >
              <ExternalLink className="w-5 h-5 text-white" />
              Log In inside Chrome
            </a>

            <button
              onClick={() => {
                if (isKodularEnv()) {
                  openExternalLink(googleAuthUrl);
                } else {
                  const cleanUrl = googleAuthUrl.replace(/^https?:\/\//, '');
                  const chromeIntentUrl = `intent://${cleanUrl}#Intent;scheme=https;package=com.android.chrome;end`;
                  window.location.href = chromeIntentUrl;
                }
              }}
              className="w-full py-3 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-xl font-medium text-xs hover:bg-zinc-100 dark:hover:bg-zinc-750 transition-all border border-zinc-200 dark:border-zinc-700/50 cursor-pointer"
            >
              Force Launch Chrome Intent
            </button>

            <button
              type="button"
              onClick={() => {
                toast.info('Enabling manual credentials fallback');
                setShowFallback(false);
              }}
              className="w-full py-2.5 text-xs font-semibold text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
            >
              Cancel & Use Email Login
            </button>
          </div>
          
          <div className="border-t border-zinc-200 dark:border-zinc-800/60 mt-6 pt-5 w-full">
            <button
              onClick={() => {
                navigator.clipboard.writeText(googleAuthUrl);
                toast.success('Manual link copied!');
              }}
              className="inline-flex items-center gap-1.5 text-[10px] text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors font-medium decoration-dotted underline cursor-pointer"
            >
              <Copy className="w-3 h-3" />
              Stuck? Copy manual redirect URL
            </button>
          </div>
        </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen overflow-y-auto bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 relative">
      <div className="absolute inset-0 opacity-10 dark:opacity-20 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-500 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500 rounded-full blur-[120px]" />
      </div>

      <div className="min-h-full w-full flex items-center justify-center py-12 px-4 relative z-10">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[2.5rem] p-10 md:p-12 shadow-2xl"
        >
        <div className="flex flex-col items-center mb-10 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white mb-2">Trelvix AI</h1>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm font-medium leading-relaxed max-w-[240px]">The professional creative engine for high-fidelity content.</p>
        </div>

        <div className="space-y-3 mb-8">
          <button 
            type="button"
            onClick={handleGoogleSignIn}
            className="w-full flex items-center justify-center gap-3 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white border border-zinc-200 dark:border-zinc-700 py-3.5 rounded-xl font-bold text-sm hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-all active:scale-[0.98] shadow-lg cursor-pointer"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>


          
          <div className="flex items-center gap-4 py-2">
            <div className="flex-1 h-[1px] bg-zinc-200 dark:bg-zinc-800" />
            <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-600 uppercase tracking-widest whitespace-nowrap">or use email</span>
            <div className="flex-1 h-[1px] bg-zinc-200 dark:bg-zinc-800" />
          </div>
        </div>

        <form onSubmit={handleAuth} className="space-y-5">
          <div className="space-y-2">
            <label className="block text-xs font-bold text-zinc-500 ml-1">Email Address</label>
            <input 
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full bg-white dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-700/50 text-zinc-900 dark:text-white rounded-xl px-4 py-3.5 focus:ring-2 focus:ring-[#19C37D]/50 outline-none transition-all placeholder:text-zinc-400 dark:placeholder:text-zinc-600 shadow-inner"
              placeholder="name@example.com"
            />
          </div>
          <div className="space-y-2">
            <label className="block text-xs font-bold text-zinc-500 ml-1">Password</label>
            <div className="relative">
              <input 
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full bg-white dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-700/50 text-zinc-900 dark:text-white rounded-xl px-4 py-3.5 focus:ring-2 focus:ring-[#19C37D]/50 outline-none transition-all pr-12 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 shadow-inner"
                placeholder="••••••••"
              />
              <button 
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-600 hover:text-zinc-900 dark:hover:text-white transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-[#19C37D] hover:bg-[#15a86b] text-white rounded-xl font-bold text-sm transition-all disabled:opacity-50 shadow-lg shadow-emerald-500/10 active:scale-[0.98] mt-2 cursor-pointer"
          >
            {loading ? 'Initializing...' : (isLogin ? 'Sign In' : 'Create Account')}
          </button>
        </form>

        <div className="mt-8 text-center pt-6 border-t border-zinc-200 dark:border-zinc-800/50">
          <button 
            type="button"
            onClick={() => setIsLogin(!isLogin)}
            className="text-xs font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors"
          >
            {isLogin ? "Don't have an account? Sign Up" : 'Already have an account? Sign In'}
          </button>
        </div>
      </motion.div>
      </div>

    </div>
  );
};

