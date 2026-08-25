import React from "react";

// Błędy portalu Select/Modal: "removeChild", "insertBefore", "appendChild",
// "replaceChild", "NotFoundError" — powstają gdy React remontuje poddrzewo
// podczas gdy portal był otwarty. Są efemeryczne — auto-odtwarzanie rozwiązuje
// problem bez wywalania całej strony i bez utraty pozostałego UI.
const DOM_ERROR_RE = /removeChild|insertBefore|appendChild|replaceChild|NotFoundError|Failed to execute/i;

export default class SoftErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, isDom: false, attempts: 0 };
    this.recoverTimer = null;
  }

  static getDerivedStateFromError(error) {
    const message = String(error?.message || error);
    return { hasError: true, isDom: DOM_ERROR_RE.test(message) };
  }

  componentDidCatch(error) {
    const message = String(error?.message || error);
    if (DOM_ERROR_RE.test(message) && this.state.attempts < 8) {
      // Odpoczekaj chwilę, by cykl renderu Reacta się zakończył, i zamontuj świeże poddrzewo.
      this.recoverTimer = setTimeout(() => {
        this.setState((s) => ({ hasError: false, isDom: false, attempts: s.attempts + 1 }));
      }, 220);
    }
  }

  componentWillUnmount() {
    clearTimeout(this.recoverTimer);
  }

  handleRetry = () => {
    this.setState((s) => ({ hasError: false, isDom: false, attempts: s.attempts + 1 }));
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    // Błąd portalu DOM — chwilowy placeholder podczas auto-recovery.
    if (this.state.isDom) {
      return <div className="min-h-[80px]" aria-hidden />;
    }

    // Inny błąd — lokalna informacja z przyciskiem ponownej próby (bez pełnoekranowego crasha).
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-center">
        <p className="text-sm text-amber-800 mb-1">Wystąpił problem z wyświetleniem tej sekcji.</p>
        <p className="text-xs text-amber-600 mb-3">Odśwież stronę, jeśli problem się powtarza.</p>
        <button
          onClick={this.handleRetry}
          className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
        >
          Spróbuj ponownie
        </button>
      </div>
    );
  }
}