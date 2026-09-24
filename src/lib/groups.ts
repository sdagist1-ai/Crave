import { supabase } from "./supabase";
import type { Group, MyStats } from "../types";

/** Every Cravelist the user belongs to, with members and counts, oldest first. */
export async function fetchMyGroups(): Promise<Group[]> {
  const { data, error } = await supabase.rpc("get_my_groups");
  if (error) throw error;
  return (data ?? []) as unknown as Group[];
}

export async function fetchMyStats(): Promise<MyStats> {
  const { data, error } = await supabase.rpc("get_my_stats");
  if (error) throw error;
  return data as unknown as MyStats;
}
