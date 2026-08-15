import { Icon } from "@iconify/react";
import { Restaurant } from "../types";
import { formatPriceLevel, formatPrimaryType } from "../utils/helpers";

export function RestaurantCard({
  restaurant, onDetail,
}: {
  restaurant: Restaurant; onDetail: (r: Restaurant) => void;
}) {
  return (
    <div 
      onClick={() => onDetail(restaurant)}
      className="bg-card rounded-[1.5rem] p-3 shadow-[0_2px_12px_rgba(0,0,0,0.04)] border border-border/50 flex gap-4 active:scale-[0.98] transition-transform cursor-pointer"
    >
      <div className="relative shrink-0">
        {restaurant.photoUrl ? (
          <img
            src={restaurant.photoUrl}
            alt={restaurant.name}
            className="w-[100px] h-[100px] rounded-2xl object-cover shadow-sm bg-secondary"
          />
        ) : (
          <div className="w-[100px] h-[100px] rounded-2xl bg-secondary flex items-center justify-center">
            <Icon icon="solar:chef-hat-linear" className="text-muted-foreground size-8" />
          </div>
        )}
        
        {restaurant.userScore ? (
          <div className="absolute top-1.5 right-1.5 bg-background/90 backdrop-blur-sm px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
            <span className="text-xs font-bold text-foreground">{restaurant.userScore}</span>
            <span className="text-[10px] font-medium text-muted-foreground">/10</span>
          </div>
        ) : restaurant.rating ? (
          <div className="absolute top-1.5 right-1.5 bg-background/90 backdrop-blur-sm px-1.5 py-0.5 rounded-full flex items-center gap-0.5 shadow-sm">
            <Icon icon="solar:star-bold" className="text-orange-400" width={12} height={12} />
            <span className="text-xs font-bold text-foreground">{restaurant.rating}</span>
          </div>
        ) : null}

        {restaurant.visited && (
          <div className="absolute -bottom-2 -right-2 bg-green-500 text-white rounded-full p-1 border-2 border-card shadow-sm flex items-center justify-center">
            <Icon icon="solar:check-read-linear" width={14} height={14} />
          </div>
        )}
      </div>

      <div className="flex-1 py-1 flex flex-col justify-center overflow-hidden">
        <h3 className="font-heading font-bold text-base leading-tight mb-0.5 truncate">
          {restaurant.name}
        </h3>
        <p className="text-[11px] text-muted-foreground font-medium mb-2.5 truncate">
          {restaurant.primaryType ? `${formatPrimaryType(restaurant.primaryType)} • ` : ''}
          {restaurant.address}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {(!restaurant.visited && restaurant.userScore) ? (
            <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-bold tracking-wide uppercase flex items-center gap-1 border border-emerald-100">
              <Icon icon="solar:check-read-linear" width={10} height={10} /> You've been here
            </span>
          ) : null}
          {restaurant.vibes.map((vibe) => (
            <span key={vibe} className="px-2.5 py-1 rounded-full bg-accent text-accent-foreground text-[10px] font-bold tracking-wide uppercase">
              {vibe}
            </span>
          ))}
          {restaurant.priceLevel && (
            <span className="px-2.5 py-1 rounded-full bg-secondary text-secondary-foreground text-[10px] font-bold tracking-wide">
              {formatPriceLevel(restaurant.priceLevel)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
