import React, { Component, ErrorInfo, ReactNode } from 'react';
import { ExclamationTriangleIcon } from '@radix-ui/react-icons';
import { Button } from './primitives';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * ErrorBoundary catches JavaScript errors in child components,
 * logs them, and displays a fallback UI instead of crashing the app.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-pkt-bg-subtle flex items-center justify-center px-4">
          <div
            className="max-w-md w-full p-4 sm:p-8 bg-pkt-bg-card rounded-lg border border-pkt-grays-gray-200"
            role="alert"
          >
            <ExclamationTriangleIcon className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-3 sm:mb-4 text-pkt-brand-red-1000" />
            <h1 className="text-lg sm:text-xl font-semibold text-pkt-brand-red-1000 mb-3 sm:mb-4 text-center">
              Noe gikk galt
            </h1>
            <p className="text-sm sm:text-base text-pkt-text-body-default mb-6 text-center">
              En uventet feil oppstod. Prøv å laste siden på nytt.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button variant="secondary" onClick={this.handleReset}>
                Prøv igjen
              </Button>
              <Button variant="primary" onClick={() => window.location.reload()}>
                Last siden på nytt
              </Button>
            </div>
            {import.meta.env.DEV && this.state.error && (
              <pre className="mt-6 p-4 bg-pkt-bg-subtle text-left text-sm overflow-auto rounded border border-pkt-grays-gray-200">
                {this.state.error.message}
                {'\n\n'}
                {this.state.error.stack}
              </pre>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
