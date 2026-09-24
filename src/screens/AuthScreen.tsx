import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { supabase } from "../lib/supabase";
import { Glow, PrimaryButton, TextField } from "../components/ui";

// Auth emails link back into the app: the custom URL scheme on iOS, or the
// current site (e.g. the Vercel deployment) when running in a browser.
// Web origins must be listed under Supabase → Authentication → URL Configuration.
const isNative = Capacitor.isNativePlatform();
const webOrigin = typeof window !== "undefined" ? window.location.origin : undefined;

export function AuthScreen() {
  const [email, setEmail] = useState(() => localStorage.getItem("crave_last_email") || "");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      if (isSignUp) {
        if (!firstName || !lastName) {
          throw new Error("Please enter your first and last name");
        }
        const { error: err } = await supabase.auth.signUp({ 
          email, 
          password, 
          options: {
            data: { first_name: firstName, last_name: lastName },
            ...(isNative ? {} : { emailRedirectTo: webOrigin }),
          }
        });
        if (err) throw err;
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
      }
      // Cache email natively via localStorage to reduce future friction!
      localStorage.setItem("crave_last_email", email);

    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!email) {
      setError("Please enter your email address first");
      return;
    }
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: isNative ? "craveapp://reset-password" : webOrigin,
      });
      if (err) throw err;
      setMessage("Check your email for the password reset link!");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-full flex-col overflow-hidden bg-background">
      <Glow side="right" />
      <form
        className="relative mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-3 px-6 pt-safe pb-safe"
        onSubmit={(e) => { e.preventDefault(); if (email && password) handleSubmit(); }}
      >
        <div className="mb-8">
          <div className="mb-3 font-mono text-xs tracking-[0.14em] text-muted uppercase">Your crew's restaurant list</div>
          <h1 className="m-0 font-display text-[64px] leading-[0.9] font-extrabold tracking-[-0.04em] text-accent">Crave</h1>
          <p className="m-0 mt-3 text-[15px] text-muted">
            {isSignUp ? "Create an account to start saving spots." : "Sign in to pick up where you left off."}
          </p>
        </div>

        {isSignUp && (
          <div className="flex gap-3 animate-rise">
            <TextField label="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name" />
            <TextField label="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="family-name" />
          </div>
        )}
        <TextField label="Email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none"
          value={email} onChange={(e) => setEmail(e.target.value)} />
        <TextField label="Password" type="password" autoComplete={isSignUp ? "new-password" : "current-password"}
          value={password} onChange={(e) => setPassword(e.target.value)} />

        {!isSignUp && (
          <button type="button" onClick={handleResetPassword} disabled={loading}
            className="-mt-1 h-11 self-end text-sm font-semibold text-accent-ink">
            Forgot password?
          </button>
        )}

        <div aria-live="polite" className="min-h-5 text-center text-sm">
          {error && <span className="text-danger">{error}</span>}
          {message && <span className="text-mint-ink">{message}</span>}
        </div>

        <PrimaryButton type="submit" disabled={loading || !email || !password} tone="accent">
          {loading && <Loader2 size={18} className="animate-spin" />}
          {isSignUp ? "Create account" : "Sign in"}
        </PrimaryButton>

        <button type="button" onClick={() => { setIsSignUp(!isSignUp); setError(null); setMessage(null); }}
          className="h-11 text-[15px] text-muted">
          {isSignUp ? <>Already have an account? <span className="font-semibold text-ink">Sign in</span></>
            : <>New to Crave? <span className="font-semibold text-ink">Create an account</span></>}
        </button>
      </form>
    </div>
  );
}
