import { useState, useEffect, useRef, useMemo, Suspense, lazy } from "react";
import { QueryClient, focusManager, useMutation, useQuery, useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { Search, User, ChevronDown } from "lucide-react";
import { supabase } from "./lib/supabase";
import { fetchRestaurants } from "./lib/restaurants";
import { ScreenOrientation } from "@capacitor/screen-orientation";
import { App as CapacitorApp } from "@capacitor/app";
import { Session } from "@supabase/supabase-js";

// Types & Theme
import { Restaurant, TabId, Group, SortOption } from "./types";
import { C } from "./constants/theme";

// Components
import { BottomTabBar } from "./components/BottomTabBar";
import { AnimatedSplash } from "./components/SplashScreen";
import { RestaurantCardSkeleton } from "./components/RestaurantCard";

// Code-split heavy modals and overlays
const SearchOverlay = lazy(() => import("./components/SearchOverlay").then(m => ({ default: m.SearchOverlay })));
import type { SavedPlace } from "./components/SearchOverlay";
const RateSheet = lazy(() => import("./components/RateSheet").then(m => ({ default: m.RateSheet })));
const RestaurantDetailSheet = lazy(() => import("./components/RestaurantDetailSheet").then(m => ({ default: m.RestaurantDetailSheet })));

// Primary screen loaded statically
import { ListTab } from "./screens/ListTab";

// Secondary screens code-split to remove Mapbox and heavy bundles from the initial load
const ProfileTab = lazy(() => import("./screens/ProfileTab").then(m => ({ default: m.ProfileTab })));
const CalendarTab = lazy(() => import("./screens/CalendarTab").then(m => ({ default: m.CalendarTab })));
const SpinTab = lazy(() => import("./screens/SpinTab").then(m => ({ default: m.SpinTab })));
const PassportTab = lazy(() => import("./screens/PassportTab").then(m => ({ default: m.PassportTab })));
const AuthScreen = lazy(() => import("./screens/AuthScreen").then(m => ({ default: m.AuthScreen })));
const OnboardingScreen = lazy(() => import("./screens/OnboardingScreen").then(m => ({ default: m.OnboardingScreen })));
const UpdatePasswordScreen = lazy(() => import("./screens/UpdatePasswordScreen").then(m => ({ default: m.UpdatePasswordScreen })));
// ─── Supabase helpers ────────────────────────────────────────
async function fetchGroups(): Promise<Group[]> {
  const { data, error } = await supabase
    .from("groups")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data || [];
}

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

// ═══════════════════════════════════════════════════════════════
// Brand & Avatar Visual Generators
// ═══════════════════════════════════════════════════════════════
const getGroupColor = (str: string) => {
  const colors = [C.rose, C.amber, C.emerald, "#06b6d4", "#8B5CF6", "#F43F5E", "#EAB308"];
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
};

const getGroupInitials = (name: string) => {
  const parts = name.split(" ").filter(p => p.length > 0);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return "✨";
};

function AppShellSkeleton() {
  return (
    <div className="h-screen w-full flex flex-col bg-background text-foreground animate-pulse">
      {/* Header Skeleton */}
      <header className="px-4 pt-safe-or-4 pb-4 flex items-center justify-between gap-3 border-b border-border/50">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-full bg-secondary/80" />
          <div className="h-5 w-24 bg-secondary/80 rounded-md" />
        </div>
        <div className="w-9 h-9 rounded-full bg-secondary/80" />
      </header>

      {/* Tabs & Filter Pill Skeletons */}
      <div className="px-4 pt-4 pb-2 space-y-3">
        <div className="flex justify-center">
          <div className="h-10 w-48 bg-secondary/70 rounded-full" />
        </div>
        <div className="flex gap-2 overflow-hidden">
          <div className="h-8 w-24 bg-secondary/60 rounded-full shrink-0" />
          <div className="h-8 w-24 bg-secondary/60 rounded-full shrink-0" />
          <div className="h-8 w-24 bg-secondary/60 rounded-full shrink-0" />
        </div>
      </div>

      {/* Restaurant Card Skeletons */}
      <div className="flex-1 px-4 py-2 space-y-4 overflow-hidden">
        {[1, 2, 3, 4].map((i) => (
          <RestaurantCardSkeleton key={i} />
        ))}
      </div>

      {/* Bottom Bar Skeleton */}
      <div className="h-20 border-t border-border/50 flex items-center justify-around px-6 bg-background/80">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex flex-col items-center gap-1.5">
            <div className="w-6 h-6 rounded-full bg-secondary/80" />
            <div className="w-8 h-2 rounded bg-secondary/60" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Main App Shell
// ═══════════════════════════════════════════════════════════════
function CraveApp({ sessionUid }: { sessionUid: string }) {
  const [activeTab, setActiveTab] = useState<TabId>("list");
  const [showSearch, setShowSearch] = useState(false);
  const [ratingRestaurant, setRatingRestaurant] = useState<Restaurant | null>(null);
  const [detailRestaurant, setDetailRestaurant] = useState<Restaurant | null>(null);
  const [showWorkspaceDropdown, setShowWorkspaceDropdown] = useState(false);
  const queryClient = useQueryClient();

  // Filter States (Hoisted from ListTab)
  const [filterTab, setFilterTab] = useState<"cravelist" | "tried">("cravelist");
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [filterVibes, setFilterVibes] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<SortOption>("newest");

  // 1. Fetch Workspaces
  const groupsQuery = useQuery({
    queryKey: ["groups"],
    queryFn: fetchGroups,
  });

  const [activeGroupId, setActiveGroupId] = useState<string | null>(() => localStorage.getItem("crave_active_group") || null);

  const derivedGroupId = activeGroupId || (groupsQuery.data && groupsQuery.data.length > 0 ? groupsQuery.data[0].id : null);

  useEffect(() => {
    if (derivedGroupId) localStorage.setItem("crave_active_group", derivedGroupId);
  }, [derivedGroupId]);

  // Live updates from other members. Restaurant changes are filtered to the list
  // being viewed; reviews/groups are already limited to co-members by RLS.
  // Bursts of events (e.g. a review plus the trigger updating `visited`) are
  // coalesced into one refetch.
  useEffect(() => {
    const pending = new Set<string>();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const invalidate = (key: "restaurants" | "groups") => {
      pending.add(key);
      clearTimeout(timer);
      timer = setTimeout(() => {
        pending.forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }));
        pending.clear();
      }, 400);
    };

    const channel = supabase.channel(`crave-sync-${derivedGroupId ?? "none"}`)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "restaurants",
        ...(derivedGroupId ? { filter: `group_id=eq.${derivedGroupId}` } : {}),
      }, () => invalidate("restaurants"))
      .on("postgres_changes", { event: "*", schema: "public", table: "reviews" }, () => invalidate("restaurants"))
      .on("postgres_changes", { event: "*", schema: "public", table: "groups" }, () => invalidate("groups"))
      .on("postgres_changes", { event: "*", schema: "public", table: "group_members" }, () => invalidate("groups"))
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => invalidate("groups"))
      .subscribe();

    return () => {
      clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [queryClient, derivedGroupId]);

  // 2. Fetch Restaurants dynamically scoped to the Workspace
  const restaurantsQuery = useInfiniteQuery({
    queryKey: ["restaurants", sessionUid, derivedGroupId, filterTab, filterCategory, filterVibes, sortBy],
    queryFn: ({ pageParam }) => fetchRestaurants({
      uid: sessionUid, 
      groupId: derivedGroupId!,
      pageParam: pageParam as string | null,
      filterTab, filterCategory, filterVibes, sortBy
    }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: !!derivedGroupId && !!sessionUid
  });

  // Defer heavy background syncs until the main UI has successfully loaded its primary data
  // This prevents connection pooling bottlenecks and massive network waterfalls on app launch!
  const isMainUIReady = restaurantsQuery.isSuccess;

  // Track visited tabs so off-screen tabs and heavy modules (like Mapbox) only load on demand
  const [visitedTabs, setVisitedTabs] = useState<Set<TabId>>(() => new Set([activeTab]));

  const handleTabChange = (tab: TabId) => {
    setActiveTab(tab);
    setVisitedTabs((prev) => {
      if (prev.has(tab)) return prev;
      const next = new Set(prev);
      next.add(tab);
      return next;
    });
  };

  // 3. Every place saved across the user's lists (RLS limits rows to their groups).
  // Lightweight columns only; powers "already saved" badges and cloning in search.
  const savedPlacesQuery = useQuery({
    queryKey: ["restaurants", "saved-places", sessionUid],
    queryFn: fetchSavedPlaces,
    enabled: !!sessionUid && showSearch,
  });

  // 4. Workspace ALL query (for Passport & Calendar) - only active when user visits Passport or Calendar!
  const shouldFetchWorkspaceAll = visitedTabs.has("passport") || visitedTabs.has("calendar");
  const workspaceAllRestaurantsQuery = useInfiniteQuery({
    queryKey: ["restaurants", "workspace-all", sessionUid, derivedGroupId],
    queryFn: ({ pageParam }) => fetchRestaurants({
      uid: sessionUid,
      groupId: derivedGroupId!,
      pageParam: pageParam as string | null,
      all: true,
    }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: !!derivedGroupId && !!sessionUid && isMainUIReady && shouldFetchWorkspaceAll,
  });

  // ⚡️ IDLE PREFETCHING: Pre-warm code chunks & cache silently during idle time once the list is ready!
  useEffect(() => {
    if (!isMainUIReady || !derivedGroupId) return;

    // Warm only the light code chunks. PassportTab (1.8 MB of Mapbox) and its
    // 1000-row query load when the tab is first opened, not right after launch.
    const warmBackgroundTabs = () => {
      import("./screens/ProfileTab");
      import("./screens/SpinTab");
      import("./screens/CalendarTab");
      import("./components/SearchOverlay");
      import("./components/RestaurantDetailSheet");
    };

    // Use requestIdleCallback if available, fallback to 1200ms timeout for Safari
    const win = window as Window & { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };
    if (typeof win.requestIdleCallback === "function") {
      const handle = win.requestIdleCallback(warmBackgroundTabs, { timeout: 2500 });
      return () => win.cancelIdleCallback?.(handle);
    } else {
      const timer = setTimeout(warmBackgroundTabs, 1200);
      return () => clearTimeout(timer);
    }
  }, [isMainUIReady, derivedGroupId]);

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
          : old
      );
      return { previous };
    },
    onError: (_err, _id, context) => {
      context?.previous.forEach(([key, data]) => queryClient.setQueryData(key, data));
    },
    onSettled: () => { queryClient.invalidateQueries({ queryKey: ["restaurants"] }); },
  });

  const activeGroup = groupsQuery.data?.find(g => g.id === derivedGroupId);

  const allRestaurants: Restaurant[] = useMemo(() => restaurantsQuery.data?.pages.flatMap(p => p.restaurants) || [], [restaurantsQuery.data]);
  const workspaceAllRestaurants: Restaurant[] = useMemo(() => workspaceAllRestaurantsQuery.data?.pages.flatMap(p => p.restaurants) || [], [workspaceAllRestaurantsQuery.data]);

  // The open detail sheet reads its own row from the database, so it reflects new
  // ratings/photos wherever it was opened from (list, spin, passport, calendar).
  const detailQuery = useQuery({
    queryKey: ["restaurants", "detail", sessionUid, detailRestaurant?.groupId, detailRestaurant?.id],
    queryFn: async () => {
      const { restaurants } = await fetchRestaurants({
        uid: sessionUid, groupId: detailRestaurant!.groupId, restaurantId: detailRestaurant!.id,
      });
      return restaurants[0] ?? null;
    },
    enabled: !!detailRestaurant,
  });
  const syncedDetailRestaurant = detailRestaurant
    ? (detailQuery.data?.id === detailRestaurant.id ? detailQuery.data : detailRestaurant)
    : null;

  // Wait for background validation before blindly rendering empty states from old caches
  // We only hold for group data to prevent crashing. Restaurant loading is handled gracefully by the tabs.
  const isHoldingForData = 
    groupsQuery.isLoading || 
    (groupsQuery.isFetching && groupsQuery.data?.length === 0);

  if (isHoldingForData) {
    return <AppShellSkeleton />;
  }

  // 🚀 New User Onboarding Interceptor
  // If the user has strictly zero groups, violently intercept the app shell to force list creation!
  if (groupsQuery.isSuccess && groupsQuery.data.length === 0) {
    return (
      <Suspense fallback={<AppShellSkeleton />}>
        <OnboardingScreen onComplete={() => queryClient.invalidateQueries({ queryKey: ["groups"] })} />
      </Suspense>
    );
  }

  return (
    <div className="h-screen w-full flex flex-col relative bg-background text-foreground animate-in fade-in zoom-in-[0.99] duration-700 ease-out">
      <style>{`
        *::-webkit-scrollbar { display: none; }
      `}</style>

      {/* Tab content */}
      <div className={`absolute inset-0 flex flex-col overflow-hidden transition-opacity duration-300 ${activeTab === "list" ? "z-10 opacity-100 pointer-events-auto" : "z-0 opacity-0 pointer-events-none"}`}>
        <ListTab 
          restaurants={allRestaurants} 
          onDetail={setDetailRestaurant}
          onOpenSearch={() => setShowSearch(true)}
          fetchNextPage={() => restaurantsQuery.fetchNextPage()}
          hasNextPage={!!restaurantsQuery.hasNextPage}
          isFetchingNextPage={restaurantsQuery.isFetchingNextPage}
          isLoading={restaurantsQuery.isLoading}
          filterTab={filterTab}
          setFilterTab={setFilterTab}
          filterCategory={filterCategory}
          setFilterCategory={setFilterCategory}
          filterVibes={filterVibes}
          setFilterVibes={setFilterVibes}
          sortBy={sortBy}
          setSortBy={setSortBy}
          activeGroup={activeGroup}
          groups={groupsQuery.data || []}
          setActiveGroupId={setActiveGroupId}
          showWorkspaceDropdown={showWorkspaceDropdown}
          setShowWorkspaceDropdown={setShowWorkspaceDropdown}
        />
      </div>

      {visitedTabs.has("profile") && (
        <div className={`absolute inset-0 flex flex-col overflow-hidden transition-opacity duration-300 ${activeTab === "profile" ? "z-10 opacity-100 pointer-events-auto" : "z-0 opacity-0 pointer-events-none"}`}>
          <Suspense fallback={<AppShellSkeleton />}>
            <ProfileTab />
          </Suspense>
        </div>
      )}

      {visitedTabs.has("calendar") && (
        <div className={`absolute inset-0 flex flex-col overflow-hidden transition-opacity duration-300 ${activeTab === "calendar" ? "z-10 opacity-100 pointer-events-auto" : "z-0 opacity-0 pointer-events-none"}`}>
          <Suspense fallback={<AppShellSkeleton />}>
            <CalendarTab 
              restaurants={workspaceAllRestaurants} 
              onDetail={setDetailRestaurant} 
              groups={groupsQuery.data || []}
              fetchNextPage={() => workspaceAllRestaurantsQuery.fetchNextPage()}
              hasNextPage={!!workspaceAllRestaurantsQuery.hasNextPage}
              isFetchingNextPage={workspaceAllRestaurantsQuery.isFetchingNextPage}
            />
          </Suspense>
        </div>
      )}

      {visitedTabs.has("passport") && (
        <div className={`absolute inset-0 flex flex-col overflow-hidden transition-opacity duration-300 ${activeTab === "passport" ? "z-10 opacity-100 pointer-events-auto" : "z-0 opacity-0 pointer-events-none"}`}>
          <Suspense fallback={<AppShellSkeleton />}>
            <PassportTab 
              restaurants={workspaceAllRestaurants} 
              onQuickStamp={() => setShowSearch(true)}
            />
          </Suspense>
        </div>
      )}

      {visitedTabs.has("spin") && (
        <div className={`absolute inset-0 flex flex-col overflow-hidden transition-opacity duration-300 ${activeTab === "spin" ? "z-10 opacity-100 pointer-events-auto" : "z-0 opacity-0 pointer-events-none"}`}>
          <Suspense fallback={<AppShellSkeleton />}>
            <SpinTab onDetail={setDetailRestaurant} groupId={derivedGroupId!} />
          </Suspense>
        </div>
      )}

      {/* Bottom tab bar */}
      <BottomTabBar active={activeTab} onChange={handleTabChange} />

      {/* Detail sheet */}
      {syncedDetailRestaurant && (
        <Suspense fallback={null}>
          <RestaurantDetailSheet
            restaurant={syncedDetailRestaurant}
            onRate={(r) => setRatingRestaurant(r)}
            onRemove={(id) => { removeMutation.mutate(id); setDetailRestaurant(null); }}
            onClose={() => setDetailRestaurant(null)}
            myUid={sessionUid}
          />
        </Suspense>
      )}

      {/* Search opens on top of the tabs so they stay mounted (no remount / map reload on close) */}
      {showSearch && (
        <Suspense fallback={<div className="fixed inset-0 z-50 bg-background" />}>
          <SearchOverlay activeGroupId={derivedGroupId} savedPlaces={savedPlacesQuery.data ?? []} groups={groupsQuery.data || []} onSave={() => setShowSearch(false)} onClose={() => setShowSearch(false)} />
        </Suspense>
      )}

      {/* Rate sheet */}
      {ratingRestaurant && (
        <Suspense fallback={null}>
          <RateSheet restaurant={ratingRestaurant} onClose={() => setRatingRestaurant(null)} />
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
    <PersistQueryClientProvider client={appQueryClient} persistOptions={{ persister }}>
      {showSplash && <AnimatedSplash onComplete={() => setShowSplash(false)} />}

      {!loading && (
        <div className={`h-full w-full origin-center 
          transition-all ease-out duration-300
          ${!showSplash ? "opacity-100 scale-100" : "opacity-0 scale-[0.98] pointer-events-none"} 
        `}>
          <Suspense fallback={<AppShellSkeleton />}>
            {isRecoveryMode ? (
              <UpdatePasswordScreen onComplete={() => {
                setIsRecoveryMode(false);
                window.location.hash = ""; // Clear hash after success
              }} />
            ) : session ? (
              <CraveApp sessionUid={session.user.id} />
            ) : (
              <AuthScreen />
            )}
          </Suspense>
        </div>
      )}
    </PersistQueryClientProvider>
  );
}
