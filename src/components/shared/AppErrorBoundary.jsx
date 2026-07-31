import React from "react";
import { base44 } from "@/api/base44Client";

export default class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  async componentDidCatch(error, info) {
    try {
      let email = "";
      try { email = (await base44.auth.me())?.email || ""; } catch (_) {}
      await base44.entities.AppErrorLog.create({
        user_email: email,
        message: String(error?.message || error).slice(0, 2000),
        stack: String(error?.stack || "").slice(0, 2000) + "\n---\n" + String(info?.componentStack || "").slice(0, 2000),
        page_url: window.location.href,
        user_agent: navigator.userAgent,
      });
    } catch (_) {}
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
          <div className="max-w-md w-full bg-white border border-red-200 rounded-2xl p-6 text-center shadow-sm">
            <div className="text-4xl mb-3">⚠️</div>
            <h2 className="text-lg font-bold text-gray-900 mb-2">Coś poszło nie tak</h2>
            <p className="text-sm text-gray-600 mb-4">
              Wystąpił błąd podczas ładowania strony. Odśwież aplikację, aby kontynuować.
            </p>
            <p className="text-xs text-gray-400 bg-gray-50 rounded-lg p-2 mb-4 break-words">
              {String(this.state.error?.message || this.state.error)}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-5 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
            >
              Odśwież aplikację
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}