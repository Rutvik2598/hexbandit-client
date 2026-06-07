import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div style={{
        position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 20,
        background: 'var(--bg-0, #060b15)',
        fontFamily: 'var(--ff-ui, system-ui, sans-serif)',
        padding: 24,
      }}>
        <div style={{
          width: 52, height: 52, borderRadius: 16, display: 'grid', placeItems: 'center',
          background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)',
          fontSize: 26,
        }}>
          ⚠
        </div>

        <div style={{ textAlign: 'center', maxWidth: 420 }}>
          <h2 style={{
            fontFamily: 'var(--ff-display, system-ui)', fontWeight: 700, fontSize: 20,
            color: 'var(--text, #eaf1fc)', margin: '0 0 10px',
          }}>
            Something went wrong
          </h2>
          <p style={{
            fontSize: 13, color: 'var(--text-dim, #8b9bb5)',
            margin: '0 0 6px', lineHeight: 1.6,
          }}>
            An unexpected error crashed this page. Your game progress may be lost.
          </p>
          <pre style={{
            fontSize: 11, color: 'var(--text-ghost, #4a5568)',
            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 8, padding: '8px 12px', margin: '12px 0 0',
            textAlign: 'left', overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          }}>
            {error.message}
          </pre>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => window.location.assign('/')}
            style={{
              padding: '10px 24px', borderRadius: 10, border: '1px solid rgba(125,165,225,0.25)',
              background: 'rgba(255,255,255,0.05)', color: 'var(--text, #eaf1fc)',
              fontSize: 13, fontWeight: 700, cursor: 'pointer',
              fontFamily: 'var(--ff-display, system-ui)',
            }}
          >
            Return to Menu
          </button>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '10px 24px', borderRadius: 10, border: '1px solid rgba(125,165,225,0.25)',
              background: 'linear-gradient(180deg,#3f87f2,#2563eb)',
              color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
              fontFamily: 'var(--ff-display, system-ui)',
            }}
          >
            Reload Page
          </button>
        </div>
      </div>
    );
  }
}
