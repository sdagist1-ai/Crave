import { Component, type ErrorInfo, type ReactNode } from "react";
import { reportCrashAndRollBack } from "../lib/liveUpdate";
import { StartupError } from "./StartupError";

/**
 * Catches a crash while rendering. On a live update, the bad version is dropped and the
 * app goes back to the last version that worked (the web view reloads); otherwise it
 * shows a message instead of a blank screen.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Crave crashed", error, info.componentStack);
    void reportCrashAndRollBack(error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <StartupError
        title="Something went wrong"
        detail="Crave is getting back on track. If this screen stays, close the app and open it again."
      />
    );
  }
}
