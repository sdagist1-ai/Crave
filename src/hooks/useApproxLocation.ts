import { useEffect, useState } from "react";
import { Geolocation } from "@capacitor/geolocation";
import type { Coords } from "../lib/places";

/**
 * Best-effort current location for biasing search results. Never prompts:
 * it only reads a position if location permission was already granted
 * (e.g. from the Passport map), and resolves to null otherwise.
 */
export function useApproxLocation(): Coords | null {
  const [coords, setCoords] = useState<Coords | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { location } = await Geolocation.checkPermissions();
        if (location !== "granted") return;
        const pos = await Geolocation.getCurrentPosition({
          enableHighAccuracy: false,
          maximumAge: 10 * 60 * 1000,
          timeout: 4000,
        });
        if (!cancelled) setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      } catch {
        // Unavailable or denied: search simply isn't location-biased.
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return coords;
}
