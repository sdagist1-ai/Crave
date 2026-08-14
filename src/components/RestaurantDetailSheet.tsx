import { useState, useRef, useEffect } from "react";
import { Utensils, Star, BookOpen, Globe, Search, MapPin, Trash2, X, HeartHandshake, Clock, ChevronDown, User } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { C } from "../constants/theme";
import { Restaurant } from "../types";
import { formatPriceLevel, getVibeColor, formatPrimaryType } from "../utils/helpers";
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
      syncRestaurantData(restaurant.placeId, restaurant.id, supabase).then(() => {
        queryClient.invalidateQueries({ queryKey: ["restaurants"] });
      });
    } else {
      const msSinceSync = new Date().getTime() - new Date(restaurant.lastSyncedAt).getTime();
      const daysSinceSync = msSinceSync / (1000 * 60 * 60 * 24);
      if (daysSinceSync >= 30) {
        console.log(`[Background Task] TTL Expired for ${restaurant.name} (${Math.floor(daysSinceSync)} days). Silently syncing...`);
        syncRestaurantData(restaurant.placeId, restaurant.id, supabase).then(() => {
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
        className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-sm transition-all animate-in fade-in duration-200"
        onClick={onClose}
      >
        <div
          ref={sheetRef}
          className="w-full bg-slate-50 rounded-t-[2.5rem] pt-3 pb-safe-or-8 flex flex-col h-auto max-h-[85dvh] shadow-[0_-20px_40px_-15px_rgba(0,0,0,0.3)] relative animate-in slide-in-from-bottom"
          onClick={e => e.stopPropagation()}
        >
          <div
            className="w-full flex justify-center pt-2 pb-5 z-20 cursor-grab active:cursor-grabbing touch-none"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <div className="w-14 h-[5px] rounded-full bg-slate-300/80" />
          </div>

          <button onClick={onClose} className="absolute top-5 right-5 p-2.5 bg-slate-200/60 rounded-full text-slate-500 active:scale-90 transition-transform z-20">
            <X size={18} strokeWidth={3} />
          </button>

          <div className="flex-1 overflow-y-auto overscroll-contain scrollbar-none w-full max-w-lg mx-auto px-6 pb-8 space-y-6">

            {/* Headers */}
            <div className="pr-12">
              <h2 className="text-[28px] font-black text-slate-800 leading-tight tracking-tight">{restaurant.name}</h2>
              <p className="text-sm text-slate-500 mt-2 font-medium">
                {restaurant.primaryType && <span className="text-slate-700 font-bold mr-1.5">{formatPrimaryType(restaurant.primaryType)} &bull;</span>}
                {restaurant.address}
              </p>

              {/* Expandable Hours Context Pill */}
              {todaysHoursText && (
                <div className="mt-3">
                  <button 
                    onClick={() => setShowAllHours(!showAllHours)}
                    className="flex flex-wrap items-center gap-2 bg-slate-100/80 hover:bg-slate-200/60 px-3 py-1.5 rounded-xl border border-slate-200 transition-colors active:scale-[0.98]">
                    <Clock size={12} className="text-slate-500" />
                    <span className="text-[11px] font-black tracking-wide text-slate-700 uppercase">
                      {showAllHours ? "Operating Hours" : `Today: ${todaysHoursText}`}
                    </span>
                    <ChevronDown size={14} className={`text-slate-400 transition-transform duration-300 ${showAllHours ? 'rotate-180' : ''}`} />
                  </button>

                  {/* Accordion Dropdown map */}
                  {showAllHours && restaurant.openingHours && (
                    <div className="mt-2 bg-slate-50 border border-slate-100 rounded-2xl p-3.5 flex flex-col gap-1.5 animate-in slide-in-from-top-2 fade-in duration-200">
                      {restaurant.openingHours.map((desc: string, i: number) => {
                        const [day, times] = desc.split(': ');
                        const isToday = todayDayName === day;
                        return (
                          <div key={i} className={`flex justify-between items-center text-[12px] ${isToday ? 'font-black text-rose-500' : 'font-medium text-slate-500'}`}>
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

            {/* Photo Carousel Array */}
            {(restaurant.photoUrl || (restaurant.allVisitPhotos && restaurant.allVisitPhotos.length > 0)) && (
              <div className="flex gap-3 overflow-x-auto scrollbar-none pb-2 -mx-6 px-6 snap-x snap-mandatory">

                {/* Google Fallback Preview */}
                {restaurant.photoUrl && (
                  <button type="button" onClick={() => setViewingPhoto(restaurant.photoUrl!)}
                    className="relative flex-shrink-0 w-[65vw] max-w-[260px] h-48 rounded-3xl shadow-sm border border-slate-200 overflow-hidden active:scale-[0.98] transition-all snap-center group">
                    <img src={restaurant.photoUrl} alt="Google Preview" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    
                    {/* Top Right: Rating Pill */}
                    {(displayScore || restaurant.rating) && (
                      <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-md shadow-sm rounded-xl px-2.5 py-1.5 text-xs font-black flex items-center gap-1 leading-none"
                        style={{ color: displayScore ? (displayScore <= 3 ? C.rose : displayScore <= 6 ? "#F97316" : displayScore <= 8 ? C.amber : C.emerald) : C.amber }}>
                        <Star size={11} fill="currentColor" stroke="currentColor" /> {displayScore || restaurant.rating}
                      </div>
                    )}
                    
                    {/* Bottom Gradient overlay for legibility */}
                    <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
                    
                    {/* Bottom Left: Vibe / Price Metadata */}
                    <div className="absolute bottom-3 left-3 flex items-center gap-1.5">
                      {restaurant.priceLevel && (
                        <span className="text-[10px] px-2 py-1 rounded-lg font-black bg-white/20 backdrop-blur-md border border-white/10 text-white shadow-sm">{formatPriceLevel(restaurant.priceLevel)}</span>
                      )}
                      {restaurant.vibes && restaurant.vibes.length > 0 && (
                        <span className="text-[10px] px-2 py-1 rounded-lg font-black uppercase tracking-wider backdrop-blur-md border border-white/20 shadow-sm"
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
                    className="relative flex-shrink-0 w-[65vw] max-w-[260px] h-48 rounded-3xl shadow-md border-4 border-white overflow-hidden bg-slate-100 active:scale-[0.98] transition-all snap-center">
                    <img src={visit.url} alt="Visit Upload" className="w-full h-full object-cover" />
                    <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-xl text-white text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl shadow-sm border border-white/10">
                      By {(visit.authorName || "Guest")}
                    </div>
                  </button>
                ))}

              </div>
            )}

            {/* Added By Tag */}
            <div className="flex items-center gap-2.5 px-2 py-3 mb-2">
              <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center overflow-hidden border border-slate-300 shadow-sm">
                {restaurant.addedBy?.avatar_url ? (
                  <img src={restaurant.addedBy.avatar_url} className="w-full h-full object-cover" />
                ) : (
                  <User size={14} className="text-slate-400" />
                )}
              </div>
              <div className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                Added by <span className="text-slate-700">{restaurant.addedBy?.first_name || "Former Member"}</span>
              </div>
            </div>

            {/* RATINGS GRID */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-4">
              {(iRated || othersRated) ? (
                <div>
                  <div className="flex items-center gap-2 text-slate-700 font-bold text-sm mb-4">
                    <Star size={14} fill={C.amber} stroke={C.amber} />
                    Group Ratings
                  </div>
                  <div className="grid grid-cols-2 gap-3 mt-4">
                    {/* My Score */}
                    {iRated && myReview?.score !== null && (
                      <div className="col-span-1 bg-slate-50 border border-slate-100 p-3.5 rounded-2xl flex flex-col gap-2">
                        <div className="text-[11px] font-black text-slate-400 tracking-wider">YOU</div>
                        <div className="text-lg font-black text-slate-800">{myReview.score}<span className="text-[10px] text-slate-300">/10</span></div>
                        {myReview.notes && <p className="text-xs text-slate-600 font-medium italic">"{myReview.notes}"</p>}
                      </div>
                    )}
                    {/* Other Scores */}
                    {otherReviews.filter(r => r.score !== null).map(rev => (
                      <div key={rev.user_id} className="col-span-1 bg-rose-50 border border-rose-100 p-3.5 rounded-2xl flex flex-col gap-2">
                        <div className="text-[11px] font-black text-rose-400 tracking-wider truncate">{(rev.authorName || "GUEST").toUpperCase()}</div>
                        <div className="text-lg font-black text-rose-800">{rev.score}<span className="text-[10px] text-rose-300">/10</span></div>
                        {rev.notes && <p className="text-xs text-rose-600 font-medium italic">"{rev.notes}"</p>}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-5 text-center px-4">
                  <div className="w-14 h-14 bg-slate-50 border border-slate-100 text-slate-400 rounded-full flex items-center justify-center mb-3">
                    <Utensils size={24} />
                  </div>
                  <h4 className="font-bold text-slate-800 text-[17px]">Ready to try this?</h4>
                  <p className="text-sm font-medium text-slate-500 mt-1.5 max-w-[250px]">Visit this spot and submit your rating!</p>
                </div>
              )}
            </div>

            {/* Action Grid */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button type="button" onClick={() => setShowMapMenu(true)}
                className="flex flex-col items-center justify-center gap-2 py-5 bg-white rounded-3xl shadow-sm border border-slate-200 text-slate-700 font-bold text-sm active:scale-95 active:bg-slate-50 transition-all">
                <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center mb-1"><MapPin size={22} /></div>
                Directions
              </button>

              <button type="button" onClick={() => onRate(restaurant)}
                className="flex flex-col items-center justify-center gap-2 py-5 bg-white rounded-3xl shadow-sm border border-slate-200 text-slate-700 font-bold text-sm active:scale-95 active:bg-slate-50 transition-all">
                <div className="w-12 h-12 rounded-full flex items-center justify-center mb-1" style={{ background: iRated ? C.emeraldLight : C.amber + '15', color: iRated ? C.emerald : C.amber }}>
                  {iRated ? <Star size={22} /> : <Utensils size={22} />}
                </div>
                {iRated ? "Edit Rating" : `Add Rating`}
              </button>

              {restaurant.bookingUrl ? (
                <a href={restaurant.bookingUrl} target="_blank" rel="noopener noreferrer"
                  className="flex flex-col items-center justify-center gap-2 py-5 bg-slate-900 rounded-3xl shadow-md text-white font-bold text-sm active:scale-95 transition-all">
                  <BookOpen size={22} className="mb-1 text-slate-300" /> {restaurant.bookingPlatform || "Book"}
                </a>
              ) : restaurant.websiteUrl ? (
                <a href={restaurant.websiteUrl} target="_blank" rel="noopener noreferrer"
                  className="flex flex-col items-center justify-center gap-2 py-5 bg-slate-900 rounded-3xl shadow-md text-white font-bold text-sm active:scale-95 transition-all">
                  <Globe size={22} className="mb-1 text-slate-300" /> Website
                </a>
              ) : (
                <a href={`https://www.google.com/search?q=${encodeURIComponent(restaurant.name + " " + restaurant.address + " reservation")}`} target="_blank" rel="noopener noreferrer"
                  className="flex flex-col items-center justify-center gap-2 py-5 bg-white rounded-3xl shadow-sm border border-slate-200 text-slate-600 font-bold text-sm active:scale-95 transition-all">
                  <Search size={22} className="mb-1" /> Find Booking
                </a>
              )}

              <button type="button" onClick={() => setShowRemoveConfirm(true)}
                className="flex flex-col items-center justify-center gap-2 py-5 bg-rose-50 rounded-3xl border border-rose-100 text-rose-500 font-bold text-sm active:scale-95 transition-all">
                <Trash2 size={22} className="mb-1" /> Remove
              </button>
            </div>

          </div>
        </div>
      </div>

      {showMapMenu && (
        <div className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm flex items-end justify-center transition-all animate-in fade-in duration-200" onClick={() => setShowMapMenu(false)}>
          <div className="w-full max-w-sm bg-white rounded-t-3xl pb-safe-or-8 pt-3 px-5 shadow-2xl animate-in slide-in-from-bottom duration-300" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-1.5 rounded-full bg-slate-200 mx-auto mb-6" />
            <h3 className="text-center font-black text-slate-800 text-lg mb-6 tracking-tight">Open Directions In...</h3>

            <div className="flex flex-col gap-3 mb-6">
              <a href={`https://maps.apple.com/?daddr=${encodeURIComponent(restaurant.address)}`} target="_blank" rel="noopener noreferrer"
                className="w-full py-4 bg-white rounded-2xl font-bold text-center border-[3px] border-slate-100 text-slate-800 active:bg-slate-50 transition-all text-[15px]">Apple Maps</a>

              <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(restaurant.address)}`} target="_blank" rel="noopener noreferrer"
                className="w-full py-4 bg-white rounded-2xl font-bold text-center border-[3px] border-slate-100 text-slate-800 active:bg-slate-50 transition-all text-[15px]">Google Maps</a>

              <a href={`https://waze.com/ul?q=${encodeURIComponent(restaurant.address)}`} target="_blank" rel="noopener noreferrer"
                className="w-full py-4 rounded-2xl font-bold text-center border border-slate-900 text-white active:bg-slate-800 shadow-xl shadow-slate-900/20 transition-all text-[15px]" style={{ background: C.slate900 }}>Waze</a>
            </div>
            <button onClick={() => setShowMapMenu(false)} className="w-full py-4 bg-slate-50 text-slate-500 font-bold rounded-2xl active:bg-slate-100 transition-colors">Cancel</button>
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
                <X size={24} strokeWidth={2.5} />
              </button>
            </div>

            <div
              className="flex-1 w-full overflow-x-auto flex snap-x snap-mandatory scrollbar-none items-center"
              onClick={e => e.stopPropagation()}
              ref={(node) => {
                // Instantly snap to the specific photo that was tapped upon mounting!
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
        <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-center justify-center p-6 transition-all animate-in fade-in duration-200" onClick={() => setShowRemoveConfirm(false)}>
          <div className="w-full max-w-sm bg-white rounded-[2rem] p-8 shadow-2xl flex flex-col items-center text-center animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mb-5 border-4 border-white shadow-sm">
              <Trash2 size={28} />
            </div>
            <h3 className="font-black text-slate-800 text-xl mb-2">Are you sure?</h3>
            <p className="text-slate-500 text-[15px] font-medium mb-8 leading-relaxed">
              This will permanently remove <span className="text-slate-800 font-bold">{restaurant.name}</span> from your Cravelist.
            </p>

            <div className="flex w-full gap-3">
              <button onClick={() => setShowRemoveConfirm(false)} className="flex-1 py-4 bg-slate-50 text-slate-500 font-bold rounded-2xl active:bg-slate-100 transition-colors">No, Keep It</button>
              <button onClick={() => { setShowRemoveConfirm(false); onRemove(restaurant.id); }} className="flex-1 py-4 bg-rose-500 text-white font-bold rounded-2xl active:bg-rose-600 shadow-lg shadow-rose-200 transition-all">Yes, Remove</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
