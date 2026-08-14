import { useState } from "react";
import { Utensils } from "lucide-react";
import { supabase } from "../lib/supabase";
import { C } from "../constants/theme";

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
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-50">
      <div className="w-10 h-10 rounded-2xl flex items-center justify-center mb-3" style={{ background: C.rose }}>
        <Utensils size={20} className="text-white" />
      </div>
      <h1 className="text-2xl font-black text-slate-800 mb-1">Crave</h1>
      <p className="text-sm text-slate-400 mb-8">Your personal restaurant wishlist</p>

      <div className="w-full max-w-sm space-y-3">
        {isSignUp && (
          <div className="flex gap-3">
            <input type="text" placeholder="First Name" value={firstName} onChange={(e) => setFirstName(e.target.value)}
              className="w-1/2 bg-white border-2 border-slate-200 rounded-2xl px-4 py-3.5 text-slate-800 text-sm placeholder:text-slate-400 outline-none focus:border-rose-400 transition-all" />
            <input type="text" placeholder="Last Name" value={lastName} onChange={(e) => setLastName(e.target.value)}
              className="w-1/2 bg-white border-2 border-slate-200 rounded-2xl px-4 py-3.5 text-slate-800 text-sm placeholder:text-slate-400 outline-none focus:border-rose-400 transition-all" />
          </div>
        )}
        <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)}
          className="w-full bg-white border-2 border-slate-200 rounded-2xl px-4 py-3.5 text-slate-800 text-sm placeholder:text-slate-400 outline-none focus:border-rose-400 transition-all" />
        <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)}
          className="w-full bg-white border-2 border-slate-200 rounded-2xl px-4 py-3.5 text-slate-800 text-sm placeholder:text-slate-400 outline-none focus:border-rose-400 transition-all" />
        {error && <p className="text-rose-500 text-xs font-medium">{error}</p>}
        <button type="button" onClick={handleSubmit} disabled={loading || !email || !password}
          className="w-full py-4 rounded-2xl font-bold text-white text-sm disabled:opacity-40 transition-all shadow-lg shadow-rose-200"
          style={{ background: C.rose }}>
          {loading ? "Please wait..." : isSignUp ? "Sign Up" : "Sign In"}
        </button>
        <button type="button" onClick={() => { setIsSignUp(!isSignUp); setError(null); }}
          className="w-full text-center text-sm font-medium pt-3" style={{ color: C.rose }}>
          {isSignUp ? "Already have an account? Sign in" : "Don't have an account? Sign up"}
        </button>
      </div>
    </div>
  );
}
