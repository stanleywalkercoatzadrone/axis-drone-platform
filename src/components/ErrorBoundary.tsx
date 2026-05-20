import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

/**
 * ErrorBoundary - Production-grade error boundary for React components
 * Catches JavaScript errors anywhere in the child component tree
 * Logs errors and displays fallback UI
 */
class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null
        };
    }

    static getDerivedStateFromError(error: Error): Partial<State> {
        return { hasError: true };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        // Log error to console in development
        console.error('ErrorBoundary caught an error:', error, errorInfo);

        // Store error details in state
        this.setState({
            error,
            errorInfo
        });

        // In production, send to logging service
        if (import.meta.env.PROD) {
            this.logErrorToService(error, errorInfo);
        }
    }

    logErrorToService(error: Error, errorInfo: ErrorInfo) {
        // Send error to backend logging endpoint
        fetch('/api/system/log-error', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: error.message,
                stack: error.stack,
                componentStack: errorInfo.componentStack,
                timestamp: new Date().toISOString(),
                userAgent: navigator.userAgent,
                url: window.location.href
            })
        }).catch(err => {
            console.error('Failed to log error to service:', err);
        });
    }

    handleReset = () => {
        this.setState({
            hasError: false,
            error: null,
            errorInfo: null
        });
    };

    render() {
        if (this.state.hasError) {
            // Custom fallback UI
            if (this.props.fallback) {
                return this.props.fallback;
            }

            // Default fallback UI
            return (
                <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                    <div className="max-w-md w-full bg-white border border-red-200 rounded-xl p-8 shadow-lg">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-3 bg-red-50 rounded-full">
                                <AlertTriangle className="w-6 h-6 text-red-600" />
                            </div>
                            <h1 className="text-xl font-bold text-slate-900">
                                Something went wrong
                            </h1>
                        </div>

                        <p className="text-slate-600 mb-6">
                            The application encountered an unexpected error. Our team has been notified.
                        </p>

                        {import.meta.env.MODE !== 'production' && this.state.error && (
                            <div className="mb-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
                                <p className="text-xs font-mono text-red-600 mb-2">
                                    {this.state.error.message}
                                </p>
                                <details className="text-xs text-slate-500">
                                    <summary className="cursor-pointer font-medium mb-2">
                                        Stack trace
                                    </summary>
                                    <pre className="overflow-auto text-[10px] leading-tight">
                                        {this.state.error.stack}
                                    </pre>
                                </details>
                            </div>
                        )}

                        <div className="flex gap-3">
                            <button
                                onClick={this.handleReset}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors"
                            >
                                <RefreshCw className="w-4 h-4" />
                                Try Again
                            </button>
                            <button
                                onClick={() => window.location.href = '/'}
                                className="flex-1 px-4 py-2 border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
                            >
                                Go Home
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
