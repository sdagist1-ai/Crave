import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { MUST_SCORE, type Profile } from "../types";
import { initials } from "../utils/people";
import { formatScore } from "../utils/helpers";

// ─── Avatars ────────────────────────────────────────────────────────────────

const AVATAR_TINTS = ["#FFE0DE", "#D1FAE5", "#DBEAFE", "#EDE9FE", "#FEF3C7", "#FCE7F3", "#E0F2FE"];

function tintFor(key: string) {
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = key.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_TINTS[Math.abs(hash) % AVATAR_TINTS.length];
}

type AvatarProps = {
  person: Pick<Profile, "id" | "first_name" | "last_name" | "avatar_url"> | null | undefined;
  size?: number;
  /** Ring drawn in the page background colour so stacked avatars separate */
  ring?: boolean;
  className?: string;
};

export function Avatar({ person, size = 30, ring = false, className = "" }: AvatarProps) {
  const style = {
    width: size,
    height: size,
    fontSize: Math.max(8, Math.round(size * 0.4)),
    background: tintFor(person?.id ?? person?.first_name ?? "?"),
  };
  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold text-ink ${ring ? "ring-2 ring-surface" : ""} ${className}`}
      style={style}
      aria-hidden="true"
    >
      {person?.avatar_url
        ? <img src={person.avatar_url} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" />
        : initials(person)}
    </span>
  );
}

export function AvatarStack({ people, max = 3, size = 30 }: { people: AvatarProps["person"][]; max?: number; size?: number }) {
  const shown = people.length > max ? people.slice(0, max) : people;
  const extra = people.length - shown.length;
  const overlap = Math.round(size * 0.33);
  return (
    <span className="flex items-center">
      {shown.map((p, i) => (
        <span key={p?.id ?? i} style={{ marginLeft: i ? -overlap : 0 }} className="flex">
          <Avatar person={p} size={size} ring />
        </span>
      ))}
      {extra > 0 && (
        <span
          className="flex items-center justify-center rounded-full bg-ink font-mono font-semibold text-white ring-2 ring-surface"
          style={{ width: size, height: size, marginLeft: -overlap, fontSize: Math.max(8, Math.round(size * 0.34)) }}
        >
          +{extra}
        </span>
      )}
    </span>
  );
}

// ─── Score circle (card) ────────────────────────────────────────────────────

export function ScoreCircle({ avgScore, size = 52 }: { avgScore: number | null; size?: number }) {
  const base = "flex shrink-0 flex-col items-center justify-center rounded-full font-mono leading-none";
  const dims = { width: size, height: size };

  if (avgScore != null && avgScore >= MUST_SCORE) {
    return (
      <span className={`${base} bg-accent text-white shadow-[0_0_24px_rgba(255,69,58,0.35)]`} style={dims}
        aria-label={`Group score ${formatScore(avgScore)}, a must`}>
        <span className="text-base font-semibold">{formatScore(avgScore)}</span>
        <span className="mt-0.5 text-[9px] tracking-wide">MUST</span>
      </span>
    );
  }
  if (avgScore != null) {
    return (
      <span className={`${base} border-2 border-accent`} style={dims} aria-label={`Group score ${formatScore(avgScore)}`}>
        <span className="text-base font-semibold">{formatScore(avgScore)}</span>
        <span className="mt-0.5 text-[9px] text-muted">AVG</span>
      </span>
    );
  }
  return null;
}

// ─── Tags & chips ───────────────────────────────────────────────────────────

const VIBE_TONES: Record<string, string> = {
  Casual: "bg-sky-soft text-sky-ink",
  Elegant: "bg-violet-soft text-violet-ink",
};

export function Tag({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "mint" | "sun" | string }) {
  const cls =
    tone === "neutral" ? "bg-subtle text-ink-2"
    : tone === "mint" ? "bg-mint-soft text-mint-ink"
    : tone === "sun" ? "bg-sun-soft text-sun-ink"
    : tone;
  return <span className={`inline-flex items-center rounded-full px-2 py-[3px] text-[11px] leading-none ${cls}`}>{children}</span>;
}

export function VibeTag({ vibe }: { vibe: string }) {
  return <Tag tone={VIBE_TONES[vibe] ?? "bg-subtle text-ink-2"}>{vibe}</Tag>;
}

export function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`h-9 shrink-0 rounded-full border px-3.5 text-[13px] transition-colors ${
        active ? "border-accent bg-accent-soft font-medium text-accent-ink" : "border-border bg-transparent text-ink-2 active:bg-subtle"
      }`}
    >
      {children}
    </button>
  );
}

// ─── Segmented control ──────────────────────────────────────────────────────

export function Segmented<T extends string>({
  options, value, onChange, size = "md",
}: {
  options: { id: T; label: string; count?: number }[];
  value: T;
  onChange: (v: T) => void;
  size?: "md" | "lg";
}) {
  return (
    <div role="tablist" className="flex rounded-[14px] border border-border bg-subtle p-1">
      {options.map((o) => {
        const active = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.id)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-[10px] text-sm transition-all ${size === "lg" ? "h-[42px]" : "h-10"} ${
              active ? "bg-surface font-semibold text-ink shadow-[0_1px_3px_rgba(15,23,42,0.12)]" : "font-medium text-muted"
            }`}
          >
            {o.label}
            {o.count != null && <span className="font-mono text-xs tabular">{o.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

// ─── Text ───────────────────────────────────────────────────────────────────

export function Eyebrow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`font-mono text-xs tracking-[0.14em] text-muted uppercase ${className}`}>{children}</div>;
}

export function PageTitle({ children }: { children: ReactNode }) {
  return <h1 className="m-0 font-display text-[44px] leading-none font-extrabold tracking-[-0.03em] text-ink">{children}</h1>;
}

// ─── Page chrome ────────────────────────────────────────────────────────────

/** Soft accent glow in a corner of the page (a gradient, not a blur filter — cheap to paint). */
export function Glow({ side = "right", opacity = 0.16 }: { side?: "left" | "right"; opacity?: number }) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute -top-40 h-[420px] w-[420px]"
      style={{
        [side]: -160,
        background: `radial-gradient(closest-side, rgba(255,69,58,${opacity}), rgba(255,69,58,0))`,
      }}
    />
  );
}

// ─── Bottom sheet ───────────────────────────────────────────────────────────

export function Sheet({ title, onClose, children, labelledBy }: {
  title?: string;
  onClose: () => void;
  children: ReactNode;
  labelledBy?: string;
}) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Capture phase + stopPropagation: Escape closes only the top-most sheet,
    // not the page underneath it.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      onClose();
    };
    document.addEventListener("keydown", onKey, true);
    panel.current?.focus();
    return () => document.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  // Portalled to <body> so a sheet opened inside a tab always sits above the tab bar.
  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-ink/40 animate-fade-in" onClick={onClose}>
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={labelledBy ? undefined : title}
        aria-labelledby={labelledBy}
        tabIndex={-1}
        className="relative max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-t-[28px] bg-surface px-5 pt-3 pb-safe outline-none animate-sheet"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-border" />
        {title && (
          <div className="mb-4 flex items-center justify-between">
            <h2 className="m-0 font-display text-2xl font-bold tracking-[-0.02em]">{title}</h2>
            <button type="button" onClick={onClose} aria-label="Close"
              className="flex h-11 w-11 items-center justify-center rounded-full text-muted active:bg-subtle">
              <X size={20} />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>,
    document.body,
  );
}

export function PrimaryButton({ children, className = "", tone = "ink", block = true, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: "ink" | "accent";
  /** Full width (default) or sized to its label */
  block?: boolean;
}) {
  const toneCls = tone === "accent" ? "bg-accent shadow-accent disabled:shadow-none" : "bg-ink";
  return (
    <button
      type="button"
      {...props}
      className={`flex h-[54px] items-center justify-center gap-2 rounded-[18px] text-[15px] font-semibold text-white transition-transform active:scale-[0.98] disabled:opacity-40 ${block ? "w-full" : "px-6"} ${toneCls} ${className}`}
    >
      {children}
    </button>
  );
}

export function TextField({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-medium text-ink-2">{label}</span>
      <input
        {...props}
        className="h-[50px] w-full rounded-2xl border border-border bg-surface px-4 text-[15px] text-ink outline-none placeholder:text-muted focus:border-accent"
      />
    </label>
  );
}
