import Link from "next/link";
import { getLang, t } from "@/lib/i18n";
import { CONSENT_VERSION } from "@svika/shared";
import { LanguageToggle } from "@/components/LanguageToggle";
import { BackIcon } from "@/components/icons";

// The plain language privacy notice. Public: readable before signing in and
// linked from the consent screen. Short sections, no legal wall.
export default async function PrivacyPage() {
  const lang = await getLang();

  const sections = [
    ["privacy.collectH", "privacy.collectB"],
    ["privacy.whyH", "privacy.whyB"],
    ["privacy.moneyH", "privacy.moneyB"],
    ["privacy.aiH", "privacy.aiB"],
    ["privacy.shareH", "privacy.shareB"],
    ["privacy.controlH", "privacy.controlB"],
  ] as const;

  return (
    <main className="shell">
      <header className="shell-top">
        <Link href="/" className="back-btn" aria-label={t(lang, "common.back")}>
          <BackIcon />
        </Link>
        <LanguageToggle lang={lang} />
      </header>

      <section className="svika-card wallet-panel svika-animate-fade-up">
        <h1 className="svika-headline">{t(lang, "privacy.title")}</h1>
        {sections.map(([h, b]) => (
          <div key={h} className="privacy-section">
            <h2 className="svika-meta privacy-heading">{t(lang, h)}</h2>
            <p className="svika-body">{t(lang, b)}</p>
          </div>
        ))}
        <p className="svika-meta">
          {t(lang, "privacy.versionLabel")}:{" "}
          <span className="svika-mono-code">{CONSENT_VERSION}</span>
        </p>
      </section>
    </main>
  );
}
