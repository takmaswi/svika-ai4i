import Link from "next/link";
import { getLang, t } from "@/lib/i18n";
import { LanguageToggle } from "@/components/LanguageToggle";
import { LiveMapLazy } from "@/components/map/LiveMapLazy";
import { enterDemo } from "@/lib/demo-actions";

// The landing: the live map is the pitch. Over it, the change problem in
// two short sentences, the real door (phone sign in) and the demo door
// (one tap in as a pooled demo persona, or a guided story).
export default async function LandingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const lang = await getLang();
  const params = await searchParams;
  const demoErr = params.demoerr === "1";

  return (
    <main className="landing-screen">
      <div className="home-map">
        <LiveMapLazy
          labels={{
            ariaLabel: t(lang, "map.ariaLabel"),
            demoChip: t(lang, "map.demoChip"),
            unavailable: t(lang, "map.unavailable"),
          }}
        />
      </div>

      <header className="home-chips">
        <span className="home-chip home-chip-brand svika-glass">
          {/* Exported wordmark, never rebuilt. */}
          <img className="wordmark" src="/wordmark.svg" alt="Svika" height={22} />
        </span>
        <span className="home-chip svika-glass">
          <LanguageToggle lang={lang} />
        </span>
      </header>

      <section className="landing-panel svika-glass-strong svika-animate-fade-up">
        <p className="svika-meta landing-eyebrow">{t(lang, "brand.tagline")}</p>
        <h1 className="svika-display landing-headline">
          {t(lang, "landing.headline")}
        </h1>
        <p className="svika-body landing-story">
          {t(lang, "landing.story1")} {t(lang, "landing.story2")}
        </p>

        <Link className="cta touch-target landing-cta" href="/login">
          {t(lang, "landing.cta")}
        </Link>

        <div className="landing-demo">
          <p className="svika-meta landing-demo-lead">{t(lang, "landing.demoLead")}</p>
          {demoErr && (
            <p className="auth-error svika-body">{t(lang, "landing.demoErr")}</p>
          )}
          <div className="landing-demo-doors">
            <form action={enterDemo}>
              <input type="hidden" name="target" value="rider" />
              <button
                className="landing-demo-btn touch-target"
                type="submit"
                data-testid="demo-door"
              >
                {t(lang, "landing.demoEnter")}
              </button>
            </form>
            <form action={enterDemo}>
              <input type="hidden" name="target" value="owner" />
              <button className="landing-demo-btn touch-target" type="submit">
                {t(lang, "landing.demoOwner")}
              </button>
            </form>
          </div>
          <p className="svika-meta landing-demo-stories-lead">
            {t(lang, "landing.demoStories")}
          </p>
          <div className="landing-demo-doors">
            <form action={enterDemo}>
              <input type="hidden" name="target" value="rider" />
              <input type="hidden" name="story" value="tariro-town" />
              <button
                className="landing-story-btn touch-target"
                type="submit"
                data-testid="story-door-town"
              >
                {t(lang, "landing.demoStory1")}
              </button>
            </form>
            <form action={enterDemo}>
              <input type="hidden" name="target" value="rider" />
              <input type="hidden" name="story" value="transfer-trip" />
              <button
                className="landing-story-btn touch-target"
                type="submit"
                data-testid="story-door-transfer"
              >
                {t(lang, "landing.demoStory2")}
              </button>
            </form>
          </div>
        </div>
      </section>
    </main>
  );
}
