import { useState, useEffect, useRef } from "react";
import { Icon } from "@iconify/react";
import { Restaurant, Group } from "../types";
import { supabase } from "../lib/supabase";
import dayjs from "dayjs";

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

  // Deduplicate Global Visited Places by place_id so the passport doesn't show 5 Nobus.
  const uniqueVisited = new Map<string, Restaurant>();
  for (const r of restaurants) {
    if (r.visited || r.userScore) { 
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
  const scored = passportPlaces.filter((r) => r.userScore);
  const avgScore = scored.length > 0 ? scored.reduce((s, r) => s + (r.userScore || 0), 0) / scored.length : 0;

  return (
    <div className="flex-1 bg-background text-foreground flex flex-col font-sans overflow-hidden">
      <main className="flex-1 overflow-y-auto pb-32 px-4 pt-16">
        <div className="mb-8 flex flex-col items-center text-center">
          <h1 className="font-heading text-3xl font-black tracking-tight">Passport</h1>
          <p className="text-muted-foreground text-sm font-medium">Your global culinary journey</p>
        </div>

        <div className="mb-8">
          <div className="relative h-56 rounded-[2.5rem] overflow-hidden shadow-xl border border-border/50">
            <img
              src="https://ggrhecslgdflloszjkwl.supabase.co/storage/v1/object/public/user-assets/vnWFrllBVSN/components/OnTJUbMwhuD.jpeg"
              alt="Map View"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
            <div className="absolute bottom-6 left-8 text-left">
              <p className="text-white/70 text-[10px] font-black uppercase tracking-[0.2em] mb-1">
                Current Base
              </p>
              <h2 className="text-white text-2xl font-black">Global</h2>
            </div>
            <button className="absolute top-6 right-6 bg-white/90 backdrop-blur-md p-3 rounded-2xl shadow-lg text-primary active:scale-90 transition-transform">
              <Icon icon="solar:map-point-wave-bold" width={24} height={24} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-10">
          <div className="bg-card p-5 rounded-[1.75rem] border border-border/50 shadow-sm text-center">
            <p className="text-2xl font-black font-heading text-primary">{passportPlaces.length}</p>
            <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mt-1">Stamps</p>
          </div>
          <div className="bg-card p-5 rounded-[1.75rem] border border-border/50 shadow-sm text-center">
            <p className="text-2xl font-black font-heading text-primary">{avgScore > 0 ? avgScore.toFixed(1) : "—"}</p>
            <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mt-1">Hit Rate</p>
          </div>
          <div className="bg-card p-5 rounded-[1.75rem] border border-border/50 shadow-sm text-center">
            <p className="text-2xl font-black font-heading text-primary">{restaurants.length}</p>
            <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mt-1">Saves</p>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-6 px-2">
            <h2 className="font-heading text-xl font-bold">Recent Stamps</h2>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            {passportPlaces.map(r => (
              <div key={r.id} onClick={() => onDetail(r)} className="bg-card rounded-[2rem] p-3 border border-border/50 shadow-sm group active:scale-[0.98] transition-all cursor-pointer relative">
                <div className="aspect-square rounded-[1.5rem] overflow-hidden relative shadow-inner">
                  {r.photoUrl ? (
                    <img src={r.photoUrl} alt={r.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-secondary flex items-center justify-center">
                      <Icon icon="solar:chef-hat-linear" className="text-muted-foreground size-8" />
                    </div>
                  )}
                  <div className="absolute inset-0 border-[6px] border-white/10 rounded-[1.5rem] pointer-events-none" />
                </div>
                <div className="p-3 text-center">
                  <h3 className="font-bold text-sm mb-0.5 truncate">{r.name}</h3>
                  <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-tight truncate">
                    {r.primaryType ? r.primaryType.split('_')[0] : 'Restaurant'} • {dayjs(r.createdAt).format("MMM YYYY")}
                  </p>
                </div>

                {r.userScore && (
                  <div className="absolute top-4 right-4 bg-background/90 backdrop-blur-sm px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
                    <span className="text-xs font-bold text-foreground">{r.userScore}</span>
                    <span className="text-[10px] font-medium text-muted-foreground">/10</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
        <div ref={observerTarget} className="h-4 w-full flex items-center justify-center mt-2 pb-6">
          {isFetchingNextPage && <Icon icon="solar:spinner-broken-linear" className="animate-spin text-muted-foreground size-5" />}
        </div>
      </main>
    </div>
  );
}
