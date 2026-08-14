import { Utensils, Star, Check } from "lucide-react";
import { C } from "../constants/theme";
import { Restaurant } from "../types";
import { formatPriceLevel, getVibeColor, formatPrimaryType } from "../utils/helpers";

export function RestaurantCard({
  restaurant, onDetail,
}: {
  restaurant: Restaurant; onDetail: (r: Restaurant) => void;
}) {
  return (
    <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden transition-shadow hover:shadow-md">
      <button type="button" onClick={() => onDetail(restaurant)}
        className="w-full text-left p-4 flex gap-4 active:bg-slate-50/50 transition-colors">
        <div className="relative flex-shrink-0">
          {restaurant.photoUrl ? (
            <img src={restaurant.photoUrl} alt={restaurant.name} className="w-20 h-20 rounded-2xl object-cover" />
          ) : (
            <div className="w-20 h-20 rounded-2xl bg-slate-100 flex items-center justify-center"><Utensils size={24} className="text-slate-300" /></div>
          )}
          {restaurant.userScore ? (
            <div className="absolute top-1 right-1 bg-white/90 backdrop-blur-sm rounded-lg px-1.5 py-0.5 text-[10px] font-black flex items-center gap-0.5 shadow-sm"
              style={{ color: restaurant.userScore <= 3 ? C.rose : restaurant.userScore <= 5 ? "#F97316" : restaurant.userScore <= 7 ? C.amber : C.emerald }}>
              {restaurant.userScore}<span className="text-slate-400 font-bold">/10</span>
            </div>
          ) : restaurant.rating ? (
            <div className="absolute top-1 right-1 bg-white/90 backdrop-blur-sm rounded-lg px-1.5 py-0.5 text-[10px] font-black text-slate-700 flex items-center gap-0.5 shadow-sm">
              <Star size={10} fill={C.amber} stroke={C.amber} />
              {restaurant.rating}
            </div>
          ) : null}
          {restaurant.visited && (
            <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center shadow-sm"
              style={{ background: C.emerald, border: `2px solid ${C.white}` }}>
              <Check size={12} className="text-white" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
          <div>
            <h3 className="font-bold text-lg text-slate-800 leading-tight">{restaurant.name}</h3>
            <p className="text-xs text-slate-400 truncate mt-1">
              {restaurant.primaryType && <span className="text-slate-500 font-bold mr-1.5">{formatPrimaryType(restaurant.primaryType)} &bull;</span>}
              {restaurant.address}
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {!restaurant.visited && restaurant.userScore && (
              <span className="text-[9px] px-2 py-0.5 rounded-full font-black uppercase tracking-widest bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center gap-1">
                <Check size={10} strokeWidth={3} /> You've been here
              </span>
            )}
            {restaurant.vibes.map((vibe) => {
              const color = getVibeColor(vibe);
              return (
                <span key={vibe} className="text-[10px] px-2 py-0.5 rounded-full font-black uppercase tracking-wider"
                  style={{ background: `${color}18`, color }}>{vibe}</span>
              );
            })}
            {restaurant.priceLevel && (
              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-slate-100 text-slate-500">{formatPriceLevel(restaurant.priceLevel)}</span>
            )}
          </div>
        </div>
      </button>
    </div>
  );
}
