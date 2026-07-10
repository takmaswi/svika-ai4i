import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLang, t } from "@/lib/i18n";
import { CONSENT_VERSION, hasActiveConsent, type ConsentRecord } from "@svika/shared";

// The consent gate. Every surface under /app sits behind it: a user whose
// latest consent record is not an accept (or who has none) is sent to the
// consent screen before anything else renders. Withdrawal on the privacy
// page closes this gate again. Demo personas additionally carry a permanent
// on-screen chip so no demo surface can pass as a real account.
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

  const [consentRes, profileRes] = await Promise.all([
    // scoped to the app consent stream: the profile's emergency details
    // stream lives in the same table and must never move this gate
    supabase
      .from("consent_records")
      .select("action, created_at")
      .eq("version", CONSENT_VERSION),
    supabase.from("profiles").select("demo_sim").eq("id", user.id).maybeSingle(),
  ]);
  if (!hasActiveConsent((consentRes.data ?? []) as ConsentRecord[])) {
    redirect("/consent");
  }

  if (!profileRes.data?.demo_sim) return children;

  const lang = await getLang();
  return (
    <>
      <span className="demo-account-chip" data-testid="demo-account-chip">
        {t(lang, "demo.chip")}
      </span>
      {children}
    </>
  );
}
