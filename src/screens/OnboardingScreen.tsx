import { useEffect, useState } from "react";
import { ArrowRight, Camera, ChevronLeft, Link2, Loader2, Plus } from "lucide-react";
import { getCurrentUserId, supabase } from "../lib/supabase";
import { uploadAvatar } from "../lib/images";
import { Glow, PrimaryButton, TextField } from "../components/ui";

type View = "photo" | "choose" | "create" | "join";

/** First run: add a photo, then create or join a first Cravelist. */
export function OnboardingScreen({ onComplete }: { onComplete: (groupId?: string) => void }) {
  const [view, setView] = useState<View>("photo");
  const [userId, setUserId] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { getCurrentUserId().then(setUserId); }, []);

  const go = (next: View) => { setView(next); setError(null); };

  const onPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !userId) return;
    setUploading(true);
    setError(null);
    try {
      const url = await uploadAvatar(file, userId);
      const { error: err } = await supabase.from("profiles").update({ avatar_url: url }).eq("id", userId);
      if (err) throw err;
      setAvatarUrl(url);
    } catch {
      setError("Couldn't upload that photo. Try another, or skip for now.");
    } finally {
      setUploading(false);
    }
  };

  const create = async () => {
    setBusy(true);
    setError(null);
    const { data, error: err } = await supabase.rpc("create_group", { group_name: name.trim() });
    setBusy(false);
    if (err) return setError(err.message);
    onComplete(data ?? undefined);
  };

  const join = async () => {
    setBusy(true);
    setError(null);
    const { data, error: err } = await supabase.rpc("join_group", { invite_code: code });
    setBusy(false);
    if (err) return setError(err.message.includes("Invalid share code") ? "That code doesn't match a Cravelist." : err.message);
    onComplete(data ?? undefined);
  };

  return (
    <div className="relative flex min-h-full flex-col overflow-hidden bg-background">
      <Glow side="right" />
      <div className="relative mx-auto flex w-full max-w-sm flex-1 flex-col px-6 pt-safe pb-safe">
        {(view === "create" || view === "join") && (
          <button type="button" onClick={() => go("choose")} aria-label="Back"
            className="-ml-3 mt-2 flex h-11 w-11 items-center justify-center rounded-full">
            <ChevronLeft size={24} />
          </button>
        )}

        <div className={`${view === "create" || view === "join" ? "mt-4" : "mt-16"} mb-10`}>
          <div className="mb-3 font-mono text-xs tracking-[0.14em] text-muted uppercase">
            {view === "photo" ? "Step 1 of 2" : "Step 2 of 2"}
          </div>
          <h1 className="m-0 mb-3 font-display text-[44px] leading-none font-extrabold tracking-[-0.03em]">
            {view === "photo" ? <>Welcome to<br />Crave.</>
              : view === "create" ? "Name your Cravelist"
              : view === "join" ? "Join a Cravelist"
              : <>Your first<br />Cravelist</>}
          </h1>
          <p className="m-0 text-[15px] text-muted">
            {view === "photo" ? "Add a photo so your crew knows who rated what."
              : view === "create" ? "You can invite people once it's made."
              : view === "join" ? "Enter the 6-character code a friend shared with you."
              : "A shared list of places you want to try — for you, a partner or a whole group."}
          </p>
        </div>

        {view === "photo" && (
          <div className="flex flex-col items-center gap-8 animate-rise">
            <label className="relative flex h-36 w-36 cursor-pointer items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-border-strong bg-surface">
              {uploading ? <Loader2 size={28} className="animate-spin text-accent" />
                : avatarUrl ? <img src={avatarUrl} alt="Your photo" className="h-full w-full object-cover" />
                : <span className="flex flex-col items-center gap-1.5 text-muted"><Camera size={28} /><span className="text-xs font-medium">Add photo</span></span>}
              <input type="file" accept="image/*" onChange={onPhoto} className="sr-only" disabled={uploading || !userId} />
            </label>
            {error && <p role="alert" className="m-0 text-center text-sm text-danger">{error}</p>}
            <PrimaryButton onClick={() => go("choose")} disabled={uploading}>
              {avatarUrl ? "Continue" : "Skip for now"} <ArrowRight size={18} />
            </PrimaryButton>
          </div>
        )}

        {view === "choose" && (
          <div className="flex flex-col gap-3 animate-rise">
            <button type="button" onClick={() => go("create")}
              className="flex items-center gap-4 rounded-3xl bg-ink p-5 text-left text-white active:scale-[0.98]">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent"><Plus size={22} /></span>
              <span className="flex flex-col">
                <span className="text-lg font-semibold">Start a new list</span>
                <span className="text-[13px] text-border-strong">For you, a partner or friends</span>
              </span>
            </button>
            <button type="button" onClick={() => go("join")}
              className="flex items-center gap-4 rounded-3xl border border-dashed border-border-strong bg-surface p-5 text-left active:scale-[0.98]">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-subtle"><Link2 size={22} /></span>
              <span className="flex flex-col">
                <span className="text-lg font-semibold">Join with a code</span>
                <span className="text-[13px] text-muted">Someone shared a Cravelist with you</span>
              </span>
            </button>
          </div>
        )}

        {view === "create" && (
          <form className="flex flex-col gap-4 animate-rise" onSubmit={(e) => { e.preventDefault(); if (name.trim()) create(); }}>
            <TextField label="List name" placeholder="Weekend Crew, Date Spots…" value={name} maxLength={60} autoFocus
              onChange={(e) => setName(e.target.value)} />
            {error && <p role="alert" className="m-0 text-sm text-danger">{error}</p>}
            <PrimaryButton type="submit" disabled={busy || !name.trim()} tone="accent">
              {busy ? <Loader2 size={18} className="animate-spin" /> : null} Create list
            </PrimaryButton>
          </form>
        )}

        {view === "join" && (
          <form className="flex flex-col gap-4 animate-rise" onSubmit={(e) => { e.preventDefault(); if (code.length === 6) join(); }}>
            <TextField label="Invite code" placeholder="ABC123" value={code} autoFocus autoCapitalize="characters" autoComplete="off"
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))} />
            {error && <p role="alert" className="m-0 text-sm text-danger">{error}</p>}
            <PrimaryButton type="submit" disabled={busy || code.length !== 6} tone="accent">
              {busy ? <Loader2 size={18} className="animate-spin" /> : null} Join list
            </PrimaryButton>
          </form>
        )}
      </div>
    </div>
  );
}
