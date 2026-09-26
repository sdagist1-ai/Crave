# Crave roadmap

Ideas we've agreed are worth doing, roughly in order. Not scheduled yet.

## 1. Cut the Google Places bill (do before charging anything)

- **Search with Apple Maps Server API** (free up to 25,000 calls/day on the developer
  account) instead of Google Text Search. Keep Google only for the save: fetch rating,
  hours and photo once per saved place (~2–3¢) and store them.
- Expected: cost per active user drops from ~$0.48/mo to ~$0.05–0.08/mo.
- Needs: a Maps ID + private key from the Apple Developer account; the `places`
  function gets an Apple search step. The Maps share sheet already skips search.
- Cuisines and occasions keep working: they're worked out in the database from a list of
  type words plus the name, and the one Google Details call at save time already returns
  Google's `types`. Apple's categories are coarser (Restaurant, Cafe, Bakery, Nightlife…,
  no cuisines), so map them to the same words for anything saved without Google
  (Cafe → `cafe`, Bakery → `bakery`, Nightlife/Brewery/Winery → `bar`).

Current estimate (Google Places + Supabase Pro $25/mo), before this change:

| Monthly active users | Monthly cost | Paying users needed at $10.99/yr |
|---|---|---|
| 500 | ≈ $95 | ~24% |
| 5,000 | ≈ $2,425 | ~60% |

($10.99/yr ≈ $9.34 after Apple's 15% ≈ $0.78/mo per payer. Typical freemium
conversion is 2–5%.)

## 2. Save from TikTok and Instagram

- Share a video to Crave → read its caption (TikTok's public oEmbed), use AI to pull out
  the restaurant name and city, search near there, then show the existing
  "Which one did you mean?" chooser.
- Works when the caption names the place; otherwise falls back to "Open Crave to search".
- Check first what a TikTok **place page** shares — it may be a proper place link.
- Until then, non-map links should go straight to "Open in Crave to search".

## 3. Crave Plus (paid)

- **One subscription covers the whole list**: when one member subscribes, everyone on
  that list gets Plus.
- **$2.99/month or $19.99/year**, a **lifetime option (~$49.99)**, and keep the tip jar.
- Use RevenueCat for in-app purchases (free until $2.5k/month in revenue).
- Launch alongside #2 so the first paid feature is an exciting one. Keep the core free:
  lists, ratings, Spin, Passport, Save from Maps.

Plus features (things that excite people *and* cost money to run):

1. Save from TikTok / Instagram (#2).
2. **"You're near a saved spot" alerts**, e.g. "You're 2 blocks from Lucali. It's been
   on your list for 3 months."
3. **Crave Wrapped**: a yearly recap (places tried, top cuisine, most-spun spot).
   Shareable, so it doubles as marketing.
4. **Smarter Spin**: open now, distance, price, date night, "try somewhere new".
5. **Unlimited photos**, with a sensible cap on the free plan.
6. Extras: custom app icons, Passport stamp themes, export/backup.

## 4. Make it feel like Crave: save → spin → go → reveal → remember

The data shows the real problem: most saved places never get tried (57 saved, 13 tried
in the beta). These features turn saving into going, and going into shared memory.
None of them call Google, so they cost nothing to run.

1. **Sealed scores + the reveal.** You can't see anyone's score for a place until
   you've given yours; then Crave flips them together ("You 9 · Rebecca 6 — the great
   Lucali debate"). Enforce it on the server (an RLS policy on `reviews`: others' rows are
   readable only if you've reviewed that place), not just in the UI.
   - **Taste match** from paired scores: "You and Rebecca agree 74% of the time"
     (within 1 point), biggest debate, shared MUSTs.
   - Nudge: "Rebecca rated Lucali. Rate it to see her score."
2. **Spin → plan.** "Lock it in" turns a spin into "Up next: Lucali · Friday" on
   everyone's phone; a reminder on the day, then "How was Lucali?" opens the sealed
   rating. One **veto** per person per spin. Needs a `plans` table.
3. **Visits, not a yes/no switch.** A `visits` table (place, date, who went, photos)
   instead of the `visited` boolean. Unlocks "One year ago tonight: Ler Lers",
   "Your spot" (visited 5×), dated Passport stamps, and the data for Crave Wrapped.
   A completed plan creates a visit.

Smaller touches in the same spirit: list ageing ("Saved 94 days ago", a "Longest
waiting" shelf Spin can favour); a home-screen widget ("Up next: Lucali · Fri") that reuses
the App Group from the share sheet; show "Why this spot?" as a quote from whoever saved it.

Avoid: public profiles, feeds, follower counts (breaks "private by design") and
generic AI recommendations.

## Security (next)

1. **Cap the Google Places bill.** Any signed-in account can call the `places` function as
   often as it likes, so a scripted abuser could run up Places charges.
   - Done: per-minute quota caps (30) on SearchText, GetPlace and GetPhotoMedia, and a
     $25/month budget alert.
   - Still to do: a per-user daily limit in the `places` function.
2. **Review photos are public links** (random names, but anyone with a link can open
   them). Switch to signed URLs if that becomes a concern.
3. **Sign live-update bundles (next App Store build, i.e. build 11; build 10 shipped
   without it).** Capgo encryption/signing: private key on the Mac, public key in
   `capacitor.config.ts`; phones reject unsigned bundles even if Supabase is compromised.
   This is what makes a leaked publishing key unable to push code to phones. Update
   `scripts/deploy-ota.mjs` (and the GitHub workflow's secrets) to sign. See
   docs/LIVE_UPDATES.md → Security.
4. ~~**Dedicated publishing key**~~ Done: secret key "ota_publish" (Supabase → API keys),
   in `.env.local` and as a GitHub Actions secret for the auto-publish workflow (accepted
   risk; see docs/LIVE_UPDATES.md → Security). Revoke it there if either copy is ever
   exposed.
5. **Narrow the publishing credential.** The secret key can read and write the whole
   database; publishing only needs to upload a zip and insert an `app_updates` row. Move
   that into an Edge Function that takes a dedicated publish token, and give GitHub only
   that token, so the GitHub secret can't touch user data.
6. **Lock the Google Places key** to Places API (New) only (Google Cloud → Credentials).

The advisor's "SECURITY DEFINER function executable" warnings (create_group,
delete_user_account, guess_place_cuisine, join_group, reset_share_code) are intended:
each checks the caller.

## Security follow-ups (once most people are on 1.4)

- **Stop the app uploading to `place_photos`.** Only the `places` function should write
  there, but app versions before 1.4 upload restaurant photos themselves (119 of them
  so far). Once they're rare, drop `place_photos` from the "Signed-in users can upload
  images" storage policy.
- **Replace the old Google API key.** Versions before 1.4 have a Google key built into the
  app. Create a new key for the `places` function (`GOOGLE_PLACES_API_KEY` secret),
  then delete the old one in Google Cloud.
- **Leaked-password check** (Supabase → Authentication → Password security) needs the Pro plan.

## Growth

- **Starter lists + Restaurant Week campaign** (build in December, ready for NYC's winter
  Restaurant Week, usually late January–February; confirm dates when announced).
  - **Starter lists:** a curated list anyone can copy into their Cravelist from a link
    (`cravelist.us/list/…`, reusing the invite-link setup). Reusable for any campaign:
    "Restaurant Week picks", "Best pizza in Brooklyn", a creator's favourites.
  - **Spin only Restaurant Week spots**, and a special Passport stamp for places tried
    during the week.
  - **Content:** "We let Crave pick our Restaurant Week dinners", "5 spots in 5 nights",
    posted 2–3 weeks before it starts, when people plan and book.
  - "NYC Restaurant Week" is a trademark of NYC Tourism + Conventions: say "Restaurant Week
    picks", no logo, no implied affiliation (or ask them about a partnership).
- **Ask for an App Store rating at a happy moment** (after rating a place 9+).

## Performance, when lists get long

Done 2026-09-26 (live update 1.4.6): refetch on resume only when stale, persisted cache
limited to what the first screen shows, memoised cards, Google re-sync by age, set-based
review policy, one-pass group scores. `get_group_feed` also gained a `p_slim` option
(rows without review notes/photos, hours and links) that the app does **not** use yet:
a slim row reaching the detail page or the rating sheet needs care first (the rating
sheet seeds its notes and photos from the row). Next, once lists reach a few hundred
places:

- **Slim rows for Spin and Passport only**, with the detail page always fetching the full
  row before rating is enabled.

- **Cursor pagination** for `get_group_feed` (keyset on `created_at, id` instead of
  OFFSET), so deep pages stay fast and a place added mid-scroll doesn't shift the pages.
- **Virtualise the list** (only render cards near the viewport) and **cluster map
  markers** (PassportMap renders one DOM marker per place today).
- **Narrow realtime**: reviews/profiles/members events invalidate everything; scope them
  to the open list once there are many lists per user.

## Smaller ideas

- **Cafés, bakeries and bars under "Needs a cuisine".** Leave places whose occasions are
  Coffee, Sweets or Drinks out of that group, since they don't really need a cuisine.
- **New "Save from Maps" screenshot for the site** (`site/img/6-share.webp` still shows
  the old vibe picker).

- "Rebecca added Lucali 🍕" banner when a list member adds a place (live updates
  already sync the list; this makes it visible).
- iPad App Store screenshot for Save from Maps (needs an iPad screenshot of the share sheet).
