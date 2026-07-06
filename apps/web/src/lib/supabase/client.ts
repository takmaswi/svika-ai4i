"use client";
import { createBrowserClient } from "@supabase/ssr";

// Browser Supabase client. Only ever sees the anon key; every privileged action
// goes through an RLS-guarded RPC, never a direct table write.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
