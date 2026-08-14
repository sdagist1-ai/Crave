import { useState, useMemo, useRef, useEffect } from "react";
import { Utensils, BookOpen, Share2, Dices, Wine, Coffee, Croissant, IceCream, Sun } from "lucide-react";
import confetti from "canvas-confetti";
import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";
import { Restaurant } from "../types";
import { C, VIBE_OPTIONS } from "../constants/theme";
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
    { id: "Restaurants", label: "Restaurants", icon: Utensils },
    { id: "Breakfast & Brunch", label: "Breakfast", icon: Sun },
    { id: "Coffee & Tea", label: "Coffee", icon: Coffee },
    { id: "Bars", label: "Bars", icon: Wine },
    { id: "Bakeries", label: "Bakeries", icon: Croissant },
    { id: "Ice Cream & Dessert", label: "Sweets", icon: IceCream },
  ];

  function getCategory(r: Restaurant): string {
    const t = (r.primaryType || "").toLowerCase();
    const n = (r.name || "").toLowerCase();
    if (t.includes("bagel") || n.includes("bagel") || t.includes("breakfast") || n.includes("breakfast") || t.includes("brunch") || n.includes("brunch") || t.includes("diner") || n.includes("diner")) return "Breakfast & Brunch";
    if (t.includes("bar") || t.includes("pub") || t.includes("night_club") || t.includes("club") || t.includes("wine")) return "Bars";
    if (t.includes("bakery") || n.includes("bakery")) return "Bakeries";
    if (t.includes("cafe") || t.includes("coffee") || t.includes("tea") || n.includes("coffee")) return "Coffee & Tea";
    if (t.includes("ice_cream") || t.includes("dessert") || n.includes("ice cream") || n.includes("gelato")) return "Ice Cream & Dessert";
    return "Restaurants";
  }

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
    // 1. Determine if we can use the true global random RPC or if we must use the local filtered pool
    const hasFilters = nostalgia || filterCategory || selectedVibes.length > 0;
    let trueWinner: Restaurant | null = null;

    if (!hasFilters) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        const { data, error } = await supabase.rpc('get_random_restaurant', { p_group_id: groupId });
        if (!error && data && data.length > 0 && user) {
          // The RPC returns a raw database row (snake_case, missing reviews)
          // We must map it through fetchRestaurants!
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

    // Fallback to local pool if filters exist or RPC fails
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
    const totalTicks = 40 + Math.floor(Math.random() * 20); // More suspenseful
    let speed = 40;

    const runTick = () => {
      tick++;
      setDisplayIndex((prev) => (prev + 1) % pool.length);

      Haptics.impact({ style: ImpactStyle.Light }).catch(() => { });

      if (tick >= totalTicks) {
        setSpinning(false);
        if (trueWinner) {
          setWinner(trueWinner);
          // Try to match the visual display index if it exists in the pool
          const idx = pool.findIndex(r => r.id === trueWinner!.id);
          if (idx !== -1) setDisplayIndex(idx);
        }

        // Massive Success Feedback!
        Haptics.notification({ type: NotificationType.Success }).catch(() => { });
        confetti({
          particleCount: 150,
          spread: 80,
          origin: { y: 0.6 },
          colors: [C.rose, C.amber, '#10B981', '#3B82F6']
        });

        return;
      }

      // Physics deceleration curve
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
    <div className="flex-1 overflow-y-auto px-4 pt-4 pb-4 flex flex-col">
      <div className="text-center mb-4 flex-shrink-0">
        <h2 className="text-xl font-black text-slate-800">{nostalgia ? "Revisit a Favorite" : "Can't Decide?"}</h2>
        <p className="text-sm text-slate-400 mt-1">{nostalgia ? "Spin through places you've loved" : "Let fate pick your next meal"}</p>
      </div>

      <div className="flex gap-1 p-1 rounded-2xl bg-slate-100 mb-5 mx-auto max-w-xs flex-shrink-0">
        <button type="button" onClick={() => { setNostalgia(false); setWinner(null); }}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${!nostalgia ? "bg-white text-slate-800 shadow-sm" : "text-slate-500"}`}>
          New Spots
        </button>
        <button type="button" onClick={() => { setNostalgia(true); setWinner(null); }}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${nostalgia ? "bg-white text-slate-800 shadow-sm" : "text-slate-500"}`}>
          Nostalgia
        </button>
      </div>

      <div className="flex gap-2.5 mb-5 overflow-x-auto scrollbar-none py-2 px-4 -mx-4 flex-shrink-0">
        {PRIMARY_CATEGORIES.map(cat => {
          const Icon = cat.icon;
          const isActive = filterCategory === cat.id;
          return (
            <button key={cat.id} type="button" onClick={() => { setFilterCategory(isActive ? null : cat.id); setWinner(null); }}
              className={`flex items-center gap-1.5 px-4 py-2.5 rounded-2xl text-[13px] font-extrabold transition-all border flex-shrink-0 ${isActive
                ? "bg-slate-800 text-white border-slate-800 shadow-md shadow-slate-200/50 scale-100"
                : "bg-white text-slate-500 border-slate-200 shadow-sm hover:border-slate-300 hover:text-slate-700 active:scale-95"
                }`}
            >
              <Icon size={16} strokeWidth={isActive ? 2.5 : 2} /> {cat.label}
            </button>
          )
        })}
      </div>

      {(!filterCategory || filterCategory === "Restaurants") && (
        <div className="flex flex-wrap justify-center gap-2.5 mb-6 px-4 flex-shrink-0">
          <button type="button" onClick={() => { setSelectedVibes([]); setWinner(null); }}
            className="px-4 py-2 rounded-full text-xs font-bold transition-all border-2 active:scale-95"
            style={selectedVibes.length === 0
              ? { background: C.slate900, color: "#fff", borderColor: C.slate900 }
              : { background: "transparent", color: C.slate600, borderColor: C.slate200 }}>
            All Vibes
          </button>
          {VIBE_OPTIONS.map((vibe) => {
            const isActive = selectedVibes.includes(vibe.label);
            return (
              <button key={vibe.label} type="button"
                onClick={() => {
                  setSelectedVibes(prev => isActive ? prev.filter(v => v !== vibe.label) : [...prev, vibe.label]);
                  setWinner(null);
                }}
                className="flex-shrink-0 px-4 py-2 rounded-full text-xs font-bold transition-all border-2 whitespace-nowrap active:scale-95"
                style={isActive
                  ? { background: vibe.color, color: "#fff", borderColor: vibe.color }
                  : { background: "transparent", color: vibe.color, borderColor: C.slate200 }}>
                {vibe.label}
              </button>
            );
          })}
        </div>
      )}

      {pool.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mb-4"><Utensils size={28} className="text-slate-300" /></div>
          <p className="text-sm text-slate-400 font-medium">{nostalgia ? "No tried restaurants match this vibe" : "No untried restaurants match this vibe"}</p>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center">
          <div className={`w-full max-w-xs transition-all duration-75 ${spinning ? "scale-[0.95]" : "scale-100 bounce-in"}`}>
            <style>{`
              @keyframes bounceIn {
                0% { transform: scale(0.9); opacity: 0; }
                50% { transform: scale(1.05); opacity: 1; }
                100% { transform: scale(1); opacity: 1; }
              }
              .bounce-in { animation: bounceIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
            `}</style>
            <div
              onClick={() => { if (winner && !spinning) onDetail(winner); }}
              className={`bg-white rounded-3xl shadow-xl border-2 overflow-hidden transition-all duration-300 ${winner ? "cursor-pointer active:scale-[0.98] border-rose-400 shadow-rose-200 shadow-2xl scale-[1.02]" : spinning ? "border-amber-300" : "border-slate-100"}`}
            >
              <div className="h-44 bg-slate-100 relative overflow-hidden flex items-center justify-center">
                {currentRestaurant?.photoUrl ? (
                  <img src={currentRestaurant.photoUrl} alt={currentRestaurant.name}
                    className={`w-full h-full object-cover transition-opacity duration-75 ${spinning ? "opacity-70 blur-[1px] scale-105" : "opacity-100"}`} />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-slate-100"><Utensils size={48} className="text-slate-300" /></div>
                )}
                {winner && (
                  <div className="absolute inset-0 bg-gradient-to-t from-rose-500/20 to-transparent" />
                )}
                {spinning && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                    <div className="animate-spin w-12 h-12 rounded-full border-4 border-white border-t-transparent opacity-80" />
                  </div>
                )}
              </div>
              <div className="p-5 text-center">
                <h3 className={`text-xl font-black transition-all ${winner ? "text-rose-500" : "text-slate-800"}`}>
                  {spinning ? (currentRestaurant?.name || "...") : (winner?.name || "Ready to spin?")}
                </h3>
                {(winner || spinning) && currentRestaurant && (
                  <p className="text-sm text-slate-400 mt-1 truncate">
                    {currentRestaurant.primaryType && <span className="text-slate-500 font-bold mr-1.5">{formatPrimaryType(currentRestaurant.primaryType)} &bull;</span>}
                    {currentRestaurant.address}
                  </p>
                )}
                {winner && (
                  <div className="flex flex-wrap gap-1.5 justify-center mt-3">
                    {winner.vibes.map((v) => {
                      const clr = getVibeColor(v);
                      return (
                        <span key={v} className="text-[10px] px-2.5 py-1 rounded-full font-black uppercase tracking-wider"
                          style={{ background: `${clr}18`, color: clr }}>{v}</span>
                      );
                    })}
                  </div>
                )}
                {winner && (
                  <div className="flex items-center justify-center gap-2 mt-4">
                    {winner.bookingUrl && (
                      <a href={winner.bookingUrl} target="_blank" rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-bold text-white"
                        style={{ background: C.slate900 }}>
                        <BookOpen size={14} /> Book Now
                      </a>
                    )}
                    <button type="button" onClick={(e) => {
                      e.stopPropagation();
                      const text = `Crave picked ${winner.name} for me! 🎲\n${winner.address}${winner.bookingUrl ? `\nBook: ${winner.bookingUrl}` : ""}`;
                      if (navigator.share) {
                        navigator.share({ title: `Crave Pick: ${winner.name}`, text }).catch(() => { });
                      } else {
                        navigator.clipboard.writeText(text).then(() => {
                          console.log("SpinTab: copied share text to clipboard");
                        }).catch(() => { });
                      }
                    }}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-bold border-2 transition-all"
                      style={{ color: C.rose, borderColor: C.rose }}>
                      <Share2 size={14} /> Share
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          <button type="button" onClick={startSpin} disabled={spinning || pool.length === 0}
            className="mt-6 w-full max-w-xs py-4 rounded-2xl font-black text-white text-base disabled:opacity-40 transition-all shadow-lg shadow-rose-200 flex items-center justify-center gap-2"
            style={{ background: spinning ? C.amber : C.rose }}>
            <Dices size={20} className={spinning ? "animate-spin" : ""} />
            {spinning ? "Spinning..." : winner ? "Spin Again" : "Spin!"}
          </button>
          <p className="text-xs text-slate-400 mt-2 font-medium">{pool.length} {pool.length === 1 ? "restaurant" : "restaurants"} in the pool</p>
        </div>
      )}
    </div>
  );
}
