import { useState, useRef, useEffect } from "react";
import { Icon } from "@iconify/react";
import confetti from "canvas-confetti";
import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";
import { Restaurant } from "../types";
import { VIBE_OPTIONS } from "../constants/theme";
import { getVibeColor, formatPrimaryType } from "../utils/helpers";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { fetchRestaurants } from "../App";

export function SpinTab({ onDetail, groupId }: { onDetail: (r: Restaurant) => void, groupId: string }) {
  const [selectedVibes, setSelectedVibes] = useState<string[]>([]);
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [nostalgia, setNostalgia] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [displayIndex, setDisplayIndex] = useState(0);
  const [winner, setWinner] = useState<Restaurant | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { restaurants: [] };
      return fetchRestaurants({
        uid: user.id,
        groupId,
        filterTab: nostalgia ? "tried" : "cravelist",
        filterCategory,
        filterVibes: selectedVibes
      });
    },
    enabled: !!groupId
  });
  
  const pool = poolResp?.restaurants || [];

  const startSpin = async () => {
    const hasFilters = nostalgia || filterCategory || selectedVibes.length > 0;
    let trueWinner: Restaurant | null = null;

    if (!hasFilters) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        const { data, error } = await supabase.rpc('get_random_restaurant', { p_group_id: groupId });
        if (!error && data && data.length > 0 && user) {
          const rawRow = data[0] as any;
          const { restaurants } = await fetchRestaurants({
            uid: user.id,
            groupId,
            restaurantId: rawRow.id
          });
          if (restaurants && restaurants.length > 0) {
            trueWinner = restaurants[0];
          }
        }
      } catch (e) {
        console.error("RPC failed, falling back to local pool", e);
      }
    }

    if (!trueWinner) {
      if (pool.length < 2) {
        if (pool.length === 1 && pool[0]) setWinner(pool[0]);
        return;
      }
      const winnerIdx = Math.floor(Math.random() * pool.length);
      trueWinner = pool[winnerIdx] || null;
    }

    if (!trueWinner) return;

    setWinner(null);
    setSpinning(true);

    let tick = 0;
    const totalTicks = 40 + Math.floor(Math.random() * 20);
    let speed = 40;

    const runTick = () => {
      tick++;
      setDisplayIndex((prev) => (prev + 1) % pool.length);
      Haptics.impact({ style: ImpactStyle.Light }).catch(() => { });

      if (tick >= totalTicks) {
        setSpinning(false);
        if (trueWinner) {
          setWinner(trueWinner);
          const idx = pool.findIndex(r => r.id === trueWinner!.id);
          if (idx !== -1) setDisplayIndex(idx);
        }

        Haptics.notification({ type: NotificationType.Success }).catch(() => { });
        confetti({
          particleCount: 150,
          spread: 80,
          origin: { y: 0.6 },
          colors: ['#ff453a', '#ffd60a', '#0a84ff', '#32ade6']
        });
        return;
      }

      if (tick > totalTicks * 0.4) {
        speed = speed * 1.08;
      }
      intervalRef.current = setTimeout(runTick, speed);
    };

    intervalRef.current = setTimeout(runTick, speed);
  };

  useEffect(() => {
    return () => { if (intervalRef.current) clearTimeout(intervalRef.current); };
  }, []);

  const currentRestaurant = (winner && !spinning) ? winner : pool[displayIndex];

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
                {currentRestaurant?.photoUrl ? (
                  <img src={currentRestaurant.photoUrl} alt={currentRestaurant.name} className={`w-full h-full object-cover transition-opacity duration-75 ${spinning ? "opacity-70 blur-[2px] scale-110" : "opacity-100"}`} />
                ) : (
                  <div className="w-full h-full bg-secondary flex items-center justify-center">
                    <Icon icon="solar:chef-hat-linear" className="text-muted-foreground size-12" />
                  </div>
                )}
                {winner && <div className="absolute inset-0 bg-gradient-to-t from-primary/20 to-transparent" />}
                {spinning && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                    <Icon icon="solar:spinner-broken-linear" className="animate-spin text-white size-12" />
                  </div>
                )}
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
