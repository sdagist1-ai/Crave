import { useState } from "react";
import { Icon } from "@iconify/react";
import { supabase } from "../lib/supabase";

export function UpdatePasswordScreen({ onComplete }: { onComplete: () => void }) {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!password || password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    
    setLoading(true);
    setError(null);
    try {
      const { error: err } = await supabase.auth.updateUser({
        password: password,
      });
      if (err) throw err;
      
      // Successfully updated, exit recovery mode!
      onComplete();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 font-sans animate-in fade-in zoom-in-[0.98] duration-700 absolute inset-0 z-50">
      <div className="w-full max-w-sm flex flex-col items-center">
        <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center shadow-sm mb-6">
          <Icon icon="solar:lock-keyhole-bold" className="text-primary-foreground text-3xl" />
        </div>
        <h1 className="font-heading text-[32px] font-black text-foreground leading-none mb-2 tracking-tight text-center">
          Reset Password
        </h1>
        <p className="text-[16px] font-medium text-muted-foreground mb-10 text-center">
          Please enter your new password below.
        </p>
        
        <div className="w-full space-y-4">
          <div className="relative">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-8 py-5 rounded-[2.5rem] border border-border/50 bg-card text-[16px] font-medium text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-all shadow-sm"
              placeholder="New Password"
            />
          </div>
        </div>

        {error && <p className="text-destructive text-sm font-bold mt-4 w-full text-center">{error}</p>}

        <button 
          onClick={handleSubmit} 
          disabled={loading || !password}
          className="w-full py-5 rounded-[2.5rem] bg-primary text-primary-foreground font-bold text-[18px] shadow-2xl shadow-primary/40 mt-8 active:scale-[0.98] transition-all disabled:opacity-50"
        >
          {loading ? "Updating..." : "Save New Password"}
        </button>
      </div>
    </div>
  );
}
