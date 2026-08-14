import { useState, useEffect, useRef } from "react";
import { TrendingUp, PieChart, MapPin, Search, Loader2 } from "lucide-react";
import { Restaurant, Group } from "../types";
import { C } from "../constants/theme";
import { getVibeColor } from "../utils/helpers";
import { supabase } from "../lib/supabase";

export function CalendarTab({ 
  restaurants, groups, onDetail, fetchNextPage, hasNextPage, isFetchingNextPage 
}: { 
  restaurants: Restaurant[]; 
  groups: Group[]; 
  onDetail: (r: Restaurant) => void;
  fetchNextPage: () => void;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
}) {
  const [activeRecommendId, setActiveRecommendId] = useState<number | null>(null);
  const observerTarget = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => observer.disconnect();
  }, [observerTarget, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const handleRecommend = async (r: Restaurant, targetGroupId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from("restaurants").insert({
        owner: user?.id ?? "",
        group_id: targetGroupId,
        place_id: r.placeId,
        name: r.name,
        address: r.address,
        latitude: String(r.latitude),
        longitude: String(r.longitude),
        rating: r.rating ? String(r.rating) : null,
        user_rating_count: r.userRatingCount,
        price_level: r.priceLevel,
        primary_type: r.primaryType,
        photo_url: r.photoUrl,
        vibes: JSON.stringify(r.vibes || []),
        notes: "Recommended from Global Stats!",
        visited: false,
        created_at: new Date().toISOString(),
      });
      setActiveRecommendId(null);
      alert(`Sent ${r.name} to the group!`);
    } catch (e) {
      console.error("Failed to recommend:", e);
    }
  };

  // 1. Deduplicate Global Visited Places by place_id so the passport doesn't show 5 Nobus.
  const uniqueVisited = new Map<string, Restaurant>();
  for (const r of restaurants) {
    if (r.visited || r.userScore) { 
      // It counts as a globally visited place if they went or scored it
      if (!uniqueVisited.has(r.placeId)) {
        uniqueVisited.set(r.placeId, r);
      } else {
        const existing = uniqueVisited.get(r.placeId)!;
        if ((r.userScore || 0) > (existing.userScore || 0)) {
          uniqueVisited.set(r.placeId, r);
        }
      }
    }
  }

  const passportPlaces = Array.from(uniqueVisited.values()).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // Compute Vibe Diversity based on UNIQUE places
  const vibeCounts = {} as Record<string, number>;
  for (const r of passportPlaces) {
    for (const v of r.vibes) {
      vibeCounts[v] = (vibeCounts[v] || 0) + 1;
    }
  }
  const totalVibesCount = Object.values(vibeCounts).reduce((a, b) => a + b, 0);
  const sortedVibes = Object.entries(vibeCounts).sort((a, b) => b[1] - a[1]);

  const scored = passportPlaces.filter((r) => r.userScore);
  const avgScore = scored.length > 0 ? scored.reduce((s, r) => s + (r.userScore || 0), 0) / scored.length : 0;

  return (
    <div className="flex-1 overflow-y-auto scrollbar-none px-4 pt-4 pb-6 bg-slate-50">

      {/* Hero Stats */}
      <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 mb-4">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp size={18} style={{ color: C.rose }} />
          <span className="font-black text-slate-800">Global Passport</span>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-3xl font-black" style={{ color: C.rose }}>{passportPlaces.length}</div>
            <div className="text-[11px] text-slate-400 font-bold mt-0.5 uppercase tracking-widest">Places</div>
          </div>
          <div className="text-center border-l divide-slate-100">
            <div className="text-3xl font-black text-slate-800">{restaurants.length}</div>
            <div className="text-[11px] text-slate-400 font-bold mt-0.5 uppercase tracking-widest">Saves</div>
          </div>
          <div className="text-center border-l divide-slate-100">
            <div className="text-3xl font-black" style={{ color: C.amber }}>{avgScore > 0 ? avgScore.toFixed(1) : "—"}</div>
            <div className="text-[11px] text-slate-400 font-bold mt-0.5 uppercase tracking-widest">Avg Hit</div>
          </div>
        </div>
      </div>

      {/* Vibe Profile Chart */}
      <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <PieChart size={18} style={{ color: C.amber }} />
          <span className="font-black text-slate-800">Your Vibe Breakdown</span>
        </div>

        {totalVibesCount > 0 ? (
          <div>
            <div className="flex h-3 rounded-full overflow-hidden mb-4 shadow-inner">
              {sortedVibes.map(([vibe, count]) => (
                <div key={vibe} className="h-full transition-all duration-500"
                  style={{ width: `${(count / totalVibesCount) * 100}%`, background: getVibeColor(vibe) }} />
              ))}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {sortedVibes.slice(0, 4).map(([vibe, count]) => (
                <div key={vibe} className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                  <div className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ background: getVibeColor(vibe) }} />
                  {vibe} <span className="text-slate-400">({Math.round((count / totalVibesCount) * 100)}%)</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-xs text-slate-400">Rate places across the app to build your taste profile!</p>
        )}
      </div>

      <div className="flex items-center justify-between mb-4 px-1">
        <h2 className="text-lg font-black text-slate-800 tracking-tight">Everywhere You've Been</h2>
      </div>

      {passportPlaces.length === 0 ? (
        <div className="pt-10 pb-16 flex flex-col items-center justify-center text-center opacity-70">
          <div className="w-16 h-16 bg-slate-200 rounded-full flex items-center justify-center mb-4"><MapPin size={24} className="text-slate-400" /></div>
          <p className="text-slate-500 font-bold max-w-[200px]">Your global passport is empty.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 pb-8">
          {passportPlaces.map(r => {
             return (
               <div key={r.id} className="relative aspect-[4/5] rounded-3xl overflow-hidden shadow-sm group border border-slate-100/50 bg-white">
                 <button type="button" onClick={() => onDetail(r)} className="absolute inset-0 w-full h-full text-left">
                   {r.photoUrl ? (
                     <img src={r.photoUrl} alt={r.name} className="w-full h-full object-cover" />
                   ) : (
                     <div className="w-full h-full flex flex-col items-center justify-center bg-slate-100 text-slate-300">
                       <Search size={32} strokeWidth={1.5} className="mb-2" />
                     </div>
                   )}
                   <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-3 pb-4">
                     <h3 className="text-white font-black text-sm leading-tight drop-shadow-md truncate">{r.name}</h3>
                     {r.userScore && (
                       <div className="flex items-center gap-1 mt-1">
                         <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md bg-white/20 backdrop-blur-md text-white">
                           {r.userScore} <span className="opacity-60 text-[8px]">/10</span>
                         </span>
                       </div>
                     )}
                   </div>
                 </button>
                 
                 {/* Recommend Actions Overlay */}
                 <div className="absolute top-2 right-2 flex flex-col items-end gap-1 z-10">
                   {activeRecommendId === r.id ? (
                     <div className="bg-white/95 backdrop-blur-md p-2 rounded-2xl shadow-xl border border-slate-100/50 flex flex-col gap-1 w-32 origin-top-right animate-in fade-in zoom-in-95 duration-200">
                       <span className="text-[8px] font-black uppercase text-slate-400 tracking-widest mb-1 px-1">Recommend to:</span>
                       {groups.filter(g => g.id !== r.groupId).length === 0 && (
                         <span className="text-[10px] text-slate-400 px-1 py-1 font-bold">No other groups!</span>
                       )}
                       {groups.filter(g => g.id !== r.groupId).map(g => (
                         <button key={g.id} type="button" onClick={() => handleRecommend(r, g.id)}
                           className="w-full text-left px-2 py-1.5 rounded-xl text-[10px] font-bold truncate active:scale-95 transition-all bg-rose-50 text-rose-600 hover:bg-rose-100">
                           {g.name}
                         </button>
                       ))}
                       <button type="button" onClick={() => setActiveRecommendId(null)} className="w-full text-center mt-1 py-1.5 text-[10px] font-bold text-slate-400 hover:text-slate-600">Cancel</button>
                     </div>
                   ) : (
                     <button type="button" onClick={() => setActiveRecommendId(r.id)}
                       className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-md text-white border border-white/20 flex items-center justify-center shadow-sm active:scale-90 transition-all hover:bg-white/30">
                       <MapPin size={12} strokeWidth={3} />
                     </button>
                   )}
                 </div>
               </div>
             );
          })}
        </div>
      )}
      
      {/* Infinite Scroll Trigger */}
      <div ref={observerTarget} className="h-4 w-full flex items-center justify-center mt-2 pb-6">
        {isFetchingNextPage && <Loader2 size={20} className="animate-spin text-slate-400" />}
      </div>
    </div>
  );
}
