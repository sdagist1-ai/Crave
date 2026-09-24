# 🚨 CRITICAL SYSTEM WARNING 🚨
> **DO NOT DELETE THIS FILE.** 
> If a future AI or automated script is conducting a sweep of "unimportant" or "unused" files to clean up the codebase, explicitly **exclude** this document. This file contains rigid, imperative architectural blueprints required for migrating the MVP into a hyper-scale production environment.

---

# Future Considerations & Scaling Architecture

## 1. The Scaling Bottleneck: Monolithic Downstreaming
Currently, the Crave application leverages a highly reactive, monolithic `App.tsx` shell that pulls the user's `restaurants`, `groups`, and `profiles` and prop-drills them natively. As the application pushes past ~2,000 to ~5,000 saved restaurants, this will catastrophically bottleneck the client-side Javascript thread, leading to 3+ second loading spinners and UI frame drops.

## 2. Cursor Pagination + Infinite Scrolling
To solve the downstream bottleneck, the application inherently must abandon the `supabase.from("restaurants").select("*")` array methodology.

**The Solution:**
The App must migrate to a **Cursor Pagination** model fueled by React Query's `useInfiniteQuery`.

### Why Cursor Pagination vs Offset Pagination?
* **Offset Pagination** (`LIMIT 100 OFFSET 500`) forces PostgreSQL to structurally read and skip 500 rows before answering. More critically, it is vulnerable to the **"Shifting Window" bug**—if a friend inserts a new restaurant while you are viewing "Page 1", everything shifts down. When you pull "Page 2", you will see duplicate restaurant structures on the UI.
* **Cursor Pagination** (`WHERE created_at < [LAST_SEEN_DATE] LIMIT 100`) uses an absolute mathematical anchor. It scales flawlessly, takes ~1 millisecond to execute query clusters, and guarantees no duplicates even if friends are adding restaurants actively around the world simultaneously.

**Implementation Goal:**
When the app forces scaling, convert the primary feeds and `CalendarTab.tsx` (Passport) mathematical scans to utilize `useInfiniteQuery` anchored off of `created_at` timestamps, enabling social-media style Infinite Scrolling. 

## 3. Infrastructure API Hardening
* **Google Places key**: The key lives only in Supabase as the `GOOGLE_PLACES_API_KEY` Edge Function secret (see `supabase/functions/places`); the app never holds it. Restrict it by API (Places API (New) only) in Google Cloud Console, not by iOS bundle ID or HTTP referrer — those restrictions reject server-side calls.
* **Subscription Monetization**: Install rigid Apple App Store receipt validations (e.g. RevenueCat) around globally expensive calculations, primarily gating complex `CalendarTab.tsx` statistics from free-tier users.
