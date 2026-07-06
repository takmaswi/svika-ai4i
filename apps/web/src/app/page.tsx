import Link from "next/link";
import { getLang, t } from "@/lib/i18n";
import { LanguageToggle } from "@/components/LanguageToggle";

export default async function LandingPage() {
  const lang = await getLang();
  return (
    <main className="landing">
      <header className="landing-top">
        {/* Exported wordmark, never rebuilt. */}
        <img className="wordmark" src="/wordmark.svg" alt="Svika" height={28} />
        <LanguageToggle lang={lang} />
      </header>

      <section className="landing-hero svika-animate-fade-up">
        <p className="svika-meta landing-eyebrow">{t(lang, "brand.tagline")}</p>
        <h1 className="svika-display">{t(lang, "landing.headline")}</h1>
        <p className="svika-body landing-sub">{t(lang, "landing.sub")}</p>
        <Link className="cta touch-target" href="/login">
          {t(lang, "landing.cta")}
        </Link>
      </section>
    </main>
  );
}
