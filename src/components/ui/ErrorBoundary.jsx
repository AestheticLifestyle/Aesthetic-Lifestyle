import { Component } from 'react';

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info?.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          minHeight: 300, padding: 40, textAlign: 'center',
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%', background: 'rgba(239,68,68,.1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16,
            fontSize: 24,
          }}>
            ⚠️
          </div>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--t1)', marginBottom: 6 }}>
            Something went wrong
          </div>
          <div style={{ fontSize: 13, color: 'var(--t3)', marginBottom: 20, maxWidth: 320, lineHeight: 1.5 }}>
            {this.state.error?.message || 'An unexpected error occurred. Please try again.'}
          </div>
          <button
            className="btn btn-primary btn-sm"
            onClick={this.handleReset}
            style={{ minWidth: 120 }}
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
