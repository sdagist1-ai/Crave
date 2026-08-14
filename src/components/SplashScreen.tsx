import { useState, useEffect } from "react";
import { C } from "../constants/theme";

export function AnimatedSplash({ onComplete }: { onComplete: () => void }) {
  const [phase, setPhase] = useState<"writing" | "eating" | "done">("writing");

  useEffect(() => {
    // 1. Write-on effect lasts 1.5s
    const eatTimer = setTimeout(() => {
      setPhase("eating");
    }, 1500);

    // 2. Eating effect lasts 1.5s
    const doneTimer = setTimeout(() => {
      setPhase("done");
    }, 3200);

    // 3. Fade out the splash entirely
    const unmountTimer = setTimeout(() => {
      onComplete();
    }, 3800);

    return () => {
      clearTimeout(eatTimer);
      clearTimeout(doneTimer);
      clearTimeout(unmountTimer);
    };
  }, [onComplete]);

  return (
    <div
      className="fixed inset-0 z-[100] bg-white flex items-center justify-center transition-opacity duration-500 overflow-hidden"
      style={{ opacity: phase === "done" ? 0 : 1 }}
    >
      <style>{`
        @keyframes fadeInCrave {
          0% { opacity: 0; transform: scale(0.95); }
          100% { opacity: 1; transform: scale(1); }
        }
        
        .fade-in-text {
          animation: fadeInCrave 1.2s cubic-bezier(0.1, 0.7, 0.1, 1) forwards;
          font-family: 'DM Sans', sans-serif;
          letter-spacing: -2px;
        }

        @keyframes bite {
          0% { transform: scale(0); opacity: 0; }
          20% { opacity: 1; transform: scale(1.1); }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>

      <div className="relative w-full max-w-[280px] h-32 flex items-center justify-center">
        {/* The Text */}
        <h1
          className="fade-in-text text-6xl font-black italic tracking-tighter"
          style={{ color: C.rose }}
        >
          Crave
        </h1>

        {/* The Bites (Render during eating and done phases to prevent text reveal) */}
        {phase !== "writing" && (
          <>
            <CartoonBite className="w-16 h-16 right-4 top-8" delay="0s" />
            <CartoonBite className="w-20 h-20 -left-2 top-2" delay="0.2s" />
            <CartoonBite className="w-[90px] h-[90px] left-1/2 -ml-10 bottom-2" delay="0.45s" />
            <CartoonBite className="w-40 h-40 left-1/2 -ml-20 top-1/2 -mt-20" delay="0.7s" />
            <CartoonBite className="w-64 h-64 left-1/2 -ml-32 top-1/2 -mt-32" delay="1s" />
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
      style={{ animation: `bite 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) ${delay} forwards` }}>
      <div className="absolute w-[80%] h-[80%] bg-white rounded-full" />
      {Array.from({ length: 12 }).map((_, i) => {
        const angle = (i / 12) * Math.PI * 2;
        const x = Math.cos(angle) * 40;
        const y = Math.sin(angle) * 40;
        return (
          <div key={i} className="absolute w-[35%] h-[35%] bg-white rounded-full"
            style={{ transform: `translate(${x}%, ${y}%)` }} />
        );
      })}
    </div>
  );
}
