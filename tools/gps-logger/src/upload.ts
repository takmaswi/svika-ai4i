// Optional "upload when online" to the database. This is a Tier-2 path on
// purpose: local export (deliver.ts) is the primary, reliable route.
//
// HONESTY NOTE: the gps_pings table does not exist in packages/db/migrations
// yet (only public.stops does). Until a migration creates it with RLS, this
// upload has no target and will report that clearly rather than pretend. When
// the table lands, this posts the proposed gps_pings rows through PostgREST
// using the anon key plus a signed-in access token (RLS is the wall).

import { buildBundle, type JourneyExport } from "./export";

const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ?? import.meta.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON =
  import.meta.env.VITE_SUPABASE_ANON_KEY ??
  import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const ACCESS_TOKEN_KEY = "svika-gps-access-token";

export function uploadConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON);
}

export function getAccessToken(): string {
  return localStorage.getItem(ACCESS_TOKEN_KEY) ?? "";
}

export function setAccessToken(token: string): void {
  const trimmed = token.trim();
  if (trimmed) localStorage.setItem(ACCESS_TOKEN_KEY, trimmed);
  else localStorage.removeItem(ACCESS_TOKEN_KEY);
}

export interface UploadResult {
  ok: boolean;
  message: string;
}

export async function uploadJourney(data: JourneyExport): Promise<UploadResult> {
  if (!uploadConfigured()) {
    return {
      ok: false,
      message:
        "Upload not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in the repo .env.local. Use export instead.",
    };
  }
  const token = getAccessToken() || SUPABASE_ANON!;
  const rows = buildBundle(data).gps_pings;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/gps_pings`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        apikey: SUPABASE_ANON!,
        authorization: `Bearer ${token}`,
        prefer: "return=minimal",
      },
      body: JSON.stringify(rows),
    });
    if (res.ok) {
      return { ok: true, message: `Uploaded ${rows.length} pings.` };
    }
    if (res.status === 404) {
      return {
        ok: false,
        message:
          "gps_pings table not found. It is not in the migrations yet. Export locally; upload once the table exists.",
      };
    }
    const body = await res.text();
    return { ok: false, message: `Upload failed (${res.status}). ${body.slice(0, 160)}` };
  } catch (err) {
    return {
      ok: false,
      message: `Upload failed: ${err instanceof Error ? err.message : "network error"}. Your data is safe locally.`,
    };
  }
}
