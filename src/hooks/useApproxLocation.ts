import { useCallback, useEffect, useState } from "react";
import { Geolocation } from "@capacitor/geolocation";
import type { Coords } from "../lib/places";

export type LocationStatus = "checking" | "granted" | "prompt" | "denied" | "unavailable";

async function readPosition(): Promise<Coords> {
  const pos = await Geolocation.getCurrentPosition({
    enableHighAccuracy: false,
    maximumAge: 10 * 60 * 1000,
    timeout: 8000,
  });
  return { lat: pos.coords.latitude, lng: pos.coords.longitude };
}

/**
 * The user's approximate location for "near you first" search results.
 * Never prompts on its own: it reads a position only if permission was already
 * granted. Call `request()` from a user action to show the system prompt.
 */
export function useApproxLocation() {
  const [coords, setCoords] = useState<Coords | null>(null);
  const [status, setStatus] = useState<LocationStatus>("checking");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { location } = await Geolocation.checkPermissions();
        if (cancelled) return;
        if (location !== "granted") {
          setStatus(location === "denied" ? "denied" : "prompt");
          return;
        }
        setStatus("granted");
        const c = await readPosition();
        if (!cancelled) setCoords(c);
      } catch {
        if (!cancelled) setStatus("unavailable");
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const request = useCallback(async () => {
    try {
      const { location } = await Geolocation.requestPermissions({ permissions: ["location"] });
      if (location !== "granted") {
        setStatus("denied");
        return;
      }
      setStatus("granted");
      setCoords(await readPosition());
    } catch {
      // Browsers without a permissions API prompt from getCurrentPosition itself.
      try {
        setCoords(await readPosition());
        setStatus("granted");
      } catch {
        setStatus("denied");
      }
    }
  }, []);

  return { coords, status, request };
}
