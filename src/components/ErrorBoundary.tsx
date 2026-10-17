import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string | null;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = {
      hasError: false,
      errorMessage: null,
    };
  }

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error instanceof Error ? error.message : 'Errore imprevisto di rendering UI.',
    };
  }

  componentDidCatch(error: unknown, errorInfo: React.ErrorInfo): void {
    console.error('[DemInvest Global ErrorBoundary]', error, errorInfo.componentStack);
  }

  handleReload = (): void => {
    this.setState({ hasError: false, errorMessage: null });
    window.location.reload();
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-anthracite-950 p-6 text-slate-100">
          <div className="w-full max-w-md rounded-2xl border border-amber-500/40 bg-anthracite-900 p-6 shadow-xl">
            <div className="flex items-center gap-3 text-amber-400">
              <AlertTriangle className="h-6 w-6 shrink-0" />
              <h1 className="text-base font-bold">Protezione Interfaccia DemInvest</h1>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-slate-300">
              L&apos;Error Boundary globale ha intercettato un&apos;eccezione imprevista, preservando i dati
              locali e la sessione.
            </p>
            {this.state.errorMessage && (
              <div className="mt-3 rounded-lg border border-slate-800 bg-anthracite-950 p-3 font-mono text-[11px] text-amber-300">
                {this.state.errorMessage}
              </div>
            )}
            <button
              type="button"
              onClick={this.handleReload}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-500 py-2.5 text-xs font-bold text-anthracite-950 hover:bg-brand-400"
            >
              <RefreshCw className="h-4 w-4" />
              <span>Ricarica Applicazione in Sicurezza</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
