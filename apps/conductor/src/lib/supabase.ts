// One browser client for the hwindi surface. Anon key only: every write goes
// through the security definer RPCs and RLS is the wall, exactly as on web.
import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  import.meta.env.NEXT_PUBLIC_SUPABASE_URL,
  import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);
