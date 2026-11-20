import { Component, type ErrorInfo, type ReactNode } from 'react';
import { RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      message: error.message || 'An unexpected rendering error occurred.',
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ANIVEXA ErrorBoundary caught error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 py-16 text-center">
          <h1 className="font-display text-2xl font-semibold text-white">
            Something went wrong
          </h1>
          <p className="mt-2 max-w-md text-sm text-[#9aa2b1]">
            {this.state.message}
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[#E5383B] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#f0484b]"
          >
            <RotateCcw className="h-4 w-4" />
            <span>Reload Page</span>
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
