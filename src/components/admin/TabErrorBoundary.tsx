import React, { Component, ErrorInfo } from 'react';
import { AlertCircle, RefreshCw, ChevronDown, ChevronUp, Bug, Copy, CheckCircle2, XCircle } from 'lucide-react';

interface TabErrorBoundaryProps {
  children: React.ReactNode;
  tabName: string;
  /** Optional fallback component override */
  fallback?: React.ReactNode;
  /** Called when an error is caught */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface TabErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
  retryCount: number;
  copied: boolean;
  lastErrorTime: string;
}

export class TabErrorBoundary extends Component<TabErrorBoundaryProps, TabErrorBoundaryState> {
  constructor(props: TabErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
      retryCount: 0,
      copied: false,
      lastErrorTime: '',
    };
  }

  static getDerivedStateFromError(error: Error): Partial<TabErrorBoundaryState> {
    return {
      hasError: true,
      error,
      lastErrorTime: new Date().toLocaleString(),
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });

    // Log to console for developer debugging
    console.error(
      `[TabErrorBoundary] Error in "${this.props.tabName}" tab:`,
      error,
      errorInfo
    );

    // Call optional error handler
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleRetry = () => {
    this.setState((prevState) => ({
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
      retryCount: prevState.retryCount + 1,
      copied: false,
    }));
  };

  toggleDetails = () => {
    this.setState((prevState) => ({
      showDetails: !prevState.showDetails,
    }));
  };

  copyErrorDetails = () => {
    const { error, errorInfo, lastErrorTime } = this.state;
    const { tabName } = this.props;

    const details = [
      `=== AYP Staff Dashboard Error Report ===`,
      `Tab: ${tabName}`,
      `Time: ${lastErrorTime}`,
      `Retry Count: ${this.state.retryCount}`,
      ``,
      `--- Error ---`,
      `Name: ${error?.name || 'Unknown'}`,
      `Message: ${error?.message || 'No message'}`,
      ``,
      `--- Stack Trace ---`,
      error?.stack || 'No stack trace available',
      ``,
      `--- Component Stack ---`,
      errorInfo?.componentStack || 'No component stack available',
      ``,
      `--- Browser Info ---`,
      `User Agent: ${navigator.userAgent}`,
      `URL: ${window.location.href}`,
      `Timestamp: ${new Date().toISOString()}`,
    ].join('\n');

    navigator.clipboard.writeText(details).then(() => {
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2500);
    }).catch(() => {
      // Fallback: select text in a textarea
      const textarea = document.createElement('textarea');
      textarea.value = details;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2500);
    });
  };

  getErrorSuggestion(): string {
    const message = this.state.error?.message?.toLowerCase() || '';

    if (message.includes('fetch') || message.includes('network') || message.includes('failed to fetch')) {
      return 'This appears to be a network error. Check your internet connection and try again.';
    }
    if (message.includes('undefined') || message.includes('null') || message.includes('cannot read prop')) {
      return 'This may be caused by missing data. The component expected data that was not available. Try refreshing or check if the required data exists.';
    }
    if (message.includes('permission') || message.includes('unauthorized') || message.includes('403')) {
      return 'You may not have permission to access this resource. Contact your administrator if this persists.';
    }
    if (message.includes('timeout') || message.includes('timed out')) {
      return 'The request timed out. The server may be under heavy load. Please try again in a moment.';
    }
    if (message.includes('json') || message.includes('parse')) {
      return 'There was an issue parsing data from the server. This may be a temporary server issue.';
    }
    if (message.includes('chunk') || message.includes('loading chunk') || message.includes('dynamically imported')) {
      return 'A code module failed to load. This can happen after a deployment. Try a hard refresh (Ctrl+Shift+R).';
    }
    return 'An unexpected error occurred in this component. Try clicking Retry, or refresh the page if the issue persists.';
  }

  render() {
    if (this.state.hasError) {
      // Allow custom fallback override
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const { error, errorInfo, showDetails, retryCount, copied, lastErrorTime } = this.state;
      const { tabName } = this.props;
      const suggestion = this.getErrorSuggestion();

      return (
        <div className="w-full" role="alert" aria-live="assertive">
          <div className="rounded-xl border border-red-200 bg-gradient-to-br from-red-50 via-white to-orange-50 shadow-sm overflow-hidden">
            {/* Error Header */}
            <div className="bg-gradient-to-r from-red-500 to-red-600 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center backdrop-blur-sm">
                  <XCircle className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="text-white font-semibold text-lg">
                    {tabName} — Failed to Load
                  </h3>
                  <p className="text-red-100 text-sm">
                    This section encountered an error and couldn't render
                  </p>
                </div>
                {retryCount > 0 && (
                  <span className="bg-white/20 text-white text-xs px-2.5 py-1 rounded-full backdrop-blur-sm">
                    Retry #{retryCount}
                  </span>
                )}
              </div>
            </div>

            {/* Error Body */}
            <div className="p-6 space-y-5">
              {/* Error Message Card */}
              <div className="bg-white rounded-lg border border-red-100 p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 text-sm">
                      {error?.message || 'An unknown error occurred'}
                    </p>
                    <p className="text-gray-500 text-xs mt-1">
                      Occurred at {lastErrorTime}
                    </p>
                  </div>
                </div>
              </div>

              {/* Suggestion Card */}
              <div className="bg-amber-50 rounded-lg border border-amber-200 p-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Bug className="w-4 h-4 text-amber-600" />
                  </div>
                  <div>
                    <p className="font-medium text-amber-900 text-sm">Possible Cause</p>
                    <p className="text-amber-700 text-sm mt-1">{suggestion}</p>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={this.handleRetry}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#1a365d] to-[#2a4a7f] text-white rounded-lg font-medium text-sm hover:from-[#1a365d]/90 hover:to-[#2a4a7f]/90 transition-all shadow-sm hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#1a365d] focus:ring-offset-2"
                  aria-label={`Retry loading ${tabName}`}
                >
                  <RefreshCw className="w-4 h-4" />
                  Retry Loading
                </button>

                <button
                  onClick={() => window.location.reload()}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-white text-gray-700 rounded-lg font-medium text-sm border border-gray-300 hover:bg-gray-50 transition-all focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2"
                  aria-label="Refresh the entire page"
                >
                  <RefreshCw className="w-4 h-4" />
                  Refresh Page
                </button>

                <button
                  onClick={this.copyErrorDetails}
                  className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm border transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                    copied
                      ? 'bg-green-50 text-green-700 border-green-300 focus:ring-green-300'
                      : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50 focus:ring-gray-300'
                  }`}
                  aria-label="Copy error details to clipboard"
                >
                  {copied ? (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copy Error Report
                    </>
                  )}
                </button>
              </div>

              {/* Expandable Error Details */}
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <button
                  onClick={this.toggleDetails}
                  className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[#1a365d]"
                  aria-expanded={showDetails}
                  aria-controls="error-details-panel"
                >
                  <span className="flex items-center gap-2">
                    <Bug className="w-4 h-4 text-gray-500" />
                    Technical Details (for debugging)
                  </span>
                  {showDetails ? (
                    <ChevronUp className="w-4 h-4 text-gray-500" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-500" />
                  )}
                </button>

                {showDetails && (
                  <div id="error-details-panel" className="p-4 space-y-4 bg-white">
                    {/* Error Name & Message */}
                    <div>
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                        Error Type
                      </h4>
                      <p className="text-sm font-mono text-red-700 bg-red-50 px-3 py-2 rounded border border-red-100">
                        {error?.name}: {error?.message}
                      </p>
                    </div>

                    {/* Stack Trace */}
                    {error?.stack && (
                      <div>
                        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                          Stack Trace
                        </h4>
                        <pre className="text-xs font-mono text-gray-700 bg-gray-50 px-3 py-3 rounded border border-gray-200 overflow-x-auto max-h-48 whitespace-pre-wrap break-words">
                          {error.stack}
                        </pre>
                      </div>
                    )}

                    {/* Component Stack */}
                    {errorInfo?.componentStack && (
                      <div>
                        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                          Component Stack
                        </h4>
                        <pre className="text-xs font-mono text-gray-600 bg-gray-50 px-3 py-3 rounded border border-gray-200 overflow-x-auto max-h-48 whitespace-pre-wrap break-words">
                          {errorInfo.componentStack}
                        </pre>
                      </div>
                    )}

                    {/* Metadata */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
                        <span className="text-xs text-gray-500 block">Tab</span>
                        <span className="text-sm font-medium text-gray-800">{tabName}</span>
                      </div>
                      <div className="bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
                        <span className="text-xs text-gray-500 block">Retry Count</span>
                        <span className="text-sm font-medium text-gray-800">{retryCount}</span>
                      </div>
                      <div className="bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
                        <span className="text-xs text-gray-500 block">Error Time</span>
                        <span className="text-sm font-medium text-gray-800">{lastErrorTime}</span>
                      </div>
                      <div className="bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
                        <span className="text-xs text-gray-500 block">URL</span>
                        <span className="text-sm font-medium text-gray-800 truncate block">{window.location.pathname}</span>
                      </div>
                    </div>

                    {/* Tip */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <p className="text-xs text-blue-700">
                        <strong>Tip:</strong> Click "Copy Error Report" to copy all details to your clipboard, 
                        then share with the development team for faster debugging. You can also check the browser 
                        console (F12) for additional error context.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Retry limit warning */}
              {retryCount >= 3 && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-orange-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-orange-900 text-sm">Multiple retries failed</p>
                      <p className="text-orange-700 text-sm mt-1">
                        This error has persisted after {retryCount} retries. Consider refreshing the entire page 
                        or contacting the development team with the error report. Other tabs should still work normally.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default TabErrorBoundary;
