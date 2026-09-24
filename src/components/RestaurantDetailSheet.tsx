import { useState, useRef, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Icon } from "@iconify/react";
import { Restaurant } from "../types";
import { formatPriceLevel, formatPrimaryType } from "../utils/helpers";
import { syncRestaurantData } from "../lib/places";

export function RestaurantDetailSheet({
  restaurant, onRate, onRemove, onClose, myUid
}: {
  restaurant: Restaurant; onRate: (r: Restaurant) => void; onRemove: (id: number) => void; onClose: () => void; myUid: string | null;
}) {
  const [viewingPhoto, setViewingPhoto] = useState<string | null>(null);
  const [showMapMenu, setShowMapMenu] = useState(false);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [showAllHours, setShowAllHours] = useState(false);
  const touchStartY = useRef(0);
  const touchCurrentY = useRef(0);
  const sheetRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    // Lock the body scroll strictly when this sheet is open!
    document.body.style.overflow = 'hidden';

    // Background TTL Strategy: 30 Day Auto-Sync & Legacy Backfill
    if (!restaurant.lastSyncedAt || !restaurant.openingHours) {
      console.log(`[Background Task] Legacy missing data for ${restaurant.name}. Force syncing...`);
      syncRestaurantData(restaurant.placeId, restaurant.id).then(() => {
        queryClient.invalidateQueries({ queryKey: ["restaurants"] });
      });
    } else {
      const msSinceSync = new Date().getTime() - new Date(restaurant.lastSyncedAt).getTime();
      const daysSinceSync = msSinceSync / (1000 * 60 * 60 * 24);
      if (daysSinceSync >= 30) {
        console.log(`[Background Task] TTL Expired for ${restaurant.name} (${Math.floor(daysSinceSync)} days). Silently syncing...`);
        syncRestaurantData(restaurant.placeId, restaurant.id).then(() => {
          queryClient.invalidateQueries({ queryKey: ["restaurants"] });
        });
      }
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, []);


  const myReview = restaurant.reviews?.find(r => r.user_id === myUid);
  const otherReviews = restaurant.reviews?.filter(r => {
    if (r.user_id === myUid) return false;
    // Deduplicate ghost database entries (e.g. legacy migrations) that mirror your exact review
    if (myReview && r.score === myReview.score && r.notes === myReview.notes) return false;
    return true;
  }) || [];

  const iRated = !!myReview && myReview.score !== null;
  const othersRated = otherReviews.length > 0 && otherReviews.some(r => r.score !== null);
  const bothRated = iRated && othersRated;

  // Compute final top-level score badge (Average of all revealed scores!)
  let displayScore: number | null = null;
  if (bothRated) {
    const validReviews = restaurant.reviews.filter(r => r.score !== null);
    const total = validReviews.reduce((sum, r) => sum + r.score!, 0);
    displayScore = parseFloat((total / validReviews.length).toFixed(1));
  } else if (iRated && !othersRated) {
    displayScore = myReview.score;
  }

  const isPartnered = true; // We assume Cravelists are shared naturally in V2

  // Extract "Today's Hours" for contextual header pill
  const todayDayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  const todaysHoursRow = restaurant.openingHours?.find((desc: string) => desc.startsWith(todayDayName));
  const todaysHoursText = todaysHoursRow ? todaysHoursRow.split(': ')[1] : null;

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
    touchCurrentY.current = e.touches[0].clientY;
    if (sheetRef.current) {
      sheetRef.current.style.transition = 'none';
    }
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    touchCurrentY.current = e.touches[0].clientY;
    const delta = touchCurrentY.current - touchStartY.current;
    if (delta > 0 && sheetRef.current && overlayRef.current) {
      sheetRef.current.style.transform = `translateY(${delta}px)`;
    }
  };
  const handleTouchEnd = () => {
    const delta = touchCurrentY.current - touchStartY.current;
    if (sheetRef.current && overlayRef.current) {
      sheetRef.current.style.transition = 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)';
      if (delta > 120) {
        sheetRef.current.style.transform = `translateY(1000px)`;
        overlayRef.current.style.opacity = '0';
        setTimeout(onClose, 250);
      } else {
        sheetRef.current.style.transform = `translateY(0px)`;
        overlayRef.current.style.opacity = '1';
      }
    }
  };

  return (
    <>
      <div
        ref={overlayRef}
        className="fixed inset-0 z-50 flex flex-col justify-end bg-background/80 backdrop-blur-sm transition-all animate-in fade-in duration-200"
        onClick={onClose}
      >
        <div
          ref={sheetRef}
          className="w-full bg-background rounded-t-[2.5rem] pt-3 pb-safe-or-8 flex flex-col h-auto max-h-[90dvh] shadow-[0_-20px_40px_-15px_rgba(0,0,0,0.1)] border-t border-border/50 relative animate-in slide-in-from-bottom"
          onClick={e => e.stopPropagation()}
        >
          <div
            className="w-full flex justify-center pt-2 pb-4 z-20 cursor-grab active:cursor-grabbing touch-none"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <div className="w-12 h-1.5 rounded-full bg-border" />
          </div>

          <button onClick={onClose} className="absolute top-5 right-5 p-2 bg-secondary rounded-full text-muted-foreground hover:text-foreground active:scale-90 transition-all z-20 shadow-sm border border-border/50">
            <Icon icon="solar:close-circle-bold" className="size-5" />
          </button>

          <div className="flex-1 overflow-y-auto overscroll-contain scrollbar-none w-full max-w-lg mx-auto px-5 pb-8 space-y-6">

            {/* Hero Photo Carousel */}
            {(restaurant.photoUrl || (restaurant.allVisitPhotos && restaurant.allVisitPhotos.length > 0)) && (
              <div className="flex gap-3 overflow-x-auto scrollbar-none snap-x snap-mandatory -mx-5 px-5 pb-2">
                {/* Google Fallback Preview */}
                {restaurant.photoUrl && (
                  <button type="button" onClick={() => setViewingPhoto(restaurant.photoUrl!)}
                    className="relative flex-shrink-0 w-full h-[280px] rounded-[2rem] shadow-sm border border-border/50 overflow-hidden active:scale-[0.98] transition-all snap-center group bg-secondary">
                    <img src={restaurant.photoUrl} alt="Google Preview" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    
                    {/* Top Left: Added By */}
                    <div className="absolute top-4 left-4 bg-background/90 backdrop-blur-md shadow-sm border border-border/50 rounded-full pl-1.5 pr-3 py-1 flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center overflow-hidden flex-shrink-0">
                        {restaurant.addedBy?.avatar_url ? (
                          <img src={restaurant.addedBy.avatar_url} className="w-full h-full object-cover" />
                        ) : (
                          <Icon icon="solar:user-bold" className="text-muted-foreground size-3" />
                        )}
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-foreground">
                        {restaurant.addedBy?.first_name || "Guest"}
                      </span>
                    </div>

                    {/* Top Right: Rating Pill */}
                    {(displayScore || restaurant.rating) && (
                      <div className="absolute top-4 right-4 bg-background/90 backdrop-blur-md shadow-sm border border-border/50 rounded-xl px-3 py-2 text-xs font-black flex items-center gap-1.5"
                        style={{ color: displayScore ? (displayScore <= 3 ? "var(--color-destructive)" : displayScore <= 6 ? "#F97316" : displayScore <= 8 ? "var(--color-primary)" : "#10b981") : "var(--color-primary)" }}>
                        <Icon icon="solar:star-bold" className="size-3.5" /> {displayScore || restaurant.rating}
                      </div>
                    )}
                    
                    {/* Bottom Gradient */}
                    <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/70 to-transparent pointer-events-none" />
                    
                    {/* Bottom Left: Vibe / Price Metadata */}
                    <div className="absolute bottom-4 left-4 flex items-center gap-2">
                      {restaurant.priceLevel && (
                        <span className="text-[11px] px-2.5 py-1.5 rounded-lg font-black bg-white/20 backdrop-blur-md border border-white/10 text-white shadow-sm">{formatPriceLevel(restaurant.priceLevel)}</span>
                      )}
                      {restaurant.vibes && restaurant.vibes.length > 0 && (
                        <span className="text-[11px] px-2.5 py-1.5 rounded-lg font-black uppercase tracking-wider backdrop-blur-md border border-white/20 shadow-sm"
                          style={{ background: 'rgba(255,255,255,0.15)', color: '#fff' }}>
                          {restaurant.vibes[0]}
                        </span>
                      )}
                    </div>
                  </button>
                )}

                {/* User Uploaded Carousel */}
                {restaurant.allVisitPhotos?.map((visit, idx) => (
                  <button key={idx} type="button" onClick={() => setViewingPhoto(visit.url)}
                    className="relative flex-shrink-0 w-full h-[280px] rounded-[2rem] shadow-sm border border-border/50 overflow-hidden active:scale-[0.98] transition-all snap-center group bg-secondary">
                    <img src={visit.url} alt="Visit Upload" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/70 to-transparent pointer-events-none" />
                    <div className="absolute bottom-4 left-4 bg-white/20 backdrop-blur-md border border-white/10 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl shadow-sm">
                      By {(visit.authorName || "Guest")}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Basic Info */}
            <div className="px-1">
              <h2 className="text-3xl font-heading font-black text-foreground leading-tight tracking-tight mb-1">{restaurant.name}</h2>
              
              <p className="text-[15px] font-medium text-muted-foreground mb-3">
                {restaurant.address}
              </p>

              {restaurant.primaryType && (
                <div className="mb-4 flex items-center">
                  <span className="text-foreground font-bold bg-secondary px-2.5 py-1 rounded-md text-[11px] uppercase tracking-wider border border-border/50">
                    {formatPrimaryType(restaurant.primaryType)}
                  </span>
                </div>
              )}

              {/* Expandable Hours Context Pill */}
              {todaysHoursText && (
                <div>
                  <button 
                    onClick={() => setShowAllHours(!showAllHours)}
                    className="flex flex-wrap items-center gap-2 bg-secondary hover:bg-secondary/80 px-3.5 py-2 rounded-xl border border-border/50 transition-colors active:scale-[0.98]">
                    <Icon icon="solar:clock-circle-bold" className="text-muted-foreground size-4" />
                    <span className="text-[12px] font-bold text-foreground">
                      {showAllHours ? "Operating Hours" : <><span className="text-muted-foreground font-medium">Today:</span> {todaysHoursText}</>}
                    </span>
                    <Icon icon="solar:alt-arrow-down-linear" className={`text-muted-foreground size-4 transition-transform duration-300 ml-auto ${showAllHours ? 'rotate-180' : ''}`} />
                  </button>

                  {/* Accordion Dropdown map */}
                  {showAllHours && restaurant.openingHours && (
                    <div className="mt-2 bg-card border border-border/50 shadow-sm rounded-2xl p-4 flex flex-col gap-2 animate-in slide-in-from-top-2 fade-in duration-200">
                      {restaurant.openingHours.map((desc: string, i: number) => {
                        const [day, times] = desc.split(': ');
                        const isToday = todayDayName === day;
                        return (
                          <div key={i} className={`flex justify-between items-center text-[13px] ${isToday ? 'font-black text-primary' : 'font-medium text-muted-foreground'}`}>
                            <span>{day}</span>
                            <span>{times || "Closed"}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* RATINGS GRID */}
            <div className="bg-card p-5 rounded-[2rem] border border-border/50 shadow-sm shadow-foreground/5 space-y-4">
              {(iRated || othersRated) ? (
                <div>
                  <div className="flex items-center gap-2 text-foreground font-black text-sm mb-4 uppercase tracking-widest">
                    <Icon icon="solar:star-fall-bold-duotone" className="text-primary size-5" />
                    Group Ratings
                  </div>
                  <div className="grid grid-cols-2 gap-3 mt-4">
                    {/* My Score */}
                    {iRated && myReview?.score !== null && (
                      <div className="col-span-1 bg-secondary border border-border/50 p-4 rounded-2xl flex flex-col gap-2 relative overflow-hidden">
                        <div className="absolute -right-2 -top-2 text-muted-foreground/10 rotate-12">
                           <Icon icon="solar:user-circle-bold" className="size-16" />
                        </div>
                        <div className="text-[10px] font-black text-muted-foreground tracking-widest uppercase z-10">YOU</div>
                        <div className="text-2xl font-black text-foreground z-10">{myReview.score}<span className="text-xs text-muted-foreground">/10</span></div>
                        {myReview.notes && <p className="text-xs text-muted-foreground font-medium italic mt-1 z-10">"{myReview.notes}"</p>}
                      </div>
                    )}
                    {/* Other Scores */}
                    {otherReviews.filter(r => r.score !== null).map(rev => (
                      <div key={rev.user_id} className="col-span-1 bg-primary/5 border border-primary/10 p-4 rounded-2xl flex flex-col gap-2 relative overflow-hidden">
                         <div className="absolute -right-2 -top-2 text-primary/10 rotate-12">
                           <Icon icon="solar:user-heart-bold" className="size-16" />
                        </div>
                        <div className="text-[10px] font-black text-primary/70 tracking-widest uppercase truncate z-10">{(rev.authorName || "GUEST").toUpperCase()}</div>
                        <div className="text-2xl font-black text-primary z-10">{rev.score}<span className="text-xs text-primary/50">/10</span></div>
                        {rev.notes && <p className="text-xs text-primary/80 font-medium italic mt-1 z-10">"{rev.notes}"</p>}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-6 text-center px-4">
                  <div className="w-16 h-16 bg-secondary border border-border text-muted-foreground rounded-full flex items-center justify-center mb-4 shadow-inner">
                    <Icon icon="solar:chef-hat-bold" className="size-8" />
                  </div>
                  <h4 className="font-heading font-black text-foreground text-xl">Ready to try this?</h4>
                  <p className="text-sm font-medium text-muted-foreground mt-2 max-w-[250px] leading-relaxed">Visit this spot and submit your rating!</p>
                </div>
              )}
            </div>

            {/* Action Grid */}
            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setShowMapMenu(true)}
                className="flex flex-col items-center justify-center gap-2.5 py-6 bg-card rounded-[2rem] shadow-sm shadow-foreground/5 border border-border/50 text-foreground font-bold text-[13px] active:scale-95 hover:bg-secondary/50 transition-all">
                <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center mb-1"><Icon icon="solar:routing-3-bold" className="size-6" /></div>
                Directions
              </button>

              <button type="button" onClick={() => onRate(restaurant)}
                className="flex flex-col items-center justify-center gap-2.5 py-6 bg-card rounded-[2rem] shadow-sm shadow-foreground/5 border border-border/50 text-foreground font-bold text-[13px] active:scale-95 hover:bg-secondary/50 transition-all">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-1" style={{ background: iRated ? "var(--color-primary-10)" : "var(--color-primary-10)", color: iRated ? "var(--color-primary)" : "var(--color-primary)" }}>
                  <Icon icon={iRated ? "solar:star-fall-bold" : "solar:pen-bold"} className="size-6" />
                </div>
                {iRated ? "Edit Rating" : `Add Rating`}
              </button>

              {restaurant.bookingUrl ? (
                <a href={restaurant.bookingUrl} target="_blank" rel="noopener noreferrer"
                  className="flex flex-col items-center justify-center gap-2.5 py-6 bg-foreground rounded-[2rem] shadow-lg shadow-foreground/20 text-background font-bold text-[13px] active:scale-95 transition-all">
                  <Icon icon="solar:book-bookmark-bold" className="size-6 mb-1 text-background/70" /> {restaurant.bookingPlatform || "Book"}
                </a>
              ) : restaurant.websiteUrl ? (
                <a href={restaurant.websiteUrl} target="_blank" rel="noopener noreferrer"
                  className="flex flex-col items-center justify-center gap-2.5 py-6 bg-foreground rounded-[2rem] shadow-lg shadow-foreground/20 text-background font-bold text-[13px] active:scale-95 transition-all">
                  <Icon icon="solar:global-bold" className="size-6 mb-1 text-background/70" /> Website
                </a>
              ) : (
                <a href={`https://www.google.com/search?q=${encodeURIComponent(restaurant.name + " " + restaurant.address + " reservation")}`} target="_blank" rel="noopener noreferrer"
                  className="flex flex-col items-center justify-center gap-2.5 py-6 bg-card rounded-[2rem] shadow-sm shadow-foreground/5 border border-border/50 text-foreground font-bold text-[13px] active:scale-95 hover:bg-secondary/50 transition-all">
                  <Icon icon="solar:magnifer-bold" className="size-6 mb-1 text-muted-foreground" /> Find Booking
                </a>
              )}

              <button type="button" onClick={() => setShowRemoveConfirm(true)}
                className="flex flex-col items-center justify-center gap-2.5 py-6 bg-destructive/5 rounded-[2rem] border border-destructive/10 text-destructive font-bold text-[13px] active:scale-95 hover:bg-destructive/10 transition-all">
                <Icon icon="solar:trash-bin-trash-bold" className="size-6 mb-1" /> Remove
              </button>
            </div>

          </div>
        </div>
      </div>

      {showMapMenu && (
        <div className="fixed inset-0 z-[60] bg-background/60 backdrop-blur-md flex items-end justify-center transition-all animate-in fade-in duration-200" onClick={() => setShowMapMenu(false)}>
          <div className="w-full max-w-sm bg-card rounded-t-[2.5rem] pb-safe-or-8 pt-4 px-6 shadow-2xl border-t border-border/50 animate-in slide-in-from-bottom duration-300" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-1.5 rounded-full bg-border mx-auto mb-6" />
            <h3 className="text-center font-heading font-black text-foreground text-xl mb-6 tracking-tight">Open Directions In...</h3>

            <div className="flex flex-col gap-3 mb-6">
              <a href={`https://maps.apple.com/?daddr=${encodeURIComponent(restaurant.address)}`} target="_blank" rel="noopener noreferrer"
                className="w-full py-4 bg-secondary rounded-2xl font-bold text-center border border-border/50 text-foreground active:scale-[0.98] transition-all text-[15px]">Apple Maps</a>

              <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(restaurant.address)}`} target="_blank" rel="noopener noreferrer"
                className="w-full py-4 bg-secondary rounded-2xl font-bold text-center border border-border/50 text-foreground active:scale-[0.98] transition-all text-[15px]">Google Maps</a>

              <a href={`https://waze.com/ul?q=${encodeURIComponent(restaurant.address)}`} target="_blank" rel="noopener noreferrer"
                className="w-full py-4 rounded-2xl font-bold text-center bg-foreground text-background active:scale-[0.98] shadow-xl shadow-foreground/20 transition-all text-[15px]">Waze</a>
            </div>
            <button onClick={() => setShowMapMenu(false)} className="w-full py-4 bg-transparent text-muted-foreground font-bold rounded-2xl hover:bg-secondary transition-colors">Cancel</button>
          </div>
        </div>
      )}

      {viewingPhoto && (() => {
        const galleryPhotos = [
          ...(restaurant.photoUrl ? [restaurant.photoUrl] : []),
          ...(restaurant.allVisitPhotos?.map(p => p.url) || [])
        ];
        const initialIndex = Math.max(0, galleryPhotos.findIndex(u => u === viewingPhoto));

        return (
          <div className="fixed inset-0 z-[80] bg-black/95 backdrop-blur-xl flex flex-col animate-in fade-in duration-200" onClick={() => setViewingPhoto(null)}>
            <div className="absolute top-0 right-0 w-full flex justify-end p-safe-or-6 pt-12 pb-4 z-50 pointer-events-none">
              <button onClick={(e) => { e.stopPropagation(); setViewingPhoto(null); }} className="p-3 bg-white/10 rounded-full text-white active:scale-90 transition-transform pointer-events-auto mr-4">
                <Icon icon="solar:close-circle-bold" className="size-6" />
              </button>
            </div>

            <div
              className="flex-1 w-full overflow-x-auto flex snap-x snap-mandatory scrollbar-none items-center"
              onClick={e => e.stopPropagation()}
              ref={(node) => {
                if (node && !node.dataset.scrolled) {
                  node.dataset.scrolled = "true";
                  node.scrollTo({ left: node.clientWidth * initialIndex, behavior: 'instant' });
                }
              }}
            >
              {galleryPhotos.map((url, i) => (
                <div key={i} className="min-w-full h-full flex items-center justify-center p-2 snap-center">
                  <img src={url} alt={`Gallery ${i}`} className="w-full max-h-[85vh] object-contain select-none" />
                </div>
              ))}
            </div>

            {galleryPhotos.length > 1 && (
              <div className="absolute bottom-10 left-0 right-0 flex justify-center pointer-events-none">
                <div className="bg-white/10 backdrop-blur-md px-5 py-2 rounded-full border border-white/10 text-white/80 text-[10px] font-black tracking-widest uppercase shadow-xl animate-pulse">
                  Swipe for more
                </div>
              </div>
            )}
          </div>
        );
      })()}


      {showRemoveConfirm && (
        <div className="fixed inset-0 z-[100] bg-background/80 backdrop-blur-md flex items-center justify-center p-6 transition-all animate-in fade-in duration-200" onClick={() => setShowRemoveConfirm(false)}>
          <div className="w-full max-w-sm bg-card rounded-[2rem] p-8 shadow-2xl flex flex-col items-center text-center animate-in zoom-in-95 duration-200 border border-border/50" onClick={e => e.stopPropagation()}>
            <div className="w-16 h-16 bg-destructive/10 text-destructive rounded-full flex items-center justify-center mb-5 shadow-inner">
              <Icon icon="solar:trash-bin-trash-bold" className="size-8" />
            </div>
            <h3 className="font-heading font-black text-foreground text-2xl mb-2">Are you sure?</h3>
            <p className="text-muted-foreground text-[15px] font-medium mb-8 leading-relaxed">
              This will permanently remove <span className="text-foreground font-bold">{restaurant.name}</span> from your Cravelist.
            </p>

            <div className="flex w-full gap-3">
              <button onClick={() => setShowRemoveConfirm(false)} className="flex-1 py-4 bg-secondary text-foreground font-bold rounded-2xl active:scale-95 transition-all">No, Keep It</button>
              <button onClick={() => { setShowRemoveConfirm(false); onRemove(restaurant.id); }} className="flex-1 py-4 bg-destructive text-destructive-foreground font-bold rounded-2xl active:scale-95 shadow-lg shadow-destructive/20 transition-all">Yes, Remove</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
