// Test-only login endpoint for Playwright. The product login is phone OTP;
// e2e and rehearsal use the seeded password accounts (mock twin rule: the
// suite never depends on a live SMS vendor). Refuses to exist unless
// E2E_AUTH=on, which is set only for local/CI e2e runs, never in a deploy.
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  if (process.env.E2E_AUTH !== "on") {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const body = (await request.json().catch(() => null)) as {
    email?: string;
    password?: string;
  } | null;
  if (!body?.email || !body.password) {
    return NextResponse.json({ error: "email and password required" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: body.email,
    password: body.password,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }
  return NextResponse.json({ userId: data.user.id });
}
