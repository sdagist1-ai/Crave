import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Share } from "@capacitor/share";
import {
  CalendarDays, ChevronDown, ChevronLeft, Ellipsis, Globe, Navigation, Plus, Share2, Star, Trash2, UtensilsCrossed, X,
} from "lucide-react";
import type { Group, Restaurant } from "../types";
import { syncRestaurantData } from "../lib/places";
import { updatePlaceTags } from "../lib/cuisines";
import { formatPriceLevel, formatScore, mapsLinks, todaysHours } from "../utils/helpers";
import { Avatar, OccasionTag, PrimaryButton, Sheet, Tag } from "./ui";
import { CuisinePicker } from "./CuisinePicker";
import { displayName } from "../utils/people";

const SYNC_AFTER_DAYS = 30;

export function RestaurantDetail({ restaurant: r, group, myUid, onRate, onRemove, onClose }: {
  restaurant: Restaurant;
  group: Group | undefined;
  myUid: string;
  onRate: (r: Restaurant) => void;
  onRemove: (id: number) => void;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [showHours, setShowHours] = useState(false);
  const [sheet, setSheet] = useState<null | "directions" | "more" | "confirm-remove">(null);
  const [viewer, setViewer] = useState<number | null>(null);
  const [shareNote, setShareNote] = useState<string | null>(null);
  const [editingTags, setEditingTags] = useState(false);
  const [savingTags, setSavingTags] = useState(false);
  const [tagsError, setTagsError] = useState<string | null>(null);

  const saveTags = async (next: { cuisine: string | null; occasions: string[] }) => {
    setSavingTags(true);
    setTagsError(null);
    try {
      await updatePlaceTags(r.id, next);
      await queryClient.invalidateQueries({ queryKey: ["restaurants"] });
      setEditingTags(false);
    } catch (err) {
      console.error("Failed to update cuisine:", err);
      setTagsError("Couldn't save that. Check your connection and try again.");
    } finally {
      setSavingTags(false);
    }
  };

  // Refresh hours/photo/location from Google when missing or older than 30 days.
  useEffect(() => {
    const age = r.lastSyncedAt ? (Date.now() - new Date(r.lastSyncedAt).getTime()) / 86_400_000 : Infinity;
    if (!r.openingHours || !r.countryCode || age >= SYNC_AFTER_DAYS) {
      syncRestaurantData(r.placeId, r.id, !!r.photoUrl).then((ok) => {
        if (ok) queryClient.invalidateQueries({ queryKey: ["restaurants"] });
      });
    }
    // Only when a different restaurant is opened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [r.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !sheet && viewer == null) onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, sheet, viewer]);

  const members = group?.members ?? [];
  const scored = r.reviews.filter((rev) => rev.score != null);
  const scores = scored.map((rev) => rev.score!);
  const myReview = r.reviews.find((rev) => rev.user_id === myUid);
  const memberCount = Math.max(members.length, 1);
  const withNotes = r.reviews.filter((rev) => rev.notes?.trim());
  const photos = [...(r.photoUrl ? [r.photoUrl] : []), ...(r.allVisitPhotos ?? []).map((p) => p.url)];
  const hoursToday = todaysHours(r.openingHours);
  const price = formatPriceLevel(r.priceLevel);
  const maps = mapsLinks(r);

  const ratedLabel =
    memberCount === 1 ? (scored.length ? "Rated by you" : "Not rated yet")
    : `${scored.length} of ${memberCount} rated`;

  // Members first (in join order), then anyone else who reviewed (e.g. left the list).
  const people = [
    ...members.map((m) => ({ person: m, score: r.reviews.find((rev) => rev.user_id === m.id)?.score ?? null })),
    ...scored
      .filter((rev) => !members.some((m) => m.id === rev.user_id))
      .map((rev) => ({
        person: { id: rev.user_id, first_name: rev.authorName ?? null, last_name: null, avatar_url: rev.authorAvatar ?? null },
        score: rev.score,
      })),
  ];
  const rated = people.filter((p) => p.score != null);
  const waitingOn = people.filter((p) => p.score == null && p.person.id !== myUid).map((p) => displayName(p.person));

  const rangeLabel =
    scores.length > 1 && Math.min(...scores) === Math.max(...scores) ? `Everyone gave it a ${scores[0]}`
    : scores.length > 1 ? `Scores range ${Math.min(...scores)}–${Math.max(...scores)}`
    : scores.length === 1 ? (waitingOn.length ? `Waiting on ${waitingOn.join(", ")}` : memberCount > 1 ? "Waiting on the rest of the crew" : "Your score")
    : memberCount > 1 ? "Be the first to rate it" : "Rate it after your visit";

  const handleShare = async () => {
    const text = `${r.name} — ${r.address}`;
    const url = maps.google.replace("/dir/?api=1&destination=", "/search/?api=1&query=");
    try {
      await Share.share({ title: r.name, text, url, dialogTitle: `Share ${r.name}` });
    } catch {
      try {
        await navigator.clipboard.writeText(`${text}\n${url}`);
        setShareNote("Link copied");
        setTimeout(() => setShareNote(null), 2000);
      } catch { /* user cancelled or no clipboard */ }
    }
  };

  const primary = r.bookingUrl
    ? { label: r.bookingPlatform ? `Book on ${r.bookingPlatform}` : "Book a table", href: r.bookingUrl, Icon: CalendarDays }
    : r.websiteUrl
      ? { label: "Visit website", href: r.websiteUrl, Icon: Globe }
      : null;

  return (
    <div role="dialog" aria-modal="true" aria-label={r.name} className="fixed inset-0 z-50 overflow-y-auto bg-background animate-rise">
      {/* Hero */}
      <div className="relative h-[250px] shrink-0 bg-sun-soft md:h-[380px]">
        {r.photoUrl ? (
          <button type="button" onClick={() => setViewer(0)} className="block h-full w-full" aria-label="View photos">
            <img src={r.photoUrl} alt="" className="h-full w-full object-cover" />
          </button>
        ) : (
          <div className="flex h-full items-center justify-center">
            <UtensilsCrossed size={40} className="text-sun-ink/40" aria-hidden="true" />
          </div>
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-background/0 to-background" />
        <div className="absolute inset-x-5 top-0 mx-auto flex max-w-2xl justify-between pt-safe">
          <button type="button" onClick={onClose} aria-label="Back"
            className="mt-2 flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-ink backdrop-blur-md">
            <ChevronLeft size={22} strokeWidth={2.2} />
          </button>
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={handleShare} aria-label="Share"
              className="flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-ink backdrop-blur-md">
              <Share2 size={18} />
            </button>
            <button type="button" onClick={() => setSheet("more")} aria-label="More options"
              className="flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-ink backdrop-blur-md">
              <Ellipsis size={20} />
            </button>
          </div>
        </div>
        {shareNote && (
          <div role="status" className="absolute top-24 left-1/2 -translate-x-1/2 rounded-full bg-ink px-3 py-1.5 text-xs font-semibold text-white animate-fade-in">
            {shareNote}
          </div>
        )}
      </div>

      <div className="relative mx-auto -mt-10 flex w-full max-w-2xl flex-col gap-3.5 px-5 pb-12">
        {/* Title block */}
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-1.5">
            <button type="button" onClick={() => setEditingTags(true)}
              aria-label={r.cuisine ? `Cuisine: ${r.cuisine}. Tap to change` : "Add a cuisine"}
              className={`inline-flex items-center gap-0.5 rounded-full border px-2 py-[2px] text-[11px] leading-none ${r.cuisine ? "border-border-strong bg-surface text-ink" : "border-dashed border-border-strong text-muted"}`}>
              {r.cuisine ?? <><Plus size={11} aria-hidden="true" /> Cuisine</>}
              {r.cuisine && <ChevronDown size={11} className="text-muted" aria-hidden="true" />}
            </button>
            {r.occasions.map((o) => (
              <button key={o} type="button" onClick={() => setEditingTags(true)} aria-label={`${o}. Tap to change`}><OccasionTag occasion={o} /></button>
            ))}
            {price && <Tag>{price}</Tag>}
            {hoursToday && (
              <button type="button" onClick={() => setShowHours(!showHours)} aria-expanded={showHours}
                className={`inline-flex items-center gap-1 rounded-full px-2 py-[3px] text-[11px] leading-none ${/closed/i.test(hoursToday) ? "bg-sun-soft text-sun-ink" : "bg-mint-soft text-mint-ink"}`}>
                Today · {hoursToday}
                <ChevronDown size={12} className={`transition-transform ${showHours ? "rotate-180" : ""}`} />
              </button>
            )}
          </div>
          <h1 className="m-0 font-display text-[34px] leading-none font-extrabold tracking-[-0.03em]">{r.name}</h1>
          <p className="m-0 text-sm text-muted">
            {[r.cuisineDetail !== r.cuisine ? r.cuisineDetail : null, r.address].filter(Boolean).join(" · ")}
          </p>
          {showHours && r.openingHours && (
            <ul className="m-0 flex list-none flex-col gap-1 rounded-2xl border border-border bg-surface p-3.5 text-[13px] animate-rise">
              {r.openingHours.map((line) => {
                const [day, ...rest] = line.split(": ");
                const today = new Date().toLocaleDateString("en-US", { weekday: "long" }) === day;
                return (
                  <li key={day} className={`flex justify-between ${today ? "font-semibold text-ink" : "text-muted"}`}>
                    <span>{day}</span><span>{rest.join(": ") || "Closed"}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Crave score */}
        <section aria-label="Crave score" className="flex flex-col gap-3 rounded-[22px] border border-border bg-surface p-3">
          <div className="flex items-stretch gap-3">
            <div className={`flex w-[104px] shrink-0 flex-col justify-between rounded-2xl p-3 ${r.avgScore != null ? "bg-accent text-white" : "bg-subtle text-ink"}`}>
              <span className="font-mono text-[10px] tracking-[0.12em]">CRAVE SCORE</span>
              <span className="mt-2 font-display text-[40px] leading-none font-extrabold tabular">
                {r.avgScore != null ? formatScore(r.avgScore) : "—"}
              </span>
            </div>
            <div className="flex min-w-0 flex-1 flex-col justify-center gap-2">
              <div className="text-[15px] font-semibold">{ratedLabel}</div>
              <div className="h-1.5 overflow-hidden rounded-full bg-subtle" role="progressbar"
                aria-valuemin={0} aria-valuemax={memberCount} aria-valuenow={scored.length} aria-label="Members who rated">
                <div className="h-1.5 rounded-full bg-accent transition-[width]" style={{ width: `${Math.min(100, (scored.length / memberCount) * 100)}%` }} />
              </div>
              <div className="text-xs text-muted">{rangeLabel}</div>
            </div>
          </div>
          {rated.length > 0 && (
            <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0" aria-label="Scores">
              {rated.map(({ person, score }) => (
                <li key={person.id} className="inline-flex items-center gap-1.5 rounded-full bg-subtle py-1 pr-2.5 pl-1">
                  <Avatar person={person} size={22} />
                  <span className="text-[13px] text-ink-2">{person.id === myUid ? "You" : displayName(person)}</span>
                  <span className="font-mono text-[13px] font-semibold tabular">{score}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Visit photos */}
        {(r.allVisitPhotos?.length ?? 0) > 0 && (
          <section className="flex flex-col gap-2.5">
            <h2 className="m-0 text-[17px] font-semibold">Photos</h2>
            <div className="-mx-5 flex gap-2 overflow-x-auto px-5">
              {r.allVisitPhotos!.map((p, i) => (
                <button key={p.url} type="button" onClick={() => setViewer(i + (r.photoUrl ? 1 : 0))}
                  className="h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-subtle" aria-label={`Photo by ${p.authorName ?? "a member"}`}>
                  <img src={p.url} alt="" className="h-full w-full object-cover" loading="lazy" />
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Reviews */}
        {withNotes.length > 0 && (
          <section className="flex flex-col gap-2.5">
            <h2 className="m-0 text-[17px] font-semibold">Reviews <span className="font-mono text-sm font-medium text-muted">{withNotes.length}</span></h2>
            {withNotes.map((rev) => (
              <article key={rev.id} className="flex gap-2.5 rounded-[18px] border border-border bg-surface px-3.5 py-3">
                <Avatar person={{ id: rev.user_id, first_name: rev.authorName ?? null, last_name: null, avatar_url: rev.authorAvatar ?? null }} size={28} />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <div className="flex justify-between text-[13px] font-semibold">
                    <span>{rev.user_id === myUid ? "You" : rev.authorName}</span>
                    {rev.score != null && <span className="font-mono text-accent-ink">{rev.score}/10</span>}
                  </div>
                  <p className="m-0 text-[13px] leading-snug text-ink-2">{rev.notes}</p>
                </div>
              </article>
            ))}
          </section>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          {primary ? (
            <a href={primary.href} target="_blank" rel="noopener noreferrer"
              className="flex h-[54px] flex-1 items-center justify-center gap-2 rounded-[18px] bg-ink text-[15px] font-semibold text-white active:scale-[0.98]">
              <primary.Icon size={18} /> {primary.label}
            </a>
          ) : (
            <PrimaryButton onClick={() => onRate(r)} className="flex-1">
              <Star size={18} /> {myReview?.score != null ? "Edit your rating" : "Rate your visit"}
            </PrimaryButton>
          )}
          <button type="button" onClick={() => setSheet("directions")} aria-label="Directions"
            className="flex h-[54px] w-[54px] shrink-0 items-center justify-center rounded-[18px] border border-border bg-surface">
            <Navigation size={20} />
          </button>
          {primary && (
            <button type="button" onClick={() => onRate(r)} aria-label={myReview?.score != null ? "Edit your rating" : "Rate your visit"}
              className={`flex h-[54px] w-[54px] shrink-0 items-center justify-center rounded-[18px] border ${myReview?.score != null ? "border-accent bg-accent-tint text-accent-ink" : "border-border bg-surface"}`}>
              <Star size={20} />
            </button>
          )}
        </div>

        {r.addedBy && (
          <p className="m-0 flex items-center justify-center gap-1.5 text-xs text-muted">
            <Avatar person={r.addedBy} size={18} />
            Added by {r.addedBy.id === myUid ? "you" : displayName(r.addedBy)} · {new Date(r.createdAt).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
          </p>
        )}
      </div>

      {sheet === "directions" && (
        <Sheet title="Directions" onClose={() => setSheet(null)}>
          <div className="flex flex-col gap-2 pb-2">
            {[["Apple Maps", maps.apple], ["Google Maps", maps.google], ["Waze", maps.waze]].map(([label, href]) => (
              <a key={label} href={href} target="_blank" rel="noopener noreferrer" onClick={() => setSheet(null)}
                className="flex h-[54px] items-center justify-center rounded-[18px] bg-subtle text-[15px] font-semibold text-ink">
                {label}
              </a>
            ))}
          </div>
        </Sheet>
      )}

      {editingTags && (
        <CuisinePicker
          value={r.cuisine}
          occasions={r.occasions}
          saving={savingTags}
          error={tagsError}
          onSave={saveTags}
          onClose={() => { setEditingTags(false); setTagsError(null); }}
        />
      )}

      {sheet === "more" && (
        <Sheet title={r.name} onClose={() => setSheet(null)}>
          <div className="flex flex-col gap-2 pb-2">
            {r.websiteUrl && (
              <a href={r.websiteUrl} target="_blank" rel="noopener noreferrer"
                className="flex h-[54px] items-center gap-3 rounded-[18px] bg-subtle px-4 text-[15px] font-semibold text-ink">
                <Globe size={18} /> Website
              </a>
            )}
            <button type="button" onClick={() => setSheet("confirm-remove")}
              className="flex h-[54px] items-center gap-3 rounded-[18px] bg-subtle px-4 text-left text-[15px] font-semibold text-danger">
              <Trash2 size={18} /> Remove from {group?.name ?? "this list"}
            </button>
          </div>
        </Sheet>
      )}

      {sheet === "confirm-remove" && (
        <Sheet title="Remove this place?" onClose={() => setSheet(null)}>
          <p className="m-0 mb-5 text-[15px] text-ink-2">
            <strong>{r.name}</strong> will be removed from {group?.name ?? "this list"} for everyone in it. Reviews stay with the people who wrote them.
          </p>
          <div className="flex gap-2 pb-2">
            <button type="button" onClick={() => setSheet(null)}
              className="h-[54px] flex-1 rounded-[18px] border border-border text-[15px] font-semibold">Keep it</button>
            <button type="button" onClick={() => { setSheet(null); onRemove(r.id); }}
              className="h-[54px] flex-1 rounded-[18px] bg-danger text-[15px] font-semibold text-white">Remove</button>
          </div>
        </Sheet>
      )}

      {viewer != null && photos.length > 0 && (
        <PhotoViewer photos={photos} start={viewer} onClose={() => setViewer(null)} />
      )}
    </div>
  );
}

function PhotoViewer({ photos, start, onClose }: { photos: string[]; start: number; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Rendered on <body>: inside the scrolled detail page, iOS WebKit positions a
  // fixed overlay against the scroll container and it ends up half off-screen.
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Photos" className="fixed inset-0 z-[80] flex h-dvh flex-col bg-black animate-fade-in">
      <div className="flex justify-end px-4 pt-safe">
        <button type="button" onClick={onClose} aria-label="Close photos"
          className="mt-2 flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white">
          <X size={22} />
        </button>
      </div>
      <div
        className="flex flex-1 snap-x snap-mandatory items-center overflow-x-auto"
        ref={(node) => {
          if (node && !node.dataset.positioned) {
            node.dataset.positioned = "1";
            node.scrollTo({ left: node.clientWidth * start });
          }
        }}
      >
        {photos.map((url) => (
          <div key={url} className="flex h-full min-w-full snap-center items-center justify-center p-2">
            <img src={url} alt="" className="max-h-[85vh] w-full object-contain" />
          </div>
        ))}
      </div>
      {photos.length > 1 && <p className="pb-safe text-center font-mono text-xs text-white/60">Swipe for more · {photos.length} photos</p>}
    </div>,
    document.body,
  );
}
