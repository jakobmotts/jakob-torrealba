import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    errorMessage: '',
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorMessage: error.message };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      let displayMessage = "An unexpected error occurred.";
      let description = "Please try refreshing the page.";
      
      try {
        if (this.state.errorMessage.includes('{')) {
          const parsedInfo = JSON.parse(this.state.errorMessage);
          if (parsedInfo.error && parsedInfo.error.includes('resource-exhausted')) {
            displayMessage = "Database Quota Exceeded";
            description = "You have reached your free daily quota limit for Firestore. This limit (20,000 writes/day on the Spark plan) resets daily. Please wait until tomorrow, or check the Firebase console for more details.";
          } else if (parsedInfo.error && parsedInfo.error.includes('offline')) {
             displayMessage = "Connection Error";
             description = "Please check your network connection and Firebase configuration.";
          }
        } else if (this.state.errorMessage.includes('resource-exhausted')) {
          displayMessage = "Database Quota Exceeded";
          description = "You have reached your free daily quota limit for Firestore. This limit resets daily at midnight PT.";
        }
      } catch (e) {
        // use default
      }

      return (
        <div className="min-h-screen bg-[#080808] flex items-center justify-center p-6 text-white font-sans">
          <div className="max-w-md w-full bg-[#121212] border border-red-500/20 rounded-3xl p-8 text-center shadow-2xl">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-6 opacity-80" />
            <h1 className="font-serif text-3xl mb-4 text-white">{displayMessage}</h1>
            <p className="text-[#8E8E8E] leading-relaxed mb-8 text-[15px]">
              {description}
            </p>
            <button 
              onClick={() => window.location.reload()}
              className="bg-[#1C1C1C] border border-white/10 hover:border-white/30 text-white px-8 py-3 rounded-xl transition-colors font-medium tracking-wide text-[14px]"
            >
              Refresh Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
