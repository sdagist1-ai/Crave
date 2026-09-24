import { useState, useRef, useEffect } from "react";
import { Icon } from "@iconify/react";
import confetti from "canvas-confetti";
import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";
import { Restaurant } from "../types";
import { VIBE_OPTIONS } from "../constants/theme";
import { getVibeColor, formatPrimaryType } from "../utils/helpers";
import { useQuery } from "@tanstack/react-query";
import { getCurrentUserId } from "../lib/supabase";
import { fetchRestaurants } from "../lib/restaurants";

export function SpinTab({ onDetail, groupId }: { onDetail: (r: Restaurant) => void, groupId: string }) {
  const [selectedVibes, setSelectedVibes] = useState<string[]>([]);
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [nostalgia, setNostalgia] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [reelItems, setReelItems] = useState<Restaurant[]>([]);
  const [winner, setWinner] = useState<Restaurant | null>(null);
  const animRef = useRef<number | null>(null);
  const reelRef = useRef<HTMLDivElement>(null);

  const PRIMARY_CATEGORIES = [
    { id: "Restaurants", label: "Restaurants", icon: "solar:chef-hat-linear" },
    { id: "Breakfast & Brunch", label: "Breakfast", icon: "solar:sun-2-linear" },
    { id: "Coffee & Tea", label: "Coffee", icon: "solar:cup-hot-linear" },
    { id: "Bars", label: "Bars", icon: "solar:wineglass-linear" },
    { id: "Bakeries", label: "Bakeries", icon: "fluent-emoji:croissant" },
    { id: "Ice Cream & Dessert", label: "Sweets", icon: "fluent-emoji:ice-cream" },
  ];

  const { data: poolResp } = useQuery({
    queryKey: ["spin_pool", groupId, nostalgia, filterCategory, selectedVibes],
    queryFn: async () => {
      const uid = await getCurrentUserId();
      if (!uid) return { restaurants: [] };
      return fetchRestaurants({
        uid,
        groupId,
        filterTab: nostalgia ? "tried" : "cravelist",
        filterCategory,
        filterVibes: selectedVibes,
        all: true
      });
    },
    enabled: !!groupId
  });
  
  const pool = poolResp?.restaurants || [];

  const startSpin = async () => {
    if (pool.length === 0) return;

    if (pool.length === 1) {
      if (pool[0]) setWinner(pool[0]);
      return;
    }
    
    // Ensure consecutive spins with pool > 1 do not immediately repeat the previous winner
    const eligiblePool = (winner && pool.length > 1)
      ? pool.filter(r => r.id !== winner.id)
      : pool;

    // Cryptographically uniform random selection across the entire eligible pool
    const randomBuffer = new Uint32Array(1);
    crypto.getRandomValues(randomBuffer);
    const randomFraction = randomBuffer[0] / (0xffffffff + 1);
    const winnerIdx = Math.floor(randomFraction * eligiblePool.length);
    const trueWinner = eligiblePool[winnerIdx] || null;

    if (!trueWinner) return;

    // Fisher-Yates shuffle helper for true unbiased reel randomness
    const shuffle = <T,>(arr: T[]): T[] => {
      const a = [...arr];
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    };

    // Generate reel of at least 30 items for a long spin
    let tempReel = shuffle(pool);
    while (tempReel.length < 30) {
      tempReel = [...tempReel, ...shuffle(pool)];
    }
    // Remove all instances of the winner so we can strictly place it at the very end
    tempReel = tempReel.filter(r => r.id !== trueWinner.id);
    tempReel.push(trueWinner);
    
    setWinner(null);
    setReelItems(tempReel);
    setSpinning(true);

    // Wait a frame for React to mount the reel DOM nodes
    setTimeout(() => {
      const targetY = - (tempReel.length - 1) * 192; // 192px is w-48 h-48 in Tailwind
      const duration = 4000 + Math.random() * 1000; // 4 to 5 seconds spin
      const startTime = performance.now();
      let lastCrossedIndex = 0;

      // Quartic easing out for a dramatic, mechanical slow down
      const easeOutQuart = (t: number) => 1 - Math.pow(1 - t, 4);

      const animate = (time: number) => {
        const elapsed = time - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easedProgress = easeOutQuart(progress);
        const currentY = easedProgress * targetY;
        
        if (reelRef.current) {
          reelRef.current.style.transform = `translateY(${currentY}px)`;
          // Dynamic motion blur based on speed
          const speed = 1 - progress;
          reelRef.current.style.filter = speed > 0.2 ? `blur(${speed * 4}px)` : 'none';
        }

        // Mechanical tick haptics exactly as cards cross the center
        const currentIndex = Math.floor(Math.abs(currentY) / 192);
        if (currentIndex > lastCrossedIndex && progress < 0.98) {
          lastCrossedIndex = currentIndex;
          Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
        }

        if (progress < 1) {
          animRef.current = requestAnimationFrame(animate);
        } else {
          setSpinning(false);
          setWinner(trueWinner);
          Haptics.notification({ type: NotificationType.Success }).catch(() => {});
          confetti({
            particleCount: 150,
            spread: 80,
            origin: { y: 0.6 },
            colors: ['#ff453a', '#ffd60a', '#0a84ff', '#32ade6']
          });
        }
      };
      animRef.current = requestAnimationFrame(animate);
    }, 50);
  };

  useEffect(() => {
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, []);



  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans overflow-hidden">
      <header className="pt-safe-or-4 pt-12 px-6">
        <h1 className="font-heading text-3xl font-black tracking-tight text-center">
          The Crave Spin
        </h1>
        <p className="text-muted-foreground text-sm font-medium text-center mt-1">
          {nostalgia ? "Revisit a favorite spot." : "Can't decide? Let fate choose your dinner."}
        </p>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 relative pb-32">
        <div className="absolute inset-0 -z-10 overflow-hidden opacity-20 pointer-events-none">
          <img
            src="https://ggrhecslgdflloszjkwl.supabase.co/storage/v1/object/public/user-assets/vnWFrllBVSN/components/SDmJm55W3bR.jpeg"
            alt=""
            className="w-full h-full object-cover blur-2xl scale-110"
          />
        </div>

        {/* The Box */}
        <div className={`relative w-full aspect-square max-w-[320px] flex items-center justify-center transition-all duration-300 ${spinning ? "scale-95" : winner ? "scale-105" : "scale-100"}`}>
          <div className="absolute inset-0 bg-primary/20 rounded-full blur-3xl animate-pulse" />
          
          <div 
            onClick={() => { if (winner && !spinning) onDetail(winner); }}
            className={`w-48 h-48 bg-card rounded-[2.5rem] shadow-2xl border flex items-center justify-center relative overflow-hidden transition-all duration-300 ${winner ? "cursor-pointer border-primary shadow-primary/30 rotate-0" : "border-border rotate-12"}`}
          >
            {(!spinning && !winner) ? (
              <>
                <Icon icon="mdi:dice-5" className="text-primary size-24 drop-shadow-lg" />
                <div className="absolute top-4 left-4 w-3 h-3 rounded-full bg-secondary" />
                <div className="absolute bottom-4 right-4 w-3 h-3 rounded-full bg-secondary" />
              </>
            ) : (
              <>
                <div ref={reelRef} className="absolute top-0 left-0 w-full flex flex-col will-change-transform">
                  {reelItems.map((r, i) => (
                    <div key={`${r.id}-${i}`} className="w-48 h-48 shrink-0 flex items-center justify-center relative">
                      {r.photoUrl ? (
                        <img src={r.photoUrl} alt={r.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-secondary flex items-center justify-center">
                          <Icon icon="solar:chef-hat-linear" className="text-muted-foreground size-12" />
                        </div>
                      )}
                      {/* Premium gradient overlay over the image */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/10" />
                    </div>
                  ))}
                </div>
                {winner && <div className="absolute inset-0 bg-gradient-to-t from-primary/30 to-transparent pointer-events-none transition-opacity duration-1000" />}
              </>
            )}
          </div>

          {/* Bouncing Icons - Only when idle */}
          {!spinning && !winner && (
            <>
              <div className="absolute top-0 left-0 animate-bounce delay-75">
                <div className="bg-card p-3 rounded-2xl shadow-md border border-border">
                  <Icon icon="fluent-emoji:pizza" className="size-6" />
                </div>
              </div>
              <div className="absolute bottom-10 left-4 animate-bounce delay-300">
                <div className="bg-card p-3 rounded-2xl shadow-md border border-border">
                  <Icon icon="fluent-emoji:hamburger" className="size-6" />
                </div>
              </div>
              <div className="absolute top-10 right-4 animate-bounce delay-150">
                <div className="bg-card p-3 rounded-2xl shadow-md border border-border">
                  <Icon icon="fluent-emoji:sushi" className="size-6" />
                </div>
              </div>
            </>
          )}
        </div>

        <div className="mt-8 w-full max-w-[320px] space-y-6">
          {winner ? (
            <div className="text-center animate-in slide-in-from-bottom-4 fade-in duration-300">
              <h3 className="font-heading font-black text-2xl text-primary mb-1">
                {winner.name}
              </h3>
              <p className="text-xs text-muted-foreground font-medium mb-4">
                {winner.primaryType && <span className="font-bold text-foreground">{formatPrimaryType(winner.primaryType)} &bull; </span>}
                {winner.address}
              </p>
              
              <div className="flex flex-wrap gap-2 justify-center mb-6">
                {winner.vibes.map((v) => (
                  <span key={v} className="px-2.5 py-1 rounded-full bg-accent text-accent-foreground text-[10px] font-bold tracking-wide uppercase">
                    {v}
                  </span>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3">
                {winner.bookingUrl && (
                  <a href={winner.bookingUrl} target="_blank" rel="noopener noreferrer" className="col-span-1 bg-foreground text-background py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2">
                    <Icon icon="solar:calendar-linear" className="size-4" /> Book
                  </a>
                )}
                <button 
                  className={`${winner.bookingUrl ? 'col-span-1' : 'col-span-2'} bg-secondary text-foreground py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 border border-border/50`}
                  onClick={() => {
                    const text = `Crave picked ${winner.name} for me! 🎲\n${winner.address}${winner.bookingUrl ? `\nBook: ${winner.bookingUrl}` : ""}`;
                    navigator.clipboard.writeText(text).catch(() => {});
                  }}
                >
                  <Icon icon="solar:share-linear" className="size-4" /> Share
                </button>
              </div>

              <button type="button" onClick={startSpin} disabled={spinning}
                className="mt-6 w-full bg-primary/10 text-primary py-4 rounded-full font-bold text-base hover:bg-primary/20 transition-all flex items-center justify-center gap-2">
                <Icon icon="mdi:dice-5" className="size-5" /> SPIN AGAIN
              </button>
            </div>
          ) : (
            <>
              {/* Filters Box */}
              <div className="bg-card/80 backdrop-blur-md p-4 rounded-3xl border border-border/50 flex flex-col gap-4 shadow-sm">
                
                {/* Nostalgia Toggle */}
                <div className="flex bg-secondary p-1 rounded-2xl">
                  <button type="button" onClick={() => { setNostalgia(false); setWinner(null); }}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${!nostalgia ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}>
                    New Spots
                  </button>
                  <button type="button" onClick={() => { setNostalgia(true); setWinner(null); }}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${nostalgia ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}>
                    Nostalgia
                  </button>
                </div>

                {/* Categories */}
                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                  {PRIMARY_CATEGORIES.map(cat => {
                    const isActive = filterCategory === cat.id;
                    return (
                      <button key={cat.id} type="button" onClick={() => { setFilterCategory(isActive ? null : cat.id); setWinner(null); }}
                        className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all border ${isActive
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background text-muted-foreground border-border hover:border-primary/50"
                          }`}
                      >
                        <Icon icon={cat.icon} className="size-4" /> {cat.label}
                      </button>
                    )
                  })}
                </div>

                {/* Vibes */}
                {(!filterCategory || filterCategory === "Restaurants") && (
                  <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                    {VIBE_OPTIONS.map((vibe) => {
                      const isActive = selectedVibes.includes(vibe.label);
                      return (
                        <button key={vibe.label} type="button"
                          onClick={() => {
                            setSelectedVibes(prev => isActive ? prev.filter(v => v !== vibe.label) : [...prev, vibe.label]);
                            setWinner(null);
                          }}
                          className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${isActive
                            ? "bg-accent text-accent-foreground border-accent-foreground/20"
                            : "bg-background text-muted-foreground border-border hover:border-accent"
                            }`}
                        >
                          {vibe.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <button type="button" onClick={startSpin} disabled={spinning || pool.length === 0}
                className="w-full bg-primary text-primary-foreground py-4 rounded-full font-bold text-lg shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:scale-100">
                <Icon icon="solar:play-bold" className="size-6" />
                {spinning ? "SPINNING..." : "SPIN NOW"}
              </button>
              
              <p className="text-center text-xs text-muted-foreground font-medium mt-2">
                {pool.length} {pool.length === 1 ? "spot" : "spots"} in the pool
              </p>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
