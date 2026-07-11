import Link from "next/link";
import { getLang, t } from "@/lib/i18n";
import { LanguageToggle } from "@/components/LanguageToggle";
import { LiveMapLazy } from "@/components/map/LiveMapLazy";
import { ArrowIcon } from "@/components/icons";
import { enterDemo } from "@/lib/demo-actions";

// The landing (reference screen 1): the Kombi highlight headline, the live
// map in a drawn card as the pitch, the change story as stat cards, one
// primary CTA into the real door, and the demo doors below the fold line.
export default async function LandingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const lang = await getLang();
  const params = await searchParams;
  const demoErr = params.demoerr === "1";

  return (
    <main className="landing">
      <header className="landing-top">
        {/* Exported wordmark, never rebuilt. */}
        <img className="wordmark" src="/wordmark.svg" alt="Svika" height={24} />
        <LanguageToggle lang={lang} />
      </header>

      <h1 className="landing-h1">
        <span className="landing-h1-line svika-animate-fade-up">
          {t(lang, "landing.headline1")}
        </span>
        {/* The marigold Hiace behind the word (DESIGN.md §10), verbatim. */}
        <span className="kombi-hl svika-drive">
          <svg
            className="kombi-hl-svg"
            viewBox="0 0 200 62"
            preserveAspectRatio="none"
            aria-hidden
          >
            <path
              d="M6 62 L6 20 Q6 5 22 5 L130 5 Q145 5 154 14 L186 40 Q200 48 200 56 L200 62 Z"
              fill="#F5B301"
            />
            <path
              d="M156 14 L161 14 Q167 15 171 20 L182 33 L156 33 Q153 33 153 27 L153 17 Q153 14 156 14 Z"
              fill="#161D18"
              opacity="0.8"
            />
          </svg>
          <span className="kombi-hl-word">{t(lang, "landing.headlineWord")}</span>
          <span className="kombi-hl-wheel kombi-hl-wheel-front" aria-hidden />
          <span className="kombi-hl-wheel kombi-hl-wheel-back" aria-hidden />
        </span>
      </h1>

      <p className="landing-body svika-animate-fade-up svika-rise-3">
        {t(lang, "landing.body")}
      </p>

      <div className="landing-map svika-animate-fade-up svika-rise-4">
        <LiveMapLazy
          labels={{
            ariaLabel: t(lang, "map.ariaLabel"),
            demoChip: t(lang, "map.demoChip"),
            unavailable: t(lang, "map.unavailable"),
          }}
        />
      </div>

      <div className="stat-row svika-animate-fade-up svika-rise-5">
        <div className="stat-card">
          <p className="stat-label">{t(lang, "landing.statChange")}</p>
          <p className="stat-value">
            $1.50
            <span className="stat-value-sub"> {t(lang, "landing.statWeek")}</span>
          </p>
        </div>
        <div className="stat-card stat-ticket">
          <span className="stat-stub" aria-hidden />
          <span className="stat-ticket-body">
            <p className="stat-label">{t(lang, "ticket.title")}</p>
            <p className="stat-code">74 21</p>
          </span>
        </div>
      </div>

      <Link className="cta touch-target landing-cta svika-animate-fade-up svika-rise-6" href="/login">
        {t(lang, "landing.cta")}
        <span className="cta-chip" aria-hidden>
          <ArrowIcon />
        </span>
      </Link>
      <p className="landing-signin svika-animate-fade-up svika-rise-7">
        {t(lang, "landing.signinHint")}{" "}
        <Link href="/login">{t(lang, "landing.signinLink")}</Link>
      </p>

      <div className="landing-demo svika-animate-fade-up svika-rise-7" id="shelf">
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
        {/* The sandbox shelf: the honesty split is the design feature. Real
            stories run real money on the live system; vision scenes are
            stamped simulations of what ships next, entered by plain links
            that sign nobody in. */}
        <p className="svika-meta landing-demo-stories-lead">
          {t(lang, "landing.shelfReal")}
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
          <form action={enterDemo}>
            <input type="hidden" name="target" value="rider" />
            <input type="hidden" name="story" value="rudo-night" />
            <button
              className="landing-story-btn touch-target"
              type="submit"
              data-testid="story-door-rudo"
            >
              {t(lang, "landing.demoStory4")}
            </button>
          </form>
        </div>
        {/* The intelligence: the three spines with their evidence. Real
            stories on the live system (Takunda's alert moves here as spine 2
            at work); nothing on these doors overclaims. */}
        <p className="svika-meta landing-demo-stories-lead">
          {t(lang, "landing.shelfIntel")}
        </p>
        <div className="landing-demo-doors">
          <form action={enterDemo}>
            <input type="hidden" name="target" value="rider" />
            <input type="hidden" name="story" value="eta-knows" />
            <button
              className="landing-story-btn touch-target"
              type="submit"
              data-testid="story-door-eta"
            >
              {t(lang, "landing.intelEta")}
            </button>
          </form>
          <form action={enterDemo}>
            <input type="hidden" name="target" value="rider" />
            <input type="hidden" name="story" value="takunda-morning" />
            <button
              className="landing-story-btn touch-target"
              type="submit"
              data-testid="story-door-takunda"
            >
              {t(lang, "landing.intelTakunda")}
            </button>
          </form>
        </div>
        <p className="svika-meta landing-demo-stories-lead">
          {t(lang, "landing.shelfVision")}
        </p>
        <div className="landing-demo-doors">
          <Link
            className="landing-vision-btn touch-target"
            href="/vision/tinashe?view=alert&story=tinashe-crash&step=0"
            data-testid="vision-door-tinashe"
          >
            {t(lang, "landing.visionTinashe")}
          </Link>
          <Link
            className="landing-vision-btn touch-target"
            href="/vision/gogo?story=gogo-ussd&step=0"
            data-testid="vision-door-gogo"
          >
            {t(lang, "landing.visionGogo")}
          </Link>
          <Link
            className="landing-vision-btn touch-target"
            href="/vision/capacity?story=kombi-capacity&step=0"
            data-testid="vision-door-capacity"
          >
            {t(lang, "landing.visionCapacity")}
          </Link>
        </div>
      </div>
    </main>
  );
}
