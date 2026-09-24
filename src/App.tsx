import { useState, useEffect, useRef, Suspense, lazy } from "react";
import { QueryClient, focusManager, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { ScreenOrientation } from "@capacitor/screen-orientation";
import { App as CapacitorApp } from "@capacitor/app";
import type { Session } from "@supabase/supabase-js";

import { supabase } from "./lib/supabase";
import { fetchRestaurants } from "./lib/restaurants";
import { fetchMyGroups } from "./lib/groups";
import type { Restaurant, TabId } from "./types";

import { BottomTabBar } from "./components/BottomTabBar";
import { AnimatedSplash } from "./components/SplashScreen";
import { RestaurantCardSkeleton } from "./components/RestaurantCard";
import { ListTab } from "./screens/ListTab";
import type { SavedPlace } from "./components/SearchOverlay";

// Everything not on the first screen is code-split.
const SearchOverlay = lazy(() => import("./components/SearchOverlay").then((m) => ({ default: m.SearchOverlay })));
const RateSheet = lazy(() => import("./components/RateSheet").then((m) => ({ default: m.RateSheet })));
const RestaurantDetail = lazy(() => import("./components/RestaurantDetail").then((m) => ({ default: m.RestaurantDetail })));
const ProfileTab = lazy(() => import("./screens/ProfileTab").then((m) => ({ default: m.ProfileTab })));
const SpinTab = lazy(() => import("./screens/SpinTab").then((m) => ({ default: m.SpinTab })));
const PassportTab = lazy(() => import("./screens/PassportTab").then((m) => ({ default: m.PassportTab })));
const AuthScreen = lazy(() => import("./screens/AuthScreen").then((m) => ({ default: m.AuthScreen })));
const OnboardingScreen = lazy(() => import("./screens/OnboardingScreen").then((m) => ({ default: m.OnboardingScreen })));
const UpdatePasswordScreen = lazy(() => import("./screens/UpdatePasswordScreen").then((m) => ({ default: m.UpdatePasswordScreen })));

const ACTIVE_GROUP_KEY = "crave_active_group";

async function fetchSavedPlaces(): Promise<SavedPlace[]> {
  const { data, error } = await supabase
    .from("restaurants")
    .select("place_id, group_id, photo_url, vibes, notes, opening_hours");
  if (error) throw error;
  return data.map((r) => ({
    placeId: r.place_id,
    groupId: r.group_id,
    photoUrl: r.photo_url,
    vibes: Array.isArray(r.vibes) ? (r.vibes as string[]) : [],
    notes: r.notes,
    openingHours: Array.isArray(r.opening_hours) ? (r.opening_hours as string[]) : null,
  }));
}

function readStoredGroup() {
  try { return localStorage.getItem(ACTIVE_GROUP_KEY); } catch { return null; }
}

function AppShellSkeleton() {
  return (
    <div className="flex h-full flex-col gap-4 bg-background px-5 pt-safe" aria-busy="true" aria-label="Loading">
      <div className="flex items-center justify-between pt-2">
        <div className="h-11 w-44 animate-pulse rounded-full bg-subtle" />
        <div className="h-11 w-11 animate-pulse rounded-full bg-subtle" />
      </div>
      <div className="h-3 w-32 animate-pulse rounded bg-subtle" />
      <div className="h-24 w-64 animate-pulse rounded-xl bg-subtle" />
      <div className="h-[50px] animate-pulse rounded-2xl bg-subtle" />
      {[0, 1, 2].map((i) => <RestaurantCardSkeleton key={i} />)}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Signed-in app shell
// ═══════════════════════════════════════════════════════════════
function CraveApp({ uid }: { uid: string }) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabId>("list");
  const [visitedTabs, setVisitedTabs] = useState<Set<TabId>>(() => new Set(["list"]));
  const [addQuery, setAddQuery] = useState<string | null>(null); // non-null = "add a place" open
  const [detail, setDetail] = useState<Restaurant | null>(null);
  const [rating, setRating] = useState<Restaurant | null>(null);
  const [storedGroupId, setStoredGroupId] = useState<string | null>(readStoredGroup);

  const groupsQuery = useQuery({ queryKey: ["groups", uid], queryFn: fetchMyGroups });
  const groups = groupsQuery.data ?? [];
  // Fall back to the first list if the stored one was left or deleted.
  const group = groups.find((g) => g.id === storedGroupId) ?? groups[0];
  const groupId = group?.id;

  const selectGroup = (id: string) => {
    setStoredGroupId(id);
    try { localStorage.setItem(ACTIVE_GROUP_KEY, id); } catch { /* storage unavailable */ }
  };

  const changeTab = (tab: TabId) => {
    setActiveTab(tab);
    setVisitedTabs((prev) => (prev.has(tab) ? prev : new Set(prev).add(tab)));
  };

  // Live updates from other members. Restaurant changes are filtered to the list
  // being viewed; reviews/groups are already limited to co-members by RLS.
  // Bursts of events (e.g. a review plus the trigger updating `visited`) are
  // coalesced into one refetch.
  useEffect(() => {
    const pending = new Set<string>();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const invalidate = (...keys: string[]) => {
      keys.forEach((k) => pending.add(k));
      clearTimeout(timer);
      timer = setTimeout(() => {
        pending.forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }));
        pending.clear();
      }, 400);
    };

    const channel = supabase.channel(`crave-sync-${groupId ?? "none"}`)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "restaurants",
        ...(groupId ? { filter: `group_id=eq.${groupId}` } : {}),
      }, () => invalidate("restaurants", "groups"))
      .on("postgres_changes", { event: "*", schema: "public", table: "reviews" }, () => invalidate("restaurants", "groups"))
      .on("postgres_changes", { event: "*", schema: "public", table: "groups" }, () => invalidate("groups"))
      .on("postgres_changes", { event: "*", schema: "public", table: "group_members" }, () => invalidate("groups", "restaurants"))
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => invalidate("groups", "restaurants"))
      .subscribe();

    return () => {
      clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [queryClient, groupId]);

  // Warm the light code chunks once the list is on screen.
  useEffect(() => {
    if (!groupId) return;
    const warm = () => {
      import("./screens/ProfileTab");
      import("./screens/SpinTab");
      import("./screens/PassportTab");
      import("./components/SearchOverlay");
      import("./components/RestaurantDetail");
      import("./components/RateSheet");
    };
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };
    if (w.requestIdleCallback) {
      const id = w.requestIdleCallback(warm, { timeout: 2500 });
      return () => w.cancelIdleCallback?.(id);
    }
    const t = setTimeout(warm, 1200);
    return () => clearTimeout(t);
  }, [groupId]);

  // "Already saved" badges in add-a-place cover every list, not just this one.
  const savedPlaces = useQuery({
    queryKey: ["restaurants", "saved-places", uid],
    queryFn: fetchSavedPlaces,
    enabled: addQuery !== null,
  });

  // The open detail page reads its own row, so it reflects new ratings wherever
  // it was opened from.
  const detailQuery = useQuery({
    queryKey: ["restaurants", "detail", uid, detail?.groupId, detail?.id],
    queryFn: async () => {
      const { restaurants } = await fetchRestaurants({ uid, groupId: detail!.groupId, restaurantId: detail!.id });
      return restaurants[0] ?? null;
    },
    enabled: !!detail,
  });
  const liveDetail = detail ? (detailQuery.data?.id === detail.id ? detailQuery.data : detail) : null;

  type RestaurantPages = { pages: { restaurants: Restaurant[] }[] };
  const removeMutation = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from("restaurants").delete().eq("id", id);
      if (error) throw error;
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["restaurants"] });
      const previous = queryClient.getQueriesData<RestaurantPages>({ queryKey: ["restaurants"] });
      queryClient.setQueriesData<RestaurantPages>({ queryKey: ["restaurants"] }, (old) =>
        old?.pages
          ? { ...old, pages: old.pages.map((p) => ({ ...p, restaurants: p.restaurants.filter((r) => r.id !== id) })) }
          : old,
      );
      return { previous };
    },
    onError: (_err, _id, context) => {
      context?.previous.forEach(([key, data]) => queryClient.setQueryData(key, data));
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["restaurants"] });
      queryClient.invalidateQueries({ queryKey: ["groups"] });
    },
  });

  if (groupsQuery.isPending) return <AppShellSkeleton />;

  if (groupsQuery.isError && groups.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
        <h1 className="m-0 font-display text-3xl font-extrabold">Can't reach Crave</h1>
        <p className="m-0 text-muted">Check your connection and try again.</p>
        <button type="button" onClick={() => groupsQuery.refetch()}
          className="h-[54px] rounded-[18px] bg-ink px-6 font-semibold text-white">Try again</button>
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <Suspense fallback={<AppShellSkeleton />}>
        <OnboardingScreen onComplete={(id) => {
          if (id) selectGroup(id);
          queryClient.invalidateQueries({ queryKey: ["groups"] });
        }} />
      </Suspense>
    );
  }

  const tabPanel = (tab: TabId, node: React.ReactNode) =>
    visitedTabs.has(tab) && (
      <div className={`absolute inset-0 ${activeTab === tab ? "z-10" : "pointer-events-none invisible z-0"}`} aria-hidden={activeTab !== tab}>
        <Suspense fallback={<AppShellSkeleton />}>{node}</Suspense>
      </div>
    );

  return (
    <div className="relative h-full w-full overflow-hidden bg-background">
      {tabPanel("list", (
        <ListTab uid={uid} group={group} groups={groups} onSelectGroup={selectGroup}
          onAdd={(q) => setAddQuery(q ?? "")} onOpen={setDetail} />
      ))}
      {tabPanel("passport", <PassportTab uid={uid} group={group} onOpen={setDetail} />)}
      {tabPanel("spin", <SpinTab uid={uid} groupId={groupId} onOpen={setDetail} />)}
      {tabPanel("profile", (
        <ProfileTab uid={uid} groups={groups} activeGroupId={groupId} onSelectGroup={selectGroup} />
      ))}

      <BottomTabBar active={activeTab} onChange={changeTab} />

      {liveDetail && (
        <Suspense fallback={<div className="fixed inset-0 z-50 bg-background" />}>
          <RestaurantDetail
            restaurant={liveDetail}
            group={groups.find((g) => g.id === liveDetail.groupId)}
            myUid={uid}
            onRate={setRating}
            onRemove={(id) => { removeMutation.mutate(id); setDetail(null); }}
            onClose={() => setDetail(null)}
          />
        </Suspense>
      )}

      {addQuery !== null && (
        <Suspense fallback={<div className="fixed inset-0 z-50 bg-background" />}>
          <SearchOverlay
            activeGroupId={groupId ?? null}
            savedPlaces={savedPlaces.data ?? []}
            groups={groups}
            initialQuery={addQuery}
            onSave={() => setAddQuery(null)}
            onClose={() => setAddQuery(null)}
          />
        </Suspense>
      )}

      {rating && (
        <Suspense fallback={null}>
          <RateSheet restaurant={rating} onClose={() => setRating(null)} />
        </Suspense>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
const appQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes cache to prevent constant reloading
      gcTime: 1000 * 60 * 60 * 24, // 24 hours garbage collection
    },
  },
});

const persister = createSyncStoragePersister({
  storage: window.localStorage,
});

// Bump when cached data shapes change so a new build never renders an old cache.
const CACHE_VERSION = "2026-09-redesign";

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSplash, setShowSplash] = useState(true);
  const [isRecoveryMode, setIsRecoveryMode] = useState(() => window.location.hash.includes("type=recovery"));
  const hasBooted = useRef(false);

  useEffect(() => {
    // Lock orientation to vertical (portrait) for native mobile
    ScreenOrientation.lock({ orientation: "portrait" }).catch(() => { });

    const processHash = async (hash: string) => {
      if (hash.includes("access_token=") && hash.includes("type=recovery")) {
        const params = new URLSearchParams(hash.replace('#', '?'));
        const access_token = params.get("access_token");
        const refresh_token = params.get("refresh_token");
        if (access_token && refresh_token) {
          await supabase.auth.setSession({ access_token, refresh_token });
          setIsRecoveryMode(true);
          window.location.hash = "";
        }
      } else if (hash.includes("type=recovery")) {
        setIsRecoveryMode(true);
      }
    };

    // Check initial load
    if (window.location.hash) {
      processHash(window.location.hash);
    }

    const handleHashChange = () => processHash(window.location.hash);
    window.addEventListener("hashchange", handleHashChange);

    // iOS suspends the WebView in the background, so timers (including the token
    // refresh) stop. Refresh the session and refetch stale data on resume.
    const appStateListener = CapacitorApp.addListener("appStateChange", ({ isActive }) => {
      if (isActive) supabase.auth.startAutoRefresh();
      else supabase.auth.stopAutoRefresh();
      focusManager.setFocused(isActive);
    });

    // Handle native deep linking from emails
    const deepLinkListener = CapacitorApp.addListener('appUrlOpen', data => {
      if (data.url.includes("type=recovery")) {
        const urlObj = new URL(data.url);
        processHash(urlObj.hash);
      }
    });

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (s) hasBooted.current = true;
      setSession(s);
    }).catch((err) => {
      console.error("Failed to get session", err);
      setSession(null);
    }).finally(() => {
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsRecoveryMode(true);
      }

      // Update session immediately with zero artificial delay for instant responsiveness
      if (event === "SIGNED_IN") {
        hasBooted.current = true;
        setSession(s);
      } else {
        setSession(s);
      }
    });

    return () => {
      subscription.unsubscribe();
      window.removeEventListener("hashchange", handleHashChange);
      deepLinkListener.then(listener => listener.remove());
      appStateListener.then(listener => listener.remove());
    };
  }, []);

  return (
    <PersistQueryClientProvider client={appQueryClient} persistOptions={{ persister, buster: CACHE_VERSION, maxAge: 1000 * 60 * 60 * 24 }}>
      {showSplash && <AnimatedSplash onComplete={() => setShowSplash(false)} />}

      {!loading && (
        <div className={`h-full w-full transition-opacity duration-300 ${showSplash ? "pointer-events-none opacity-0" : "opacity-100"}`}>
          <Suspense fallback={<AppShellSkeleton />}>
            {isRecoveryMode ? (
              <UpdatePasswordScreen onComplete={() => {
                setIsRecoveryMode(false);
                window.location.hash = ""; // Clear hash after success
              }} />
            ) : session ? (
              <CraveApp key={session.user.id} uid={session.user.id} />
            ) : (
              <AuthScreen />
            )}
          </Suspense>
        </div>
      )}
    </PersistQueryClientProvider>
  );
}
