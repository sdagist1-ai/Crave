import { useState, useEffect, useRef } from "react";
import { QueryClient, QueryClientProvider, useMutation, useQuery, useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { Search, User, ChevronDown } from "lucide-react";
import { supabase } from "./lib/supabase";
import { ScreenOrientation } from "@capacitor/screen-orientation";
import { Session } from "@supabase/supabase-js";

// Types & Theme
import { Restaurant, TabId, Group, SortOption } from "./types";
import { C } from "./constants/theme";

// Components
import { SearchOverlay } from "./components/SearchOverlay";
import { RateSheet } from "./components/RateSheet";
import { RestaurantDetailSheet } from "./components/RestaurantDetailSheet";
import { BottomTabBar } from "./components/BottomTabBar";
import { AnimatedSplash } from "./components/SplashScreen";

// Screens
import { ListTab } from "./screens/ListTab";
import { ProfileTab } from "./screens/ProfileTab";
import { CalendarTab } from "./screens/CalendarTab";
import { SpinTab } from "./screens/SpinTab";
import { AuthScreen } from "./screens/AuthScreen";
import { OnboardingScreen } from "./screens/OnboardingScreen";
// ─── Supabase helpers ────────────────────────────────────────
async function fetchGroups(): Promise<Group[]> {
  const { data, error } = await supabase
    .from("groups")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data || [];
}

export type FetchRestaurantsOptions = {
  uid: string;
  groupId?: string;
  pageParam?: string | null;
  filterTab?: "cravelist" | "tried";
  filterCategory?: string | null;
  filterVibes?: string[];
  sortBy?: SortOption;
  restaurantId?: number;
};

export async function fetchRestaurants({
  uid, groupId, pageParam, filterTab, filterCategory, filterVibes, sortBy, restaurantId
}: FetchRestaurantsOptions): Promise<{ restaurants: Restaurant[], nextCursor: string | null }> {
  if (!uid) return { restaurants: [], nextCursor: null };

  let query = supabase
    .from("restaurants")
    .select("*");

  if (groupId) {
    query = query.eq("group_id", groupId);
  }

  if (restaurantId) {
    query = query.eq("id", restaurantId);
  }

  // Server-side filtering
  if (filterTab === "cravelist") {
    query = query.eq("visited", false);
  } else if (filterTab === "tried") {
    query = query.eq("visited", true);
  }

  if (filterCategory) {
    const c = filterCategory.toLowerCase();
    if (c === "breakfast & brunch") {
      query = query.or("primary_type.ilike.%bagel%,name.ilike.%bagel%,primary_type.ilike.%breakfast%,name.ilike.%breakfast%,primary_type.ilike.%brunch%,name.ilike.%brunch%,primary_type.ilike.%diner%,name.ilike.%diner%");
    } else if (c === "bars") {
      query = query.or("primary_type.ilike.%bar%,primary_type.ilike.%pub%,primary_type.ilike.%night_club%,primary_type.ilike.%club%,primary_type.ilike.%wine%");
    } else if (c === "bakeries") {
      query = query.or("primary_type.ilike.%bakery%,name.ilike.%bakery%");
    } else if (c === "coffee & tea") {
      query = query.or("primary_type.ilike.%cafe%,primary_type.ilike.%coffee%,primary_type.ilike.%tea%,name.ilike.%coffee%");
    } else if (c === "ice cream & dessert") {
      query = query.or("primary_type.ilike.%ice_cream%,primary_type.ilike.%dessert%,name.ilike.%ice cream%,name.ilike.%gelato%");
    }
  }

  // Sorting and Pagination
  if (sortBy === "rating") {
    query = query.order("rating", { ascending: false, nullsFirst: false });
  } else {
    // Default or newest
    query = query.order("created_at", { ascending: false });
  }

  // If using cursor pagination, we filter by created_at. (Requires created_at ordering)
  // For sorting by rating, pagination needs an offset or cursor on rating. 
  // To keep it simple, we'll use offset if sorting by rating, or cursor if newest.
  // Actually, since we don't have an exact offset from pageParam, we can just use range.
  const PAGE_SIZE = 50;
  const pageIndex = pageParam ? parseInt(pageParam, 10) : 0;
  query = query.range(pageIndex * PAGE_SIZE, (pageIndex + 1) * PAGE_SIZE - 1);

  const { data, error } = await query;

  if (error) throw error;
  if (!data || data.length === 0) return { restaurants: [], nextCursor: null };

  const nextCursor = data.length === PAGE_SIZE ? (pageIndex + 1).toString() : null;

  // Fetch verified members and reviews in parallel to eliminate the network waterfall!
  const placeIds = data.map((r: any) => r.place_id).filter(Boolean);

  const [membersRes, globalReviewsRes] = await Promise.all([
    groupId ? supabase.from("group_members").select("user_id").eq("group_id", groupId) : Promise.resolve({ data: [] }),
    supabase.from("reviews").select("*").in("place_id", placeIds)
  ]);

  const activeGroupMembers = membersRes.data ? membersRes.data.map(m => m.user_id) : [];
  if (globalReviewsRes.error) throw globalReviewsRes.error;
  const allGlobalReviews = globalReviewsRes.data || [];

  // Batch pre-fetch all profiles for reviewers and owners instantly
  const uniqueUids = new Set(allGlobalReviews.map((r: any) => r.user_id));
  data.forEach((r: any) => { if (r.owner) uniqueUids.add(r.owner); });
  
  const { data: profilesData } = await supabase.from("profiles").select("id, first_name, last_name, avatar_url").in("id", Array.from(uniqueUids));
  
  const profilesNameMap: Record<string, string> = {};
  const profilesMap: Record<string, any> = {};
  
  profilesData?.forEach((p) => {
    profilesNameMap[p.id] = p.first_name || "Lover";
    profilesMap[p.id] = p;
  });

  allGlobalReviews.forEach((r: any) => {
    r.authorName = profilesNameMap[r.user_id] || "Guest";
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const restaurants = data.map((r: any) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const reviews = allGlobalReviews.filter((rev: any) => {
      if (rev.place_id !== r.place_id) return false;
      if (groupId) return rev.user_id === uid || activeGroupMembers.includes(rev.user_id);
      return true;
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const myReview = reviews.find((rev: any) => rev.user_id === uid);

    // Dynamically aggregate all photos uploaded by everyone within the Workspace!
    const allVisitPhotos: { url: string; authorId: string; authorName?: string }[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    reviews.forEach((rev: any) => {
      // Support the new infinite arrays natively
      if (rev.photo_urls && Array.isArray(rev.photo_urls) && rev.photo_urls.length > 0) {
        rev.photo_urls.forEach((url: string) => allVisitPhotos.push({ url, authorId: rev.user_id, authorName: rev.authorName }));
      }
      // Only fallback to legacy single string backup if the array isn't being used
      else if (rev.photo_url) {
        allVisitPhotos.push({ url: rev.photo_url, authorId: rev.user_id, authorName: rev.authorName });
      }
    });

    // Squad Approach: Only consider it "visited" for the group if all members have submitted a review
    const validGroupUsers = new Set(activeGroupMembers);
    validGroupUsers.add(uid); // Ensure current user is always counted in the threshold
    const uniqueReviewers = new Set(reviews.map((rev: any) => rev.user_id));
    const consensusReached = validGroupUsers.size > 0 && uniqueReviewers.size >= validGroupUsers.size;

    return {
      id: r.id,
      placeId: r.place_id,
      groupId: r.group_id,
      name: r.name,
      address: r.address,
      latitude: parseFloat(r.latitude),
      longitude: parseFloat(r.longitude),
      rating: r.rating ? parseFloat(r.rating) : null,
      userRatingCount: r.user_rating_count ?? null,
      priceLevel: r.price_level ?? null,
      primaryType: r.primary_type ?? null,
      photoUrl: r.photo_url ?? null,
      websiteUrl: r.website_url ?? null,
      bookingPlatform: r.booking_platform ?? null,
      bookingUrl: r.booking_url ?? null,
      vibes: typeof r.vibes === "string" ? JSON.parse(r.vibes) : r.vibes || [],
      // Use parsed JSON mapping for the arrays natively
      openingHours: typeof r.opening_hours === "string" ? JSON.parse(r.opening_hours) : r.opening_hours || null,
      lastSyncedAt: r.last_synced_at ?? null,

      // Fallback to r.visited for legacy instances, otherwise dynamically bind to Group Consensus!
      visited: !!r.visited || consensusReached,
      userScore: myReview?.score ?? null,
      notes: myReview?.notes ?? null,
      visitPhotoUrl: myReview?.photo_url ?? null,
      visitPhotoUrls: myReview?.photo_urls || [],
      visitedAt: myReview?.created_at ?? null,


      reviews: reviews,
      allVisitPhotos: allVisitPhotos,
      addedBy: r.owner && profilesMap[r.owner] ? profilesMap[r.owner] : null,

      createdAt: r.created_at,
    };
  });

  return { restaurants, nextCursor };
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

  // 🌍 ⚡️ LIVE WEBSOCKET SUBSCRIPTION
  // The silent observer. Replaces battery-draining polling with surgical push-events!
  useEffect(() => {
    const channel = supabase.channel("crave-global-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "restaurants" }, () => {
        queryClient.invalidateQueries({ queryKey: ["restaurants"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "reviews" }, () => {
        queryClient.invalidateQueries({ queryKey: ["restaurants"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "groups" }, () => {
        queryClient.invalidateQueries({ queryKey: ["groups"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "group_members" }, () => {
        queryClient.invalidateQueries({ queryKey: ["groups"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => {
        queryClient.invalidateQueries({ queryKey: ["groups"] }); // Needed for avatar updates!
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

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

  // 3. Unlinked Background Global Sync for Search Dedupe & Stats
  const globalRestaurantsQuery = useInfiniteQuery({
    queryKey: ["restaurants", "global", sessionUid],
    queryFn: ({ pageParam }) => fetchRestaurants({
      uid: sessionUid,
      pageParam: pageParam as string | null
    }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: !!sessionUid,
  });

  const removeMutation = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from("restaurants").delete().eq("id", id);
      if (error) throw error;
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["restaurants", derivedGroupId] });
      const previous = queryClient.getQueryData(["restaurants", derivedGroupId]);
      queryClient.setQueryData(["restaurants", derivedGroupId], (old: { restaurants: Restaurant[] } | undefined) => ({
        ...old, restaurants: old?.restaurants?.filter((r: Restaurant) => r.id !== id) || [],
      }));
      return { previous };
    },
    onError: (_err, _id, context) => { queryClient.setQueryData(["restaurants", derivedGroupId], context?.previous); },
    onSettled: () => { queryClient.invalidateQueries({ queryKey: ["restaurants", derivedGroupId] }); },
  });

  const activeGroup = groupsQuery.data?.find(g => g.id === derivedGroupId);

  const allRestaurants: Restaurant[] = restaurantsQuery.data?.pages.flatMap(p => p.restaurants) || [];
  const allGlobalRestaurants: Restaurant[] = globalRestaurantsQuery.data?.pages.flatMap(p => p.restaurants) || [];

  // Automatically bind the actively viewed card to the React Query cache
  // This physically updates the open modal the second polling detects your lover rated it!
  const syncedDetailRestaurant = detailRestaurant
    ? allRestaurants.find(r => r.id === detailRestaurant.id) || detailRestaurant
    : null;

  if (showSearch) return <SearchOverlay activeGroupId={derivedGroupId!} globalRestaurants={allGlobalRestaurants} groups={groupsQuery.data || []} onSave={() => setShowSearch(false)} onClose={() => setShowSearch(false)} />;

  // Wait for background validation before blindly rendering empty states from old caches
  const isHoldingForData = 
    groupsQuery.isLoading || 
    (groupsQuery.isFetching && groupsQuery.data?.length === 0) ||
    (derivedGroupId && restaurantsQuery.isLoading);

  if (isHoldingForData) {
    return <div className="h-screen w-full bg-slate-50" />;
  }

  // 🚀 New User Onboarding Interceptor
  // If the user has strictly zero groups, violently intercept the app shell to force list creation!
  if (groupsQuery.isSuccess && groupsQuery.data.length === 0) {
    return <OnboardingScreen onComplete={() => queryClient.invalidateQueries({ queryKey: ["groups"] })} />;
  }

  return (
    <div className="h-screen w-full flex flex-col relative bg-slate-50 animate-in fade-in zoom-in-[0.99] duration-700 ease-out">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&display=swap');
        *::-webkit-scrollbar { display: none; }
        * { font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif; -webkit-font-smoothing: antialiased; -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      {/* Top header bar */}
      <div className="pt-safe-or-4 px-4 pb-3 bg-white border-b border-slate-100 flex-shrink-0">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center flex-shrink-0 min-w-0 pr-2 relative z-50">
            <button
              type="button"
              onClick={() => setShowWorkspaceDropdown(!showWorkspaceDropdown)}
              className="flex items-center gap-2 active:opacity-70 transition-opacity min-w-0 text-left bg-slate-100 hover:bg-slate-200 pl-1 pr-3 py-1.5 rounded-full border border-slate-200/60 shadow-sm"
            >
              {groupsQuery.isLoading ? (
                <div className="w-8 h-8 rounded-full bg-slate-300 animate-pulse flex-shrink-0" />
              ) : activeGroup?.avatar_url ? (
                <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 shadow-sm border border-slate-200">
                  <img src={activeGroup.avatar_url} alt="" className="w-full h-full object-cover" />
                </div>
              ) : (
                <div 
                  className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm"
                  style={{ background: getGroupColor(activeGroup?.name || "Workspace"), color: "#fff" }}
                >
                  <span className="text-[11px] font-black tracking-wider">
                    {getGroupInitials(activeGroup?.name || "W")}
                  </span>
                </div>
              )}
              <h1 className="text-[15px] font-black tracking-tight text-slate-800 truncate max-w-[140px]">
                {groupsQuery.isLoading ? "Loading..." : (activeGroup?.name || "Workspace")}
              </h1>
              <ChevronDown size={14} strokeWidth={3} style={{ color: C.slate400 }} className="flex-shrink-0 ml-0.5" />
            </button>

            {/* Custom Popover Dropdown */}
            {showWorkspaceDropdown && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowWorkspaceDropdown(false)} />
                <div className="absolute top-[calc(100%+8px)] left-0 w-[220px] bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100 p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                  <p className="text-[10px] font-black tracking-widest text-slate-400 uppercase px-3 py-2 mb-1">Switch Cravelist</p>
                  {groupsQuery.data?.map(g => {
                    const isActive = derivedGroupId === g.id;
                    return (
                      <button
                        key={g.id}
                        onClick={() => { setActiveGroupId(g.id); setShowWorkspaceDropdown(false); }}
                        className={`w-full text-left px-2 py-2 rounded-xl transition-all flex items-center gap-3 ${isActive ? "" : "hover:bg-slate-50"}`}
                        style={isActive ? { background: C.rose + "10" } : {}}
                      >
                        {g.avatar_url ? (
                          <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0 shadow-sm border border-slate-100">
                            <img src={g.avatar_url} alt="" className="w-full h-full object-cover" />
                          </div>
                        ) : (
                          <div 
                            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm"
                            style={{ background: getGroupColor(g.name), color: "#fff" }}
                          >
                            <span className="text-[11px] font-black tracking-wider">{getGroupInitials(g.name)}</span>
                          </div>
                        )}
                        <div className="flex-1 min-w-0 pr-2">
                           <span className="truncate block text-[15px] font-bold text-slate-700" style={isActive ? { color: C.rose } : {}}>{g.name}</span>
                        </div>
                        {isActive && <div className="w-2.5 h-2.5 rounded-full flex-shrink-0 mr-1 shadow-sm border border-white" style={{ background: C.rose }} />}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
          <div className="flex-1 flex items-center justify-end gap-2 min-w-0">
            <button type="button" onClick={() => setShowSearch(true)}
              className="flex-1 max-w-[200px] h-11 flex items-center gap-2 bg-slate-50 rounded-full px-4 border border-slate-200 text-[15px] text-slate-400 font-medium overflow-hidden transition-all active:bg-slate-100 shadow-sm">
              <Search size={16} className="flex-shrink-0" />
              <span className="truncate">Find or Add...</span>
            </button>
          </div>
        </div>
      </div>

      {/* Tab content */}
      {activeTab === "list" && (
        <ListTab 
          restaurants={allRestaurants} 
          onDetail={setDetailRestaurant}
          onOpenSearch={() => setShowSearch(true)}
          fetchNextPage={() => restaurantsQuery.fetchNextPage()}
          hasNextPage={!!restaurantsQuery.hasNextPage}
          isFetchingNextPage={restaurantsQuery.isFetchingNextPage}
          // Filter props
          filterTab={filterTab}
          setFilterTab={setFilterTab}
          filterCategory={filterCategory}
          setFilterCategory={setFilterCategory}
          filterVibes={filterVibes}
          setFilterVibes={setFilterVibes}
          sortBy={sortBy}
          setSortBy={setSortBy}
        />
      )}
      {activeTab === "profile" && (
        <ProfileTab />
      )}
      {activeTab === "calendar" && (
        <CalendarTab 
          restaurants={allGlobalRestaurants} 
          onDetail={setDetailRestaurant} 
          groups={groupsQuery.data || []}
          fetchNextPage={() => globalRestaurantsQuery.fetchNextPage()}
          hasNextPage={!!globalRestaurantsQuery.hasNextPage}
          isFetchingNextPage={globalRestaurantsQuery.isFetchingNextPage}
        />
      )}
      {activeTab === "spin" && (
        <SpinTab onDetail={setDetailRestaurant} groupId={derivedGroupId!} />
      )}

      {/* Bottom tab bar */}
      <BottomTabBar active={activeTab} onChange={setActiveTab} />

      {/* Detail sheet */}
      {syncedDetailRestaurant && (
        <RestaurantDetailSheet
          restaurant={syncedDetailRestaurant}
          onRate={(r) => setRatingRestaurant(r)}
          onRemove={(id) => { removeMutation.mutate(id); setDetailRestaurant(null); }}
          onClose={() => setDetailRestaurant(null)}
          myUid={sessionUid}
        />
      )}

      {/* Rate sheet */}
      {ratingRestaurant && <RateSheet restaurant={ratingRestaurant} onClose={() => setRatingRestaurant(null)} />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Default Export (with auth gate)
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
  const [isInjectingLogin, setIsInjectingLogin] = useState(false);
  const hasBooted = useRef(false);

  useEffect(() => {
    // Lock orientation to vertical (portrait) for native mobile
    ScreenOrientation.lock({ orientation: "portrait" }).catch(() => { });

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (s) hasBooted.current = true;
      setSession(s);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, s) => {
      // Supabase natively forces a background refresh ping when iOS apps restore from background.
      // We block the animation sequence by explicitly referencing the mutable ref `hasBooted`
      // instead of checking `!session`, since React useEffect closures trap stale state!
      if (event === "SIGNED_IN" && !hasBooted.current) {
        hasBooted.current = true;
        
        // Trigger cinematic fade-out of Auth Screen
        setIsInjectingLogin(true);
        setTimeout(() => {
          setSession(s); // Swap the DOM memory payload while screen is invisible

          // Wait 50ms for React DOM to paint the invisible CraveApp, then trigger the fade-in
          setTimeout(() => {
            setIsInjectingLogin(false);
          }, 50);
        }, 1000); // 1-second delay
      } else {
        setSession(s);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <PersistQueryClientProvider client={appQueryClient} persistOptions={{ persister }}>
      {showSplash && <AnimatedSplash onComplete={() => setShowSplash(false)} />}

      {!loading && (
        <div className={`h-full w-full origin-center 
          transition-all ease-out
          ${!showSplash ? "opacity-100 scale-100 duration-1000" : "opacity-0 scale-[0.92] pointer-events-none"} 
          ${isInjectingLogin ? "!opacity-0 !scale-[0.97] !duration-[800ms]" : "duration-1000"}
        `}>
          {session ? <CraveApp sessionUid={session.user.id} /> : <AuthScreen />}
        </div>
      )}
    </PersistQueryClientProvider>
  );
}
