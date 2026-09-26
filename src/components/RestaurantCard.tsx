import { memo } from "react";
import { Star, UtensilsCrossed } from "lucide-react";
import type { Restaurant } from "../types";
import { formatPriceLevel, placeSubtitle } from "../utils/helpers";
import { Avatar, AvatarStack, ScoreCircle, OccasionTag, Tag } from "./ui";
import { displayName } from "../utils/people";

// Memoised: a list re-renders whenever anything on screen changes (a sheet opening,
// a page landing), and each card's work is the same unless its place changed.
export const RestaurantCard = memo(function RestaurantCard({ restaurant: r, memberCount, onOpen }: {
  restaurant: Restaurant;
  memberCount: number;
  onOpen: (r: Restaurant) => void;
}) {
  const raters = r.reviews.filter((rev) => rev.score != null);
  const price = formatPriceLevel(r.priceLevel);
  const subtitle = placeSubtitle(r);
  // Google's rating is a hint for places nobody here has scored yet; once the
  // crew has scored it, their score (the circle) is what matters.
  const showGoogle = r.avgScore == null && r.rating != null;

  return (
    <button
      type="button"
      onClick={() => onOpen(r)}
      className="flex w-full items-center gap-3.5 rounded-[22px] border border-border bg-surface p-2.5 text-left transition-transform active:scale-[0.98]"
    >
      <span className="relative flex h-[84px] w-[84px] shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-subtle">
        {r.photoUrl
          ? <img src={r.photoUrl} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" />
          : <UtensilsCrossed size={26} className="text-border-strong" aria-hidden="true" />}
      </span>

      <span className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="truncate text-[17px] font-semibold leading-tight text-ink">{r.name}</span>
        {(subtitle || showGoogle) && (
          <span className="flex min-w-0 items-center gap-1.5 text-[13px] text-muted">
            {subtitle && <span className="truncate">{subtitle}</span>}
            {showGoogle && (
              <span className="inline-flex shrink-0 items-center gap-0.5" aria-label={`Google rating ${r.rating!.toFixed(1)}`}>
                {subtitle && <span aria-hidden="true">·</span>}
                <Star size={11} className="fill-[#f59e0b] text-[#f59e0b]" aria-hidden="true" />
                <span className="tabular">{r.rating!.toFixed(1)}</span>
              </span>
            )}
          </span>
        )}
        {(r.occasions.length > 0 || price) && (
          <span className="flex flex-wrap gap-1.5">
            {r.occasions.slice(0, 2).map((o) => <OccasionTag key={o} occasion={o} />)}
            {price && <Tag>{price}</Tag>}
          </span>
        )}
        {raters.length > 0 ? (
          <span className="flex items-center gap-1.5">
            <AvatarStack
              people={raters.map((rev) => ({ id: rev.user_id, first_name: rev.authorName ?? null, last_name: null, avatar_url: rev.authorAvatar ?? null }))}
              max={4}
              size={18}
            />
            <span className="text-[11px] text-muted">
              {memberCount > 1 ? `${raters.length} of ${memberCount} rated` : "Rated"}
            </span>
          </span>
        ) : r.addedBy ? (
          <span className="flex items-center gap-1.5">
            <Avatar person={r.addedBy} size={18} />
            <span className="text-[11px] text-muted">Added by {displayName(r.addedBy)}</span>
          </span>
        ) : null}
      </span>

      <ScoreCircle avgScore={r.avgScore} />
    </button>
  );
});

export function RestaurantCardSkeleton() {
  return (
    <div className="flex items-center gap-3.5 rounded-[22px] border border-border bg-surface p-2.5" aria-hidden="true">
      <div className="h-[84px] w-[84px] shrink-0 skeleton rounded-2xl" />
      <div className="flex flex-1 flex-col gap-2">
        <div className="h-4 w-3/4 skeleton rounded-md" />
        <div className="h-3 w-1/2 skeleton rounded-md" />
        <div className="h-4 w-16 skeleton rounded-full" />
      </div>
      <div className="h-[52px] w-[52px] shrink-0 skeleton rounded-full" />
    </div>
  );
}
