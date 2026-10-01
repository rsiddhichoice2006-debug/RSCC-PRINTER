import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, ArrowLeft, ShieldCheck } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  declare props: Readonly<Props>;
  declare setState: (state: Partial<State> | ((prevState: Readonly<State>) => Partial<State>)) => void;

  public state: State = {
    hasError: false,
    error: null,
  };

  constructor(props: Props) {
    super(props);
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="max-w-xl mx-auto px-4 py-16">
          <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-xl space-y-6 text-center">
            <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center mx-auto shadow-sm">
              <ShieldCheck className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                {this.props.fallbackTitle || 'Staff Portal Recovery'}
              </h2>
              <p className="text-xs text-slate-600 max-w-md mx-auto leading-relaxed">
                The staff portal encountered a temporary rendering error. You can reload the portal below or return to the customer store.
              </p>
            </div>

            {this.state.error && (
              <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3.5 rounded-2xl text-xs text-left font-mono break-all space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-rose-900">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>Error Details:</span>
                </div>
                <div className="text-[11px] text-rose-700">{this.state.error.message}</div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={this.handleReset}
                className="w-full sm:w-auto bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs py-3 px-6 rounded-xl shadow transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4 text-amber-400" />
                <span>Reload Staff Portal</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  window.location.hash = '';
                  window.location.reload();
                }}
                className="w-full sm:w-auto bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs py-3 px-5 rounded-xl border border-slate-300 transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Return to Store</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
