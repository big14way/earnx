import { Component, type ErrorInfo, type ReactNode } from 'react';

/** Keeps one failing component (a wallet modal, a chart) from blanking the whole app. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error?: Error }> {
  state: { error?: Error } = {};

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('EarnX UI error', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="mx-auto max-w-xl px-6 py-24 text-center">
        <h1 className="font-display text-3xl font-semibold text-ink">Something went wrong on this page</h1>
        <p className="mt-3 text-muted">Your funds are safe: nothing is sent without your confirmation.</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-6 rounded-full bg-ink px-6 py-3 text-sm font-semibold text-paper"
        >
          Reload
        </button>
      </div>
    );
  }
}
