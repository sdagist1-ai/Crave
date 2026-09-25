import React from "react";
import ReactDOM from "react-dom/client";
import "@fontsource-variable/bricolage-grotesque";
import "@fontsource-variable/geist";
import "@fontsource-variable/geist-mono";
import "./main.css";
import { StartupError } from "./components/StartupError";
import { ErrorBoundary } from "./components/ErrorBoundary";

const root = ReactDOM.createRoot(document.getElementById("root")!);

// These are baked in at build time from .env. Without them the Supabase client
// throws on import and the app would show a blank screen, so say what's wrong.
const missing = ["VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY"].filter((k) => !import.meta.env[k]);

if (missing.length) {
  root.render(
    <StartupError
      title="Crave isn't configured"
      detail={`This build is missing ${missing.join(" and ")}. Add them to .env (or the host's environment variables) and rebuild.`}
    />,
  );
} else {
  import("./App")
    .then(({ default: App }) => root.render(<React.StrictMode><ErrorBoundary><App /></ErrorBoundary></React.StrictMode>))
    .catch((err) => {
      console.error("Crave failed to start", err);
      root.render(<StartupError title="Crave couldn't start" detail="Close the app and open it again. If it keeps happening, reinstall the latest version." />);
    });
}
