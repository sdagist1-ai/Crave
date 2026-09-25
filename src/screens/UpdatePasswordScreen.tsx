import { useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "../lib/supabase";
import { Glow, PrimaryButton, TextField } from "../components/ui";

export function UpdatePasswordScreen({ onComplete }: { onComplete: () => void }) {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (password.length < 8) {
      setError("Use at least 8 characters.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { error: err } = await supabase.auth.updateUser({ password });
      if (err) throw err;
      onComplete();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-background">
      <Glow side="right" />
      <form
        className="relative mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-4 px-6 pt-safe pb-safe"
        onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}
      >
        <div className="mb-6">
          <div className="mb-3 font-mono text-xs tracking-[0.14em] text-muted uppercase">Account</div>
          <h1 className="m-0 font-display text-[44px] leading-none font-extrabold tracking-[-0.03em]">New password</h1>
          <p className="m-0 mt-3 text-[15px] text-muted">Choose a new password for your Crave account.</p>
        </div>
        <TextField label="New password" type="password" autoComplete="new-password" autoFocus
          value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <p role="alert" className="m-0 text-sm text-danger">{error}</p>}
        <PrimaryButton type="submit" disabled={loading || !password} tone="accent">
          {loading && <Loader2 size={18} className="animate-spin" />} Save new password
        </PrimaryButton>
      </form>
    </div>
  );
}
