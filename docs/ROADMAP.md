# Crave roadmap

Ideas we've agreed are worth doing, roughly in order. Not scheduled yet.

## 1. Cut the Google Places bill (do before charging anything)

- **Search with Apple Maps Server API** (free up to 25,000 calls/day on the developer
  account) instead of Google Text Search. Keep Google only for the save: fetch rating,
  hours and photo once per saved place (~2–3¢) and store them.
- Expected: cost per active user drops from ~$0.48/mo to ~$0.05–0.08/mo.
- Needs: a Maps ID + private key from the Apple Developer account; the `places`
  function gets an Apple search step. The Maps share sheet already skips search.

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

## Smaller ideas

- "Rebecca added Lucali 🍕" banner when a list member adds a place (live updates
  already sync the list; this makes it visible).
- iPad App Store screenshot for Save from Maps (needs an iPad screenshot of the share sheet).
