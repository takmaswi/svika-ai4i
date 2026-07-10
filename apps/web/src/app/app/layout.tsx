import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLang, t } from "@/lib/i18n";
import { hasActiveConsent, type ConsentRecord } from "@svika/shared";

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
    supabase.from("consent_records").select("action, created_at"),
    supabase.from("profiles").select("demo_sim").eq("id", user.id).maybeSingle(),
  ]);
  if (!hasActiveConsent((consentRes.data ?? []) as ConsentRecord[])) {
    redirect("/consent");
  }

  if (!profileRes.data?.demo_sim) return children;

  const lang = await getLang();
  return (
    <>
      <span className="demo-account-chip svika-glass" data-testid="demo-account-chip">
        <span className="svika-pulse-dot" aria-hidden />
        {t(lang, "demo.chip")}
      </span>
      {children}
    </>
  );
}
