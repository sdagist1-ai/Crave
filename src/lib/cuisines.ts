import { queryOptions } from "@tanstack/react-query";
import { supabase } from "./supabase";

// Cuisines and occasions (see supabase/migrations/*_cuisines_and_occasions.sql).
// The database guesses both whenever a place is saved; these are the reads and the
// member edits.

type Counts = { cravelist: number; tried: number };
export type ListFacets = {
  cuisines: (Counts & { label: string })[];
  occasions: (Counts & { label: string })[];
  needs_cuisine: Counts;
};

/** "" in a cuisine filter means "places without a cuisine yet". */
export const NEEDS_CUISINE = "";

/** "Thai", "Thai + Korean", "Thai + 2 more" */
export function cuisinesLabel(cuisines: string[]) {
  const names = cuisines.map((c) => (c === NEEDS_CUISINE ? "Needs a cuisine" : c));
  return names.length <= 2 ? names.join(" + ") : `${names[0]} + ${names.length - 1} more`;
}

/** What's on a list, with counts per tab: drives the chip row and the Cuisines sheet.
 *  Under "restaurants" so it refreshes whenever places change. */
export function facetsQuery(groupId: string | undefined) {
  return queryOptions({
    queryKey: ["restaurants", "facets", groupId],
    queryFn: async (): Promise<ListFacets> => {
      const { data, error } = await supabase.rpc("get_list_facets", { p_group_id: groupId! });
      if (error) throw error;
      return data as unknown as ListFacets;
    },
    enabled: !!groupId,
  });
}

/** `cuisine` is the group (Caribbean); `detail` the specific cuisine (Jamaican). */
export type CuisineGuess = { cuisine: string | null; detail: string | null; crowd: string[] };

/** The cuisine the database would give this place, and what other lists call it. */
export async function guessCuisine(place: { id: string; name: string; primaryType?: string; types?: string[] }): Promise<CuisineGuess> {
  const { data, error } = await supabase.rpc("guess_place_cuisine", {
    p_place_id: place.id,
    p_primary_type: place.primaryType,
    p_types: place.types,
    p_name: place.name,
  });
  if (error) throw error;
  const guess = data as unknown as { cuisine: string | null; detail: string | null; crowd: string[] | null };
  return { cuisine: guess.cuisine ?? null, detail: guess.detail ?? null, crowd: guess.crowd ?? [] };
}

/** A member's fix, shared with everyone on the list (null clears the cuisine). */
export async function updatePlaceTags(id: number, changes: { cuisine?: string | null; occasions?: string[] }) {
  const { error } = await supabase.from("restaurants").update(changes).eq("id", id);
  if (error) throw error;
}
