// @ts-nocheck
import { useMemo, useState, useRef, useEffect } from "react";
import Map, { Source, Layer, Marker, Popup, MapRef, GeolocateControl } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import { Restaurant } from "../types";
import { Icon } from "@iconify/react";
import { C } from "../constants/theme";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

export function PassportTab({ restaurants, onQuickStamp }: { restaurants: Restaurant[], onQuickStamp?: () => void }) {
  const mapRef = useRef<MapRef>(null);
  const geoRef = useRef(null);
  const [selectedPlace, setSelectedPlace] = useState<Restaurant | null>(null);
  const [viewMode, setViewMode] = useState<'globe' | 'book'>('globe');
  const [filterMode, setFilterMode] = useState<'tried' | 'cravelist'>('tried');

  // Auto-trigger location on mount
  useEffect(() => {
    // Small timeout ensures the map has fully rendered before requesting location
    const timer = setTimeout(() => {
      geoRef.current?.trigger();
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  // 1. Filter out visited vs unvisited based on filterMode
  const activePlaces = useMemo(() => {
    const filtered = restaurants.filter(r => {
      const isVisited = !!r.visited || (r.reviews && r.reviews.length > 0) || !!r.userScore;
      return filterMode === 'tried' ? isVisited : !isVisited;
    });
    return filtered.sort((a, b) => {
      // Sort so most recent are first
      const dateA = a.visitedAt || a.createdAt;
      const dateB = b.visitedAt || b.createdAt;
      if (dateA && dateB) return new Date(dateB).getTime() - new Date(dateA).getTime();
      return 0;
    });
  }, [restaurants, filterMode]);

  // Total active places for the top stat
  const totalPlaces = activePlaces.length;

  // Helper to accurately extract and normalize city from Google Maps formatted address
  const getCityName = (address: string | null) => {
    if (!address) return "Unknown City";
    const parts = address.split(',').map(p => p.trim());
    if (parts.length < 2) return parts[0];
    
    const region = parts[parts.length - 2];
    let city = /\d/.test(region) && parts.length > 2 ? parts[parts.length - 3] : region;
    
    // Normalize NYC Boroughs & Neighborhoods into "New York City"
    if (region.match(/NY\s+(10[0-4]|11[1-4]|116)\d{2}/i) || 
        ['brooklyn', 'queens', 'bronx', 'staten island', 'manhattan', 'new york'].includes(city.toLowerCase())) {
      return "New York City";
    }
    return city;
  };

  // 2. Parse Cities and Countries dynamically from active places for Stats
  const stats = useMemo(() => {
    const countries = new Set<string>();
    const cities = new Set<string>();
    
    activePlaces.forEach(r => {
      if (!r.address) return;
      const parts = r.address.split(',').map(p => p.trim());
      if (parts.length > 0) countries.add(parts[parts.length - 1]);
      cities.add(getCityName(r.address));
    });

    return {
      countries: countries.size,
      cities: cities.size
    };
  }, [activePlaces]);

  // 3. Convert to GeoJSON FeatureCollection for Mapbox Heatmap (SYNCED WITH MARKERS)
  const geojsonData = useMemo(() => {
    return {
      type: "FeatureCollection",
      features: activePlaces.map(r => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [r.longitude, r.latitude] },
        properties: { mag: 1 }
      }))
    };
  }, [activePlaces]);

  // 4. Heatmap Layer Styling
  const heatmapLayer = {
    id: "active-heatmap",
    type: "heatmap",
    source: "active-places",
    maxzoom: 10,
    paint: {
      "heatmap-weight": ["interpolate", ["linear"], ["get", "mag"], 0, 0, 1, 1],
      "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 0, 1, 9, 3],
      "heatmap-color": [
        "interpolate", ["linear"], ["heatmap-density"],
        0, filterMode === 'tried' ? "rgba(255,69,58,0)" : "rgba(10,132,255,0)",
        0.2, filterMode === 'tried' ? "rgba(255,69,58,0.2)" : "rgba(10,132,255,0.2)",
        0.4, filterMode === 'tried' ? "rgba(255,69,58,0.4)" : "rgba(10,132,255,0.4)",
        0.6, filterMode === 'tried' ? "rgba(255,69,58,0.6)" : "rgba(10,132,255,0.6)",
        0.8, filterMode === 'tried' ? "rgba(255,69,58,0.8)" : "rgba(10,132,255,0.8)",
        1, filterMode === 'tried' ? "rgb(255,69,58)" : "rgb(10,132,255)"
      ],
      "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 0, 8, 9, 25],
      "heatmap-opacity": ["interpolate", ["linear"], ["zoom"], 4, 1, 10, 0]
    }
  };

  const flyToPlace = (r: Restaurant) => {
    setViewMode('globe'); // Force globe view when flying
    setSelectedPlace(r);
    
    const map = mapRef.current?.getMap();
    const currentZoom = map ? map.getZoom() : 10;
    // If already at city/neighborhood level (>= 9.5), keep current zoom so nearby spots stay in view!
    // Only if zoomed out on the globe (< 9.5), gently zoom in to 11 (full city overview).
    const targetZoom = currentZoom >= 9.5 ? currentZoom : 11;
    
    mapRef.current?.flyTo({
      center: [r.longitude, r.latitude],
      zoom: targetZoom,
      pitch: 0,
      duration: 800,
      essential: true
    });
  };

  const fitAllPlaces = () => {
    setSelectedPlace(null);
    if (!mapRef.current || activePlaces.length === 0) return;
    
    if (activePlaces.length === 1) {
      mapRef.current.flyTo({
        center: [activePlaces[0].longitude, activePlaces[0].latitude],
        zoom: 11,
        duration: 800,
        essential: true,
      });
      return;
    }

    const lats = activePlaces.map(p => p.latitude);
    const lngs = activePlaces.map(p => p.longitude);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    mapRef.current.fitBounds(
      [[minLng, minLat], [maxLng, maxLat]],
      {
        padding: { top: 160, bottom: 260, left: 60, right: 60 },
        maxZoom: 12,
        duration: 800
      }
    );
  };



  return (
    <div className="flex-1 bg-background relative flex flex-col h-full w-full overflow-hidden">
      
      {/* ─────────────────────────────────────────────────────────────────
          HEADER METRICS & TOGGLES
      ────────────────────────────────────────────────────────────────── */}
      <div className="absolute top-0 left-0 right-0 z-30 pt-safe bg-gradient-to-b from-background/90 via-background/60 to-transparent pointer-events-none transition-all">
        <div className="px-6 pb-4 pt-4 flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-black font-heading text-foreground tracking-tight">
              Passport
            </h1>
            <div className="flex gap-4 mt-2">
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Places</p>
                <p className="text-lg font-black text-foreground leading-none">{totalPlaces}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Cities</p>
                <p className="text-lg font-black text-foreground leading-none">{stats.cities}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Countries</p>
                <p className="text-lg font-black text-foreground leading-none">{stats.countries}</p>
              </div>
            </div>
          </div>
          
          <div className="flex flex-col gap-3 items-end">
            {/* View Toggle */}
            <div className="pointer-events-auto bg-card/80 backdrop-blur-md border border-border/50 p-1 rounded-full flex gap-1 shadow-sm">
              <button 
                onClick={() => setViewMode('globe')}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${viewMode === 'globe' ? 'bg-primary text-primary-foreground shadow-md shadow-primary/30' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <Icon icon="solar:globus-bold" className="text-xl" />
              </button>
              <button 
                onClick={() => setViewMode('book')}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${viewMode === 'book' ? 'bg-primary text-primary-foreground shadow-md shadow-primary/30' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <Icon icon="solar:gallery-bold" className="text-xl" />
              </button>
            </div>
          </div>
        </div>

        {/* Bucket List Toggle Segmented Control */}
        <div className="px-6 mt-2 pointer-events-auto flex justify-center">
          <div className="bg-card/90 backdrop-blur-md border border-border/50 p-1 rounded-full flex gap-1 shadow-md max-w-xs w-full">
            <button 
              onClick={() => { setFilterMode('tried'); setSelectedPlace(null); }}
              className={`flex-1 py-2 rounded-full font-bold text-xs transition-all ${filterMode === 'tried' ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/30' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Tried
            </button>
            <button 
              onClick={() => { setFilterMode('cravelist'); setSelectedPlace(null); }}
              className={`flex-1 py-2 rounded-full font-bold text-xs transition-all ${filterMode === 'cravelist' ? 'bg-[#0a84ff] text-white shadow-sm shadow-[#0a84ff]/30' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Cravelist
            </button>
          </div>
        </div>

        {/* Overview Button: Instantly frames all spots without tedious manual zooming */}
        {viewMode === 'globe' && activePlaces.length > 0 && (
          <div className="mt-2 pointer-events-auto flex justify-center">
            <button
              onClick={fitAllPlaces}
              className="px-3.5 py-1.5 rounded-full bg-card/90 backdrop-blur-md border border-border/50 text-foreground font-bold text-[11px] flex items-center gap-1.5 shadow-sm hover:bg-card active:scale-95 transition-all"
            >
              <Icon icon="solar:compass-bold" className="text-primary text-xs" />
              <span>View all {activePlaces.length} {filterMode === 'tried' ? 'tried' : 'saved'} spots</span>
            </button>
          </div>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────────
          STAMPS BOOK VIEW (GRID)
      ────────────────────────────────────────────────────────────────── */}
      <div 
        className={`absolute inset-0 z-20 bg-background overflow-y-auto pb-[100px] pt-[170px] px-4 transition-all duration-500 ${
          viewMode === 'book' ? 'opacity-100 pointer-events-auto scale-100' : 'opacity-0 pointer-events-none scale-95'
        }`}
      >
        <div className="columns-2 gap-4 space-y-4">
          {activePlaces.map((r) => (
            <div key={r.id} className="break-inside-avoid relative rounded-3xl bg-card border border-border/50 shadow-sm overflow-hidden flex flex-col">
              <div className="w-full aspect-[4/5] bg-muted relative">
                {r.visitPhotoUrl ? (
                  <img src={r.visitPhotoUrl} className="w-full h-full object-cover" />
                ) : r.photoUrl ? (
                  <img src={r.photoUrl} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-slate-100 dark:bg-slate-800">
                    <Icon icon="ph:fork-knife-fill" className="text-muted-foreground/30 text-4xl" />
                  </div>
                )}
                
                {/* Score Stamp overlaying image */}
                {r.userScore && filterMode === 'tried' && (
                  <div className="absolute top-3 right-3 w-10 h-10 rounded-full bg-primary text-white font-black flex items-center justify-center border-2 border-white shadow-lg transform rotate-12">
                    {r.userScore.toFixed(1)}
                  </div>
                )}
              </div>
              <div className="p-4 flex flex-col gap-1">
                <h3 className="font-bold text-foreground text-sm leading-tight line-clamp-2">{r.name}</h3>
                <p className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                  <Icon icon="solar:map-point-linear" />
                  {getCityName(r.address)}
                </p>
                {r.visitedAt && filterMode === 'tried' && (
                  <p className="text-[10px] text-muted-foreground/60 mt-1">
                    {new Date(r.visitedAt).toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>
          ))}

          {activePlaces.length === 0 && (
             <div className="col-span-2 w-full h-[300px] rounded-3xl bg-muted/50 border border-border/50 flex flex-col items-center justify-center text-center p-6">
                <Icon icon="solar:ticket-linear" className="text-muted-foreground/40 text-5xl mb-3" />
                <p className="text-muted-foreground font-medium text-sm">
                  {filterMode === 'tried' ? "Your passport is empty.\nGo explore some restaurants!" : "Your Cravelist is empty.\nSave some places to try!"}
                </p>
             </div>
          )}
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────
          GLOBE VIEW (MAPBOX)
      ────────────────────────────────────────────────────────────────── */}
      <div className={`flex-1 w-full h-full bg-[#f2f2f7] transition-opacity duration-500 ${viewMode === 'book' ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
        <Map
          ref={mapRef}
          initialViewState={{ longitude: -40.0, latitude: 30.0, zoom: 2, pitch: 0 }}
          maxPitch={0}
          minPitch={0}
          dragRotate={false}
          touchPitch={false}
          mapStyle="mapbox://styles/mapbox/light-v11"
          mapboxAccessToken={MAPBOX_TOKEN}
          attributionControl={false}
          projection="globe"
          onClick={() => setSelectedPlace(null)}
          fog={{
            range: [0.5, 10],
            color: '#ffffff',
            "high-color": '#f2f2f7',
            "space-color": '#e5e5ea',
            "star-intensity": 0.0
          }}
          style={{ width: "100%", height: "100%" }}
        >
          {/* USER LOCATION TRACKING */}
          <GeolocateControl 
            ref={geoRef}
            position="top-right" 
            trackUserLocation={true} 
            showUserHeading={true} 
            fitBoundsOptions={{ maxZoom: 11 }}
            style={{ marginTop: '160px', marginRight: '16px', borderRadius: '100px', overflow: 'hidden' }} 
          />

          {activePlaces.length > 0 && (
            <Source id="active-places" type="geojson" data={geojsonData}>
              <Layer {...heatmapLayer} />
            </Source>
          )}

          {/* Interactive Pins - Render ALL active places on the globe! */}
          {activePlaces.map((r) => (
            <Marker
              key={r.id}
              longitude={r.longitude}
              latitude={r.latitude}
              anchor="bottom"
              onClick={(e) => {
                e.originalEvent.stopPropagation();
                flyToPlace(r);
              }}
            >
              <div 
                className="w-8 h-8 rounded-full border-2 border-white shadow-lg overflow-hidden cursor-pointer active:scale-95 transition-transform" 
                style={{ background: filterMode === 'tried' ? C.rose : '#0a84ff' }}
              >
                {r.visitPhotoUrl ? (
                  <img src={r.visitPhotoUrl} alt={r.name} className="w-full h-full object-cover" />
                ) : r.photoUrl ? (
                  <img src={r.photoUrl} alt={r.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white">
                    <Icon icon="ph:fork-knife-fill" />
                  </div>
                )}
              </div>
            </Marker>
          ))}

          {/* Popup for Selected Place */}
          {selectedPlace && (
            <Popup
              longitude={selectedPlace.longitude}
              latitude={selectedPlace.latitude}
              anchor="bottom"
              offset={40}
              onClose={() => setSelectedPlace(null)}
              closeButton={false}
              className="crave-popup rounded-3xl overflow-hidden"
            >
              <div className="p-3 min-w-[150px] bg-card rounded-2xl shadow-xl flex flex-col items-center border border-border/50">
                <p className="font-bold text-foreground text-sm text-center line-clamp-1">{selectedPlace.name}</p>
                {selectedPlace.userScore && filterMode === 'tried' && (
                  <div className="flex items-center gap-1 mt-1 text-primary">
                    <Icon icon="solar:star-bold" className="text-xs" />
                    <span className="font-bold text-sm">{selectedPlace.userScore}</span>
                  </div>
                )}
                {!selectedPlace.visited && (
                   <div className="flex items-center gap-1 mt-1 text-[#0a84ff]">
                     <Icon icon="solar:map-point-bold" className="text-xs" />
                     <span className="font-bold text-xs">Cravelist</span>
                   </div>
                )}
              </div>
            </Popup>
          )}
        </Map>
      </div>

      {/* ─────────────────────────────────────────────────────────────────
          QUICK STAMP FAB
      ────────────────────────────────────────────────────────────────── */}
      {viewMode === 'globe' && (
        <div className="absolute right-6 bottom-[230px] z-30 pointer-events-auto transition-transform">
          <button 
            onClick={onQuickStamp}
            className="w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-2xl flex items-center justify-center transform transition-transform active:scale-90 hover:scale-105 border-4 border-background"
          >
            <Icon icon="solar:add-circle-bold" className="text-2xl" />
          </button>
        </div>
      )}
      
      {/* Footer Stamps Overlay (Only visible in Globe View) */}
      <div className={`absolute bottom-0 left-0 right-0 z-20 pb-[100px] pt-20 bg-gradient-to-t from-background/90 via-background/60 to-transparent pointer-events-none transition-all duration-500 ${viewMode === 'book' ? 'opacity-0 translate-y-10' : 'opacity-100 translate-y-0'}`}>
        <div className="px-6 pointer-events-auto">
          <h2 className="text-muted-foreground font-bold text-[10px] uppercase tracking-widest mb-3 pl-2">
            {filterMode === 'tried' ? "Recent Stamps" : "Your Cravelist"}
          </h2>
          <div className="flex gap-4 overflow-x-auto no-scrollbar pb-4 -mx-6 px-6 snap-x snap-mandatory">
            {/* Limit footer carousel to 30 most recent so the horizontal list doesn't scroll forever */}
            {activePlaces.slice(0, 30).map((r) => (
              <button
                key={r.id}
                onClick={() => flyToPlace(r)}
                className="snap-start shrink-0 w-[140px] h-[180px] rounded-3xl bg-card border border-border/50 overflow-hidden relative shadow-md active:scale-95 transition-transform text-left"
              >
                <div className="absolute inset-0 bg-muted">
                  {r.visitPhotoUrl ? (
                    <img src={r.visitPhotoUrl} className="w-full h-full object-cover" />
                  ) : r.photoUrl ? (
                    <img src={r.photoUrl} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-slate-100 flex items-center justify-center">
                      <Icon icon="ph:fork-knife-fill" className="text-muted-foreground/30 text-4xl" />
                    </div>
                  )}
                </div>
                
                <div className="absolute inset-0 bg-gradient-to-b from-black/5 via-black/20 to-black/80" />
                
                <div className="absolute bottom-0 left-0 right-0 p-3">
                  {r.userScore && filterMode === 'tried' && (
                    <div className="absolute top-[-25px] right-3 bg-primary text-primary-foreground font-black text-[10px] px-2 py-1 rounded-full border-2 border-white shadow-lg">
                      {r.userScore.toFixed(1)}
                    </div>
                  )}
                  <h3 className="text-white font-bold text-sm leading-tight line-clamp-2 drop-shadow-md">{r.name}</h3>
                  {r.address && (
                    <p className="text-white/80 text-[10px] font-medium mt-1 line-clamp-1 drop-shadow-md">
                      {getCityName(r.address)}
                    </p>
                  )}
                </div>
                <div className="absolute top-3 left-3 w-6 h-6 rounded-full bg-white/30 backdrop-blur-md flex items-center justify-center border border-white/50">
                  <Icon icon={filterMode === 'tried' ? "solar:medal-ribbon-star-linear" : "solar:bookmark-linear"} className="text-white text-xs drop-shadow-sm" />
                </div>
              </button>
            ))}
            {activePlaces.length === 0 && (
              <div className="w-[140px] h-[180px] rounded-3xl bg-muted/50 border border-border/50 flex flex-col items-center justify-center text-center p-4">
                <Icon icon="solar:ticket-linear" className="text-muted-foreground/40 text-4xl mb-3" />
                <p className="text-muted-foreground/60 font-medium text-xs">
                  {filterMode === 'tried' ? "No stamps yet." : "Cravelist empty."}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}
