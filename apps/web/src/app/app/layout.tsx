import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasActiveConsent, type ConsentRecord } from "@svika/shared";

// The consent gate. Every surface under /app sits behind it: a user whose
// latest consent record is not an accept (or who has none) is sent to the
// consent screen before anything else renders. Withdrawal on the privacy
// page closes this gate again.
export default async function ConsentGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data } = await supabase
    .from("consent_records")
    .select("action, created_at");
  if (!hasActiveConsent((data ?? []) as ConsentRecord[])) redirect("/consent");

  return children;
}
