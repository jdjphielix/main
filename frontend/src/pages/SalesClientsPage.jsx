import React from 'react';
import ClientsPage from './ClientsPage';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, info: null };
  }
  componentDidCatch(error, info) {
    this.setState({ hasError: true, error, info });
    console.error('SalesClientsPage crash:', error, info);
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40, fontFamily: 'monospace', color: '#dc2626', background: '#fff5f5', borderRadius: 12, margin: 24 }}>
          <h2 style={{ marginBottom: 16 }}>Fout in Sales Clients pagina</h2>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, background: '#fee2e2', padding: 16, borderRadius: 8 }}>
            {this.state.error?.toString()}
            {this.state.info?.componentStack}
          </pre>
          <p style={{ marginTop: 16, fontSize: 12, color: '#991b1b' }}>
            Open de browser console (F12) voor meer details.
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function SalesClientsPage() {
  return (
    <ErrorBoundary>
      <ClientsPage myClientsOnly={true} />
    </ErrorBoundary>
  );
}
