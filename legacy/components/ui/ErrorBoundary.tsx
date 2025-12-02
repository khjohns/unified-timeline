import React, { Component, ReactNode } from 'react';
import { logger } from '../../utils/logger';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
}

/**
 * ErrorBoundary component to catch and handle React component errors
 * Prevents the entire app from crashing when a component fails
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log the error to console (always logged, even in production)
    logger.error('Error caught by ErrorBoundary:', error, errorInfo);

    // Update state with error details
    this.setState({
      error,
      errorInfo,
    });

    // TODO: Send error to error tracking service (e.g., Sentry, LogRocket)
    // if (window.errorTracker) {
    //   window.errorTracker.captureException(error, { extra: errorInfo });
    // }
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div className="max-w-2xl mx-auto mt-8 p-8 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg
                className="h-6 w-6 text-red-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <div className="ml-3 flex-1">
              <h2 className="text-xl font-bold text-red-800 mb-2">
                Noe gikk galt
              </h2>
              <p className="text-red-600 mb-4">
                En uventet feil oppstod i applikasjonen. Vennligst prøv å laste inn siden på nytt.
              </p>

              <button
                onClick={this.handleReload}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
              >
                Last inn på nytt
              </button>

              {/* Show error details in development mode */}
              {import.meta.env.DEV && this.state.error && (
                <details className="mt-6">
                  <summary className="cursor-pointer text-sm font-semibold text-red-700 hover:text-red-800">
                    Tekniske detaljer (kun synlig i utviklingsmodus)
                  </summary>
                  <div className="mt-4 p-4 bg-red-100 rounded text-sm overflow-auto">
                    <h3 className="font-bold text-red-800 mb-2">Error:</h3>
                    <pre className="text-red-700 whitespace-pre-wrap mb-4">
                      {this.state.error.toString()}
                    </pre>

                    {this.state.error.stack && (
                      <>
                        <h3 className="font-bold text-red-800 mb-2">Stack Trace:</h3>
                        <pre className="text-red-700 whitespace-pre-wrap mb-4">
                          {this.state.error.stack}
                        </pre>
                      </>
                    )}

                    {this.state.errorInfo && (
                      <>
                        <h3 className="font-bold text-red-800 mb-2">Component Stack:</h3>
                        <pre className="text-red-700 whitespace-pre-wrap">
                          {this.state.errorInfo.componentStack}
                        </pre>
                      </>
                    )}
                  </div>
                </details>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
