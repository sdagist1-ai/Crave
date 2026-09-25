import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { supabase } from "../lib/supabase";
import { Glow, PrimaryButton, TextField } from "../components/ui";

// Auth emails link back into the app: the custom URL scheme on iOS, or the
// current site (e.g. the Vercel deployment) when running in a browser.
// Web origins must be listed under Supabase → Authentication → URL Configuration.
const isNative = Capacitor.isNativePlatform();
const webOrigin = typeof window !== "undefined" ? window.location.origin : undefined;

/** Supabase's emailed codes are 6 digits by default (configurable up to 10). */
const CODE_LENGTH = { min: 6, max: 10 };
const RESEND_AFTER_S = 60;

export function AuthScreen({ notice }: { notice?: string | null }) {
  const [email, setEmail] = useState(() => localStorage.getItem("crave_last_email") || "");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(notice ?? null);
  const [message, setMessage] = useState<string | null>(null);
  // Password reset: after "Forgot password?" we email a code and ask for it here.
  // A correct code signs the user in for recovery, and the app then shows
  // "New password" (App listens for PASSWORD_RECOVERY).
  const [resetting, setResetting] = useState(false);
  const [code, setCode] = useState("");
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

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

  const sendResetCode = async () => {
    if (!email) {
      setError("Enter your email address first.");
      return;
    }
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      // The email carries a code, plus a link for app versions before 1.4.
      const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: isNative ? "craveapp://reset-password" : webOrigin,
      });
      if (err) throw err;
      localStorage.setItem("crave_last_email", email);
      setResetting(true);
      setCode("");
      setResendIn(RESEND_AFTER_S);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const verifyResetCode = async () => {
    setLoading(true);
    setError(null);
    try {
      const { error: err } = await supabase.auth.verifyOtp({ email, token: code, type: "recovery" });
      if (err) throw err;
      // Signed in for recovery: App switches to the "New password" screen.
    } catch {
      setError("That code didn't work. Check the latest email, or send a new code.");
      setLoading(false);
    }
  };

  const leaveReset = () => {
    setResetting(false);
    setCode("");
    setError(null);
    setMessage(null);
  };

  if (resetting) {
    const codeReady = code.length >= CODE_LENGTH.min;
    return (
      <div className="relative flex min-h-full flex-col overflow-hidden bg-background">
        <Glow side="right" />
        <form
          className="relative mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-3 px-6 pt-safe pb-safe"
          onSubmit={(e) => { e.preventDefault(); if (codeReady && !loading) verifyResetCode(); }}
        >
          <div className="mb-6">
            <div className="mb-3 font-mono text-xs tracking-[0.14em] text-muted uppercase">Reset password</div>
            <h1 className="m-0 font-display text-[44px] leading-none font-extrabold tracking-[-0.03em]">Check your email</h1>
            <p className="m-0 mt-3 text-[15px] text-muted">
              We sent a code to <span className="font-semibold text-ink">{email}</span>. It works wherever you read
              your email, even on another device.
            </p>
          </div>

          <label className="block">
            <span className="mb-1.5 block text-[13px] font-medium text-ink-2">Code</span>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, CODE_LENGTH.max))}
              inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]*" autoFocus
              aria-describedby="reset-status"
              className="h-16 w-full rounded-2xl border border-border bg-surface px-4 text-center font-mono text-[28px] tracking-[0.35em] text-ink outline-none placeholder:text-border-strong focus:border-accent"
              placeholder="••••••"
            />
          </label>

          <div id="reset-status" aria-live="polite" className="min-h-5 text-center text-sm">
            {error && <span className="text-danger">{error}</span>}
          </div>

          <PrimaryButton type="submit" disabled={loading || !codeReady} tone="accent">
            {loading && <Loader2 size={18} className="animate-spin" />} Continue
          </PrimaryButton>

          <div className="flex items-center justify-between">
            <button type="button" onClick={leaveReset} className="h-11 text-[15px] text-muted">
              Back to sign in
            </button>
            <button type="button" onClick={sendResetCode} disabled={loading || resendIn > 0}
              className="h-11 text-[15px] font-semibold text-accent-ink disabled:font-normal disabled:text-muted">
              {resendIn > 0 ? `Resend in ${resendIn}s` : "Send a new code"}
            </button>
          </div>
        </form>
      </div>
    );
  }

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
          <button type="button" onClick={sendResetCode} disabled={loading}
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
