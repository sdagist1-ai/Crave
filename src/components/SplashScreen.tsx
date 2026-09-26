import { useState, useEffect, useRef } from "react";

// Word, bites, gone. It ends as soon as the app behind it is ready (`ready`), but not
// before the bites have had their moment, and never later than MAX_MS (the app shows
// its loading skeleton after that). Bites: 5 × 0.25 s, starting 60 ms apart, so the
// last one lands at EAT_AT_MS + 490 ms, just before the fade.
const EAT_AT_MS = 250;
const MIN_MS = 750;
const MAX_MS = 2500;
const FADE_MS = 200;

export function AnimatedSplash({ ready = true, onFading, onComplete }: {
  ready?: boolean;
  /** The fade-out has started: a good moment to start showing what's underneath. */
  onFading?: () => void;
  onComplete: () => void;
}) {
  const [eating, setEating] = useState(false);
  const [minElapsed, setMinElapsed] = useState(false);
  const [maxElapsed, setMaxElapsed] = useState(false);
  // Latest callbacks without restarting the timers when the parent re-renders.
  const complete = useRef(onComplete);
  const fading = useRef(onFading);
  useEffect(() => { complete.current = onComplete; fading.current = onFading; }, [onComplete, onFading]);

  useEffect(() => {
    const eat = setTimeout(() => setEating(true), EAT_AT_MS);
    const min = setTimeout(() => setMinElapsed(true), MIN_MS);
    const max = setTimeout(() => setMaxElapsed(true), MAX_MS);
    return () => { clearTimeout(eat); clearTimeout(min); clearTimeout(max); };
  }, []);

  const finish = minElapsed && (ready || maxElapsed);
  const phase: "writing" | "eating" | "done" = finish ? "done" : eating ? "eating" : "writing";
  useEffect(() => {
    if (!finish) return;
    fading.current?.();
    const t = setTimeout(() => complete.current(), FADE_MS);
    return () => clearTimeout(t);
  }, [finish]);

  return (
    <div
      onClick={onComplete}
      className="fixed inset-0 z-[100] bg-background flex items-center justify-center transition-opacity duration-200 overflow-hidden cursor-pointer"
      style={{ opacity: phase === "done" ? 0 : 1 }}
    >
      <style>{`
        .crave-splash-text {
          font-family: var(--font-display);
          letter-spacing: -0.04em;
        }

        @keyframes bite {
          0% { transform: scale(0); opacity: 0; }
          20% { opacity: 1; transform: scale(1.1); }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>

      <div className="relative w-full max-w-[280px] h-32 flex items-center justify-center">
        {/* The Text - Visible immediately */}
        <h1
          className="crave-splash-text text-[64px] font-extrabold text-accent"
        >
          Crave
        </h1>

        {/* The Bites (Render during eating and done phases to prevent text reveal) */}
        {phase !== "writing" && (
          <>
            <CartoonBite className="w-16 h-16 right-4 top-8" delay="0s" />
            <CartoonBite className="w-20 h-20 -left-2 top-2" delay="0.06s" />
            <CartoonBite className="w-[90px] h-[90px] left-1/2 -ml-10 bottom-2" delay="0.12s" />
            <CartoonBite className="w-40 h-40 left-1/2 -ml-20 top-1/2 -mt-20" delay="0.18s" />
            <CartoonBite className="w-64 h-64 left-1/2 -ml-32 top-1/2 -mt-32" delay="0.24s" />
          </>
        )}
      </div>
    </div>
  );
}

function CartoonBite({ className, delay }: { className: string, delay: string }) {
  // mathematical ring of 10 teeth
  return (
    <div className={`absolute opacity-0 flex items-center justify-center ${className}`}
      style={{ animation: `bite 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275) ${delay} forwards` }}>
      <div className="absolute w-[80%] h-[80%] bg-background rounded-full" />
      {Array.from({ length: 12 }).map((_, i) => {
        const angle = (i / 12) * Math.PI * 2;
        const x = Math.cos(angle) * 40;
        const y = Math.sin(angle) * 40;
        return (
          <div key={i} className="absolute w-[35%] h-[35%] bg-background rounded-full"
            style={{ transform: `translate(${x}%, ${y}%)` }} />
        );
      })}
    </div>
  );
}
