import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-[#0A0A0A] text-white font-sans">
          <div className="max-w-md w-full bg-zinc-900/50 backdrop-blur-xl p-8 rounded-[2.5rem] border border-white/10 shadow-2xl text-center">
            <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <span className="text-red-500 text-2xl">!</span>
            </div>
            <h2 className="text-2xl font-black mb-4 tracking-tight">Something went wrong</h2>
            <p className="text-zinc-400 mb-8 text-sm font-medium leading-relaxed">
              {this.state.error?.message || 'An unexpected error occurred in the application.'}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="w-full py-4 bg-white text-black rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-white/5"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
