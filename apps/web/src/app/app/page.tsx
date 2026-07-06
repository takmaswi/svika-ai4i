import { redirect } from "next/navigation";
import { getLang, t, type DictKey } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { resolveRole } from "@/lib/roles";
import { SignOutButton } from "@/components/SignOutButton";
import { LanguageToggle } from "@/components/LanguageToggle";

// The authenticated shell. Middleware already blocks anonymous access; this also
// checks, then resolves the role and shows the signed-in user's own profile.
export default async function AppHome() {
  const lang = await getLang();
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, phone")
    .eq("id", user.id)
    .maybeSingle();

  const role = await resolveRole(supabase, user.id);
  const roleKey: DictKey = `role.${role}`;
  const name = profile?.full_name?.trim();

  return (
    <main className="shell">
      <header className="shell-top">
        <img className="wordmark" src="/wordmark.svg" alt="Svika" height={24} />
        <LanguageToggle lang={lang} />
      </header>

      <section className="shell-card svika-card svika-animate-fade-up">
        <p className="svika-meta">{t(lang, "app.welcome")}</p>
        <h1 className="svika-headline">{name || t(lang, roleKey)}</h1>

        <dl className="shell-facts">
          <div>
            <dt className="svika-meta">{t(lang, "app.roleLabel")}</dt>
            <dd className="svika-body">{t(lang, roleKey)}</dd>
          </div>
          <div>
            <dt className="svika-meta">{t(lang, "app.phoneLabel")}</dt>
            <dd className="svika-mono-code">{profile?.phone ?? "—"}</dd>
          </div>
        </dl>

        <SignOutButton label={t(lang, "app.signOut")} />
      </section>
    </main>
  );
}
