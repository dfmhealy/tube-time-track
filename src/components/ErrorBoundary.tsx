import { Component, ErrorInfo, ReactNode, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log the error to an error reporting service
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    // Call the onError handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: undefined });
  };

  public render() {
    if (this.state.hasError) {
      // You can render any custom fallback UI
      return this.props.fallback || (
        <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
          <div className="p-6 bg-red-50 dark:bg-red-900/20 rounded-lg max-w-md w-full">
            <div className="flex justify-center mb-4">
              <AlertTriangle className="h-12 w-12 text-red-500" />
            </div>
            <h2 className="text-xl font-bold mb-2 text-red-800 dark:text-red-200">
              Oops! Something went wrong.
            </h2>
            <p className="text-red-700 dark:text-red-300 mb-4">
              {this.state.error?.message || 'An unexpected error occurred.'}
            </p>
            <div className="flex justify-center gap-4">
              <Button 
                variant="outline" 
                onClick={this.handleReset}
                className="border-red-500 text-red-700 hover:bg-red-100 dark:border-red-400 dark:text-red-200 dark:hover:bg-red-800/50"
              >
                Try again
              </Button>
              <Button 
                variant="default" 
                onClick={() => window.location.reload()}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                Reload Page
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Custom hook for error boundaries in function components
export function useErrorHandler() {
  const [error, setError] = useState<Error | null>(null);
  
  const handleError = useCallback((error: Error) => {
    console.error('Error caught by useErrorHandler:', error);
    setError(error);
  }, []);
  
  const resetError = useCallback(() => {
    setError(null);
  }, []);
  
  if (error) {
    return { error, handleError, resetError } as const;
  }
  
  return { error: null, handleError, resetError } as const;
}
