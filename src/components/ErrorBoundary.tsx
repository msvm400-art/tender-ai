import React, { ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error caught by React ErrorBoundary:", error, errorInfo);
    this.setState({
      error,
      errorInfo
    });
  }

  private handleReset = () => {
    try {
      localStorage.clear();
    } catch (e) {
      console.warn("localStorage clear failed in ErrorBoundary:", e);
    }
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 font-sans">
          <div className="max-w-xl w-full bg-white rounded-3xl border border-slate-200 p-8 md:p-10 shadow-xl space-y-6 text-center">
            {/* Visual Warning Shield element */}
            <div className="mx-auto w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center border border-red-100 shadow-sm animate-pulse">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">System Safe-Mode Activated</h1>
              <p className="text-sm text-slate-550 leading-relaxed max-w-md mx-auto">
                An unexpected interface rendering exception was safely intercepted. We've placed the workspace in clean safe-mode to prevent data corruption.
              </p>
            </div>

            {/* Error diagnostics disclosure */}
            {this.state.error && (
              <div className="text-left bg-slate-900 rounded-2xl p-5 border border-slate-950 overflow-hidden shadow-inner">
                <div className="flex items-center justify-between border-b border-white/5 pb-2 mb-2">
                  <span className="text-[10px] font-extrabold text-lime-400 font-mono tracking-wider uppercase">Diagnostics Terminal</span>
                  <span className="text-[9px] text-slate-500 font-mono">React v18+ Intercept</span>
                </div>
                <div className="max-h-40 overflow-auto font-mono text-xs text-[#22C55E]/90 whitespace-pre-wrap divide-y divide-white/5 space-y-2 select-text">
                  <p className="font-extrabold text-white">Error: {this.state.error.message}</p>
                  {this.state.errorInfo && (
                    <p className="text-[10px] text-slate-400 pt-2 leading-normal">
                      Component Stack: {this.state.errorInfo.componentStack}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Control buttons */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center items-center pt-2">
              <button
                type="button"
                onClick={this.handleReset}
                className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-extrabold text-xs px-6 py-3 rounded-xl transition-all cursor-pointer shadow-md shadow-blue-200 active:scale-95 text-nowrap"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Reset & Refresh Sandbox</span>
              </button>
              
              <button
                type="button"
                onClick={() => window.location.href = "/"}
                className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 bg-slate-50 hover:bg-slate-100 text-slate-705 font-bold text-xs px-6 py-3 rounded-xl transition-all border border-slate-205 cursor-pointer text-nowrap"
              >
                <Home className="w-4 h-4" />
                <span>Return Home</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
