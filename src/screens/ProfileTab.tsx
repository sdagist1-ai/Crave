import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Share } from "@capacitor/share";
import { Camera, Check, Copy, Link2, Loader2, LogOut, Pencil, Plus, Settings, Share2, Trash2 } from "lucide-react";
import type { Group, Profile } from "../types";
import { supabase } from "../lib/supabase";
import { fetchMyStats } from "../lib/groups";
import { uploadAvatar } from "../lib/images";
import { inviteLink } from "../lib/invites";
import { Avatar, AvatarStack, Glow, PageTitle, PrimaryButton, Sheet, TextField } from "../components/ui";

type SheetId = null | "settings" | "edit-name" | "join" | "create" | "delete" | { invite: Group };

export function ProfileTab({ uid, groups, activeGroupId, onSelectGroup, active = true }: {
  uid: string;
  groups: Group[];
  activeGroupId: string | undefined;
  onSelectGroup: (id: string) => void;
  /** On screen now (hidden tabs don't refetch). */
  active?: boolean;
}) {
  const queryClient = useQueryClient();
  const [sheet, setSheet] = useState<SheetId>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const profile = useQuery({
    queryKey: ["profile", uid],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").eq("id", uid).single();
      if (error) throw error;
      return data;
    },
    subscribed: active,
  });
  const stats = useQuery({ queryKey: ["restaurants", "my-stats", uid], queryFn: fetchMyStats, subscribed: active });

  const me = profile.data;
  const since = stats.data?.member_since ?? me?.created_at;

  const close = () => { setSheet(null); setError(null); };

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const onPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadAvatar(file, uid);
      const { error } = await supabase.from("profiles").update({ avatar_url: url }).eq("id", uid);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["groups"] });
    } catch {
      setError("Couldn't update your photo. Try again.");
      setSheet("settings");
    } finally {
      setUploading(false);
    }
  };

  const signOut = async () => {
    queryClient.clear();
    await supabase.auth.signOut();
  };

  return (
    <div className="relative h-full overflow-y-auto overflow-x-hidden pb-[120px]">
      <Glow side="left" opacity={0.12} />
      <input ref={fileInput} type="file" accept="image/*" className="hidden" onChange={onPhoto} />

      <div className="relative mx-auto w-full max-w-2xl flex flex-col gap-4 px-5 pt-safe">
        <div className="flex items-center justify-between pt-2">
          <PageTitle>Profile</PageTitle>
          <button type="button" onClick={() => setSheet("settings")} aria-label="Settings"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-surface">
            <Settings size={20} />
          </button>
        </div>

        {/* Me */}
        <section className="flex flex-col gap-3.5 rounded-3xl border border-border bg-surface p-4">
          <div className="flex items-center gap-3.5">
            <div className="relative shrink-0">
              <span className="block rounded-full border-[3px] border-accent p-0.5">
                <Avatar person={me ?? { id: uid, first_name: null, last_name: null, avatar_url: null }} size={54} />
              </span>
              <button type="button" onClick={() => fileInput.current?.click()} aria-label="Change photo"
                className="absolute -right-1 -bottom-1 flex h-8 w-8 items-center justify-center rounded-full border-2 border-surface bg-ink text-white">
                {uploading ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
              </button>
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <div className="truncate text-xl font-bold">
                {me ? [me.first_name, me.last_name].filter(Boolean).join(" ") || "Add your name" : " "}
              </div>
              {since && (
                <div className="text-[13px] text-muted">
                  Craving since {new Date(since).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                </div>
              )}
            </div>
            <button type="button" onClick={() => setSheet("edit-name")}
              className="h-9 shrink-0 rounded-full border border-border bg-background px-3.5 text-[13px] font-semibold">
              Edit
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Stat value={stats.data?.tried} label="Tried" />
            <Stat value={stats.data?.saved} label="Saved" />
            <Stat value={stats.data?.avg_score != null ? Number(stats.data.avg_score).toFixed(1) : stats.data ? "—" : undefined} label="Avg you give" accent />
          </div>
        </section>

        {/* Lists */}
        <section className="flex flex-col gap-2.5">
          <div className="flex items-baseline justify-between">
            <h2 className="m-0 text-[17px] font-semibold">My Cravelists</h2>
            <span className="font-mono text-xs text-muted">{groups.length}</span>
          </div>
          <ul className="m-0 flex list-none flex-col gap-0.5 rounded-[22px] border border-border bg-surface p-1.5">
            {groups.map((g) => {
              const active = g.id === activeGroupId;
              return (
                <li key={g.id} className={`flex items-center gap-2 rounded-2xl pr-1.5 ${active ? "bg-accent-tint" : ""}`}>
                  <button type="button" onClick={() => onSelectGroup(g.id)} aria-pressed={active}
                    className="flex min-w-0 flex-1 items-center gap-3 p-2.5 text-left">
                    <span className="w-[58px] shrink-0"><AvatarStack people={g.members} max={2} size={28} /></span>
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="truncate text-[15px] font-semibold">{g.name}</span>
                      <span className="text-xs text-muted">
                        {g.members.length} {g.members.length === 1 ? "member" : "members"} · {g.place_count} spots
                      </span>
                    </span>
                  </button>
                  {active && (
                    <span className="rounded-full bg-accent px-2 py-1 font-mono text-[10px] tracking-[0.1em] text-white">ACTIVE</span>
                  )}
                  <button type="button" onClick={() => setSheet({ invite: g })} aria-label={`Invite people to ${g.name}`}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-surface">
                    <Link2 size={17} />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        <div className="grid grid-cols-2 gap-2.5">
          <button type="button" onClick={() => setSheet("join")}
            className="flex h-[84px] flex-col items-start justify-between rounded-[20px] border border-dashed border-border-strong bg-surface p-3.5 text-left">
            <Link2 size={18} aria-hidden="true" />
            <span className="flex flex-col">
              <span className="text-sm font-semibold">Join with code</span>
              <span className="text-[11px] text-muted">Got an invite code?</span>
            </span>
          </button>
          <button type="button" onClick={() => setSheet("create")}
            className="flex h-[84px] flex-col items-start justify-between rounded-[20px] bg-ink p-3.5 text-left text-white">
            <Plus size={18} aria-hidden="true" />
            <span className="flex flex-col">
              <span className="text-sm font-semibold">New Cravelist</span>
              <span className="text-[11px] text-border-strong">Start one, invite anyone</span>
            </span>
          </button>
        </div>

        <div className="flex justify-center gap-5 text-[13px]">
          <button type="button" onClick={signOut} className="h-11 text-muted">Sign out</button>
          <button type="button" onClick={() => setSheet("delete")} className="h-11 text-danger">Delete account</button>
        </div>
      </div>

      {/* ─── Sheets ─── */}
      {sheet === "settings" && (
        <Sheet title="Settings" onClose={close}>
          {error && <p role="alert" className="m-0 mb-3 text-sm text-danger">{error}</p>}
          <div className="flex flex-col gap-2 pb-2">
            <SheetAction icon={<Pencil size={18} />} onClick={() => setSheet("edit-name")}>Edit name</SheetAction>
            <SheetAction icon={<Camera size={18} />} onClick={() => { close(); fileInput.current?.click(); }}>Change photo</SheetAction>
            <SheetAction icon={<LogOut size={18} />} onClick={signOut}>Sign out</SheetAction>
            <SheetAction icon={<Trash2 size={18} />} onClick={() => setSheet("delete")} danger>Delete account</SheetAction>
          </div>
        </Sheet>
      )}

      {sheet === "edit-name" && me && (
        <EditNameSheet profile={me} busy={busy} error={error} onClose={close}
          onSave={(first, last) => run(async () => {
            const { error } = await supabase.from("profiles").update({ first_name: first, last_name: last }).eq("id", uid);
            if (error) throw error;
            await supabase.auth.updateUser({ data: { first_name: first, last_name: last } });
            queryClient.invalidateQueries({ queryKey: ["profile"] });
            queryClient.invalidateQueries({ queryKey: ["groups"] });
            close();
          })}
        />
      )}

      {sheet === "join" && (
        <CodeSheet title="Join a Cravelist" label="Invite code" placeholder="ABC123" cta="Join" busy={busy} error={error} onClose={close}
          transform={(v) => v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6)}
          valid={(v) => v.length === 6}
          onSubmit={(code) => run(async () => {
            const { data, error } = await supabase.rpc("join_group", { invite_code: code });
            if (error) throw new Error(error.message.includes("Invalid share code") ? "That code doesn't match a Cravelist." : error.message);
            await queryClient.invalidateQueries({ queryKey: ["groups"] });
            if (data) onSelectGroup(data);
            close();
          })}
        />
      )}

      {sheet === "create" && (
        <CodeSheet title="New Cravelist" label="Name" placeholder="Weekend Crew" cta="Create" busy={busy} error={error} onClose={close}
          transform={(v) => v.slice(0, 60)}
          valid={(v) => v.trim().length >= 1}
          onSubmit={(name) => run(async () => {
            const { data, error } = await supabase.rpc("create_group", { group_name: name.trim() });
            if (error) throw error;
            await queryClient.invalidateQueries({ queryKey: ["groups"] });
            if (data) onSelectGroup(data);
            close();
          })}
        />
      )}

      {sheet && typeof sheet === "object" && <InviteSheet group={sheet.invite} onClose={close} />}

      {sheet === "delete" && (
        <Sheet title="Delete your account?" onClose={close}>
          <p className="m-0 mb-2 text-[15px] text-ink-2">
            This permanently deletes your profile and your reviews. Places you added stay in shared lists for the people still in them.
          </p>
          <p className="m-0 mb-5 text-[15px] text-ink-2">This can't be undone.</p>
          {error && <p role="alert" className="m-0 mb-3 text-sm text-danger">{error}</p>}
          <div className="flex gap-2 pb-2">
            <button type="button" onClick={close} className="h-[54px] flex-1 rounded-[18px] border border-border text-[15px] font-semibold">Cancel</button>
            <button type="button" disabled={busy}
              onClick={() => run(async () => {
                const { error } = await supabase.rpc("delete_user_account");
                if (error) throw error;
                await signOut();
              })}
              className="flex h-[54px] flex-1 items-center justify-center gap-2 rounded-[18px] bg-danger text-[15px] font-semibold text-white disabled:opacity-50">
              {busy && <Loader2 size={18} className="animate-spin" />} Delete
            </button>
          </div>
        </Sheet>
      )}
    </div>
  );
}

function Stat({ value, label, accent = false }: { value: number | string | undefined; label: string; accent?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-[14px] bg-background px-3 py-2.5">
      <span className={`font-display text-2xl leading-none font-extrabold tabular ${accent ? "text-accent-ink" : ""}`}>
        {value ?? <span className="inline-block h-6 w-8 skeleton rounded align-middle" />}
      </span>
      <span className="text-[11px] text-muted">{label}</span>
    </div>
  );
}

function SheetAction({ icon, children, onClick, danger = false }: { icon: React.ReactNode; children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button type="button" onClick={onClick}
      className={`flex h-[54px] items-center gap-3 rounded-[18px] bg-subtle px-4 text-left text-[15px] font-semibold ${danger ? "text-danger" : "text-ink"}`}>
      {icon}{children}
    </button>
  );
}

function EditNameSheet({ profile, busy, error, onClose, onSave }: {
  profile: Profile; busy: boolean; error: string | null; onClose: () => void; onSave: (first: string, last: string) => void;
}) {
  const [first, setFirst] = useState(profile.first_name ?? "");
  const [last, setLast] = useState(profile.last_name ?? "");
  return (
    <Sheet title="Your name" onClose={onClose}>
      <form className="flex flex-col gap-3 pb-2" onSubmit={(e) => { e.preventDefault(); onSave(first.trim(), last.trim()); }}>
        <TextField label="First name" value={first} onChange={(e) => setFirst(e.target.value)} autoComplete="given-name" autoFocus />
        <TextField label="Last name" value={last} onChange={(e) => setLast(e.target.value)} autoComplete="family-name" />
        {error && <p role="alert" className="m-0 text-sm text-danger">{error}</p>}
        <PrimaryButton type="submit" disabled={busy || !first.trim()} className="mt-2">
          {busy && <Loader2 size={18} className="animate-spin" />} Save
        </PrimaryButton>
      </form>
    </Sheet>
  );
}

function CodeSheet({ title, label, placeholder, cta, busy, error, onClose, onSubmit, transform, valid }: {
  title: string; label: string; placeholder: string; cta: string; busy: boolean; error: string | null;
  onClose: () => void; onSubmit: (v: string) => void; transform: (v: string) => string; valid: (v: string) => boolean;
}) {
  const [value, setValue] = useState("");
  return (
    <Sheet title={title} onClose={onClose}>
      <form className="flex flex-col gap-3 pb-2" onSubmit={(e) => { e.preventDefault(); if (valid(value)) onSubmit(value); }}>
        <TextField label={label} value={value} placeholder={placeholder} autoFocus autoCapitalize="characters"
          onChange={(e) => setValue(transform(e.target.value))} />
        {error && <p role="alert" className="m-0 text-sm text-danger">{error}</p>}
        <PrimaryButton type="submit" disabled={busy || !valid(value)} className="mt-2">
          {busy && <Loader2 size={18} className="animate-spin" />} {cta}
        </PrimaryButton>
      </form>
    </Sheet>
  );
}

function InviteSheet({ group, onClose }: { group: Group; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [code, setCode] = useState(group.share_code ?? "");
  // Reset takes two taps: the old code stops working for anyone who hasn't joined yet.
  const [resetStep, setResetStep] = useState<"idle" | "confirm" | "busy">("idle");
  const [resetError, setResetError] = useState<string | null>(null);
  // The link opens Crave and joins (or the website's join page, which leads to the
  // App Store); the code is there for typing it in by hand.
  const message = `Join "${group.name}" on Crave 👉 ${inviteLink(code)}\n\nOr open Crave → Profile → Join with code: ${code}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard unavailable */ }
  };
  const share = async () => {
    try {
      await Share.share({ title: `Join ${group.name} on Crave`, text: message, dialogTitle: "Invite to Crave" });
    } catch {
      copy();
    }
  };
  const reset = async () => {
    setResetStep("busy");
    setResetError(null);
    const { data, error } = await supabase.rpc("reset_share_code", { p_group_id: group.id });
    if (error || typeof data !== "string") {
      setResetError("Couldn't reset the code. Try again.");
      setResetStep("idle");
      return;
    }
    setCode(data);
    setResetStep("idle");
    queryClient.invalidateQueries({ queryKey: ["groups"] });
  };

  return (
    <Sheet title={`Invite to ${group.name}`} onClose={onClose}>
      <p className="m-0 mb-4 text-sm text-muted">Anyone with this code can join and see everything on this list.</p>
      <div className="mb-4 flex items-center justify-between rounded-2xl bg-subtle px-5 py-4">
        <span className="font-mono text-[32px] font-semibold tracking-[0.2em]" aria-label={`Invite code ${code.split("").join(" ")}`}>{code}</span>
        <button type="button" onClick={copy} aria-label="Copy code"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-surface">
          {copied ? <Check size={18} className="text-mint-ink" /> : <Copy size={18} />}
        </button>
      </div>
      <div className="pb-2">
        <PrimaryButton onClick={share}><Share2 size={18} /> Share invite</PrimaryButton>
      </div>
      <p role="status" className="m-0 h-5 text-center text-xs text-mint-ink">{copied ? "Code copied" : ""}</p>
      <div className="mt-2 flex min-h-11 items-center justify-center gap-3 text-sm">
        {resetStep === "idle" && (
          <button type="button" onClick={() => setResetStep("confirm")} className="h-11 text-muted">
            Reset code
          </button>
        )}
        {resetStep !== "idle" && (
          <>
            <span className="text-muted">The old code will stop working.</span>
            <button type="button" onClick={reset} disabled={resetStep === "busy"}
              className="h-11 font-semibold text-accent-ink">
              {resetStep === "busy" ? <Loader2 size={16} className="animate-spin" /> : "Reset"}
            </button>
            <button type="button" onClick={() => setResetStep("idle")} disabled={resetStep === "busy"} className="h-11 text-muted">
              Cancel
            </button>
          </>
        )}
      </div>
      {resetError && <p role="alert" className="m-0 text-center text-sm text-danger">{resetError}</p>}
    </Sheet>
  );
}
