import type { SupabaseClient } from "@supabase/supabase-js";
import { primaryRole, type Role } from "@svika/shared";

// Role is derived, not stored. A signed-in user can read their own owners /
// conductors row under RLS; presence of either elevates them. See @svika/shared
// primaryRole for precedence.
export async function resolveRole(
  supabase: SupabaseClient,
  uid: string,
): Promise<Role> {
  const [owner, conductor] = await Promise.all([
    supabase.from("owners").select("id").eq("profile_id", uid).maybeSingle(),
    supabase.from("conductors").select("id").eq("profile_id", uid).maybeSingle(),
  ]);
  return primaryRole({ isOwner: !!owner.data, isConductor: !!conductor.data });
}
