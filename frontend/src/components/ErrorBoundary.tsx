import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw, Copy, Check } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  copied: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      copied: false,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
      copied: false,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('ErrorBoundary caught an unhandled render error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReload = (): void => {
    if (this.props.onReset) {
      this.props.onReset();
    }
    this.setState({ hasError: false, error: null, errorInfo: null });
    // Safe soft refresh if at top level
    window.location.reload();
  };

  handleCopy = (): void => {
    const errorText = `Error: ${this.state.error?.message || 'Unknown render error'}\n\nStack:\n${this.state.error?.stack || ''}\n\nComponent Stack:\n${this.state.errorInfo?.componentStack || ''}`;
    void navigator.clipboard?.writeText(errorText);
    this.setState({ copied: true });
    setTimeout(() => this.setState({ copied: false }), 2000);
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="error-boundary-shell" style={{
          padding: '32px 20px',
          maxWidth: '680px',
          margin: '40px auto',
          background: '#ffffff',
          borderRadius: '16px',
          boxShadow: '0 20px 40px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.05)',
          border: '1px solid #fee2e2',
          fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
          color: '#1f2937'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              background: '#fee2e2',
              color: '#dc2626',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <AlertTriangle size={24} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: '#991b1b' }}>
                {this.props.fallbackTitle || 'Something interrupted the workspace'}
              </h2>
              <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#6b7280' }}>
                The application encountered an unexpected display issue. Your saved data remains secure in SQLite.
              </p>
            </div>
          </div>

          <div style={{
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '8px',
            padding: '12px 14px',
            fontSize: '13px',
            color: '#b91c1c',
            fontFamily: 'monospace',
            marginBottom: '18px',
            wordBreak: 'break-word',
            maxHeight: '150px',
            overflowY: 'auto'
          }}>
            {this.state.error?.message || 'Unexpected application error'}
          </div>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button
              onClick={this.handleReload}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '9px 16px',
                background: '#4f46e5',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 500,
                fontSize: '13px',
                cursor: 'pointer'
              }}
            >
              <RotateCcw size={15} /> Reload Workspace
            </button>

            <button
              onClick={this.handleCopy}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '9px 16px',
                background: '#f3f4f6',
                color: '#374151',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                fontWeight: 500,
                fontSize: '13px',
                cursor: 'pointer'
              }}
            >
              {this.state.copied ? <Check size={15} color="#16a34a" /> : <Copy size={15} />}
              {this.state.copied ? 'Copied error info' : 'Copy error details'}
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
