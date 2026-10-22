import { Component, type ReactNode } from "react";

/** A bug in a page shows what broke instead of a blank window. */
export class ErrorBoundary extends Component<
  { readonly children: ReactNode; readonly onReload?: () => void },
  { readonly error: Error | null }
> {
  override state: { readonly error: Error | null } = { error: null };

  static getDerivedStateFromError(error: unknown) {
    return { error: error instanceof Error ? error : new Error(String(error)) };
  }

  override render() {
    const { error } = this.state;
    if (error === null) return this.props.children;
    const reload = this.props.onReload ?? (() => window.location.reload());
    return (
      <main className="page narrow" role="alert">
        <h1>Something went wrong</h1>
        <p>megareviewer hit a bug while showing this page.</p>
        <pre className="error-detail">{String(error)}</pre>
        <button type="button" className="button primary" onClick={reload}>
          Reload
        </button>
      </main>
    );
  }
}
