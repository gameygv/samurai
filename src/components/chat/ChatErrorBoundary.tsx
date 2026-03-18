import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ChatErrorBoundaryProps {
  children: React.ReactNode;
}

interface ChatErrorBoundaryState {
  hasError: boolean;
}

export class ChatErrorBoundary extends React.Component<ChatErrorBoundaryProps, ChatErrorBoundaryState> {
  constructor(props: ChatErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error('Chat viewer crash:', error);
  }

  handleReset = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-full min-h-[400px] w-full flex-col items-center justify-center gap-4 bg-[#050505] p-8 text-center">
          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4">
            <AlertTriangle className="h-8 w-8 text-red-400" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">No se pudo abrir este chat</h3>
            <p className="mt-1 text-sm text-slate-400">
              El visor encontró un dato inválido y se protegió para no dejar la pantalla en blanco.
            </p>
          </div>
          <button
            onClick={this.handleReset}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-bold uppercase tracking-widest text-slate-200 transition-colors hover:bg-slate-800"
          >
            <RefreshCw className="h-4 w-4" />
            Reintentar
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}