import { useState } from "react";
import { Icon } from "@iconify/react";
import { supabase } from "../lib/supabase";

export function AuthScreen() {
  const [email, setEmail] = useState(() => localStorage.getItem("crave_last_email") || "");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    try {
      if (isSignUp) {
        if (!firstName || !lastName) {
          throw new Error("Please enter your first and last name");
        }
        const { error: err } = await supabase.auth.signUp({ 
          email, 
          password, 
          options: {
            data: { first_name: firstName, last_name: lastName }
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

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 font-sans animate-in fade-in zoom-in-[0.98] duration-700">
      <div className="w-full max-w-sm flex flex-col items-center">
        <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center shadow-sm mb-6">
          <Icon icon="ph:fork-knife-fill" className="text-primary-foreground text-3xl" />
        </div>
        <h1 className="font-heading text-[42px] font-black text-foreground leading-none mb-2 tracking-tight">
          Crave
        </h1>
        <p className="text-[17px] font-medium text-muted-foreground mb-10 text-center">
          Your personal restaurant wishlist
        </p>
        
        <div className="w-full space-y-4">
          {isSignUp && (
            <div className="flex gap-4 animate-in slide-in-from-top-4 fade-in duration-300">
              <input
                type="text"
                placeholder="First Name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-1/2 px-6 py-5 rounded-[2.5rem] border border-border/50 bg-card text-[16px] font-medium text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-all shadow-sm"
              />
              <input
                type="text"
                placeholder="Last Name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-1/2 px-6 py-5 rounded-[2.5rem] border border-border/50 bg-card text-[16px] font-medium text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-all shadow-sm"
              />
            </div>
          )}
          
          <div className="relative">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-8 py-5 rounded-[2.5rem] border border-border/50 bg-card text-[16px] font-medium text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-all shadow-sm"
              placeholder="Email"
            />
          </div>
          
          <div className="relative">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-8 py-5 rounded-[2.5rem] border border-border/50 bg-card text-[16px] font-medium text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-all shadow-sm"
              placeholder="Password"
            />
          </div>
        </div>

        {error && <p className="text-destructive text-sm font-bold mt-4 w-full text-center">{error}</p>}

        <button 
          onClick={handleSubmit} 
          disabled={loading || !email || !password}
          className="w-full py-5 rounded-[2.5rem] bg-primary text-primary-foreground font-bold text-[18px] shadow-2xl shadow-primary/40 mt-8 active:scale-[0.98] transition-all disabled:opacity-50"
        >
          {loading ? "Please wait..." : isSignUp ? "Sign Up" : "Sign In"}
        </button>
        
        <button 
          onClick={() => { setIsSignUp(!isSignUp); setError(null); }}
          className="mt-8 text-[15px] font-semibold text-primary hover:underline transition-all"
        >
          {isSignUp ? "Already have an account? Sign in" : "Don't have an account? Sign up"}
        </button>
      </div>
    </div>
  );
}
