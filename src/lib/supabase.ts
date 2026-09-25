import { createClient } from "@supabase/supabase-js";
import { publishForShareExtension, sessionStorageAdapter, SHARED_KEYS } from "./sharedStore";
import type { Database } from "../types/database";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
// supabase-js's default key, spelled out because the share extension reads it too.
const STORAGE_KEY = `sb-${new URL(SUPABASE_URL).hostname.split(".")[0]}-auth-token`;

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: sessionStorageAdapter,
    storageKey: STORAGE_KEY,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});
// Tell the share extension how to reach Supabase and where the session is.
void publishForShareExtension(
  SHARED_KEYS.config,
  JSON.stringify({ url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY, storageKey: STORAGE_KEY }),
);

/**
 * The signed-in user's id, read from the locally stored session (no network
 * round trip, unlike auth.getUser()). The database re-verifies the token on
 * every request, so this is safe for building queries.
 */
export async function getCurrentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}
