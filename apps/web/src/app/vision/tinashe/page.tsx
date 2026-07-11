import Link from "next/link";
import { getLang, t } from "@/lib/i18n";
import { LanguageToggle } from "@/components/LanguageToggle";
import { LiveMapLazy } from "@/components/map/LiveMapLazy";
import { StoryStage } from "@/components/story/StoryStage";
import { SimStamp } from "@/components/story/SimStamp";
import { BackIcon } from "@/components/icons";

// Vision scene: the crash flow, Tinashe's story. Public, read only, and
// permanently stamped Simulation: nothing here detects anything today and
// nothing writes anywhere. The one thing that is live in the product is the
// profile's emergency details (Phase C); the responder view mirrors that
// screen's exact field grammar with the demo persona's fixture values,
// because the real table is RLS locked and a public page must never read it.
const TINASHE = {
  plate: "AEH 6647",
  near: "Copacabana",
  kinName: "Amai Moyo",
  kinPhone: "+263 77 234 5678",
  aidName: "PSMAS",
  aidNumber: "PS 448812",
  shareLink: "svika.app/share/8f3k92",
} as const;

type View = "alert" | "kin" | "responder";

export default async function TinasheVisionPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const lang = await getLang();
  const params = await searchParams;
  const view: View =
    params.view === "kin" || params.view === "responder" ? params.view : "alert";

  if (view === "alert") {
    return (
      <StoryStage params={params} lang={lang}>
      <main className="home-screen" data-testid="vision-tinashe" data-view={view}>
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
          <span className="home-chips-right">
            <SimStamp label={t(lang, "vision.stamp")} />
            <span className="home-chip svika-glass">
              <LanguageToggle lang={lang} />
            </span>
          </span>
        </header>
        <section className="vision-sheet svika-glass-strong">
          <div className="vision-alert-card">
            <p className="vision-alert-title">{t(lang, "vision.tin.alertH")}</p>
            <p className="vision-alert-line">
              <span className="plate-chip vision-alert-plate">{TINASHE.plate}</span>
              {t(lang, "vision.tin.alertNear")} {TINASHE.near}
            </p>
          </div>
          <p className="svika-body vision-sheet-note">
            {t(lang, "vision.tin.alertSent")}
          </p>
        </section>
      </main>
      </StoryStage>
    );
  }

  return (
    <StoryStage params={params} lang={lang}>
    <main className="shell" data-testid="vision-tinashe" data-view={view}>
      <header className="shell-top">
        <Link href="/" className="back-btn" aria-label={t(lang, "common.back")}>
          <BackIcon />
        </Link>
        <span className="home-chips-right">
          <SimStamp label={t(lang, "vision.stamp")} />
          <LanguageToggle lang={lang} />
        </span>
      </header>

      {view === "kin" ? (
        <section className="feature-card vision-phone svika-animate-fade-up">
          <p className="feature-label">{t(lang, "vision.tin.kinPhone")}</p>
          <div className="vision-sms">
            <p className="vision-sms-body">
              {t(lang, "vision.tin.kinMsg")}{" "}
              <span className="svika-mono-code vision-sms-link">
                {TINASHE.shareLink}
              </span>
            </p>
            <p className="vision-sms-meta">{t(lang, "vision.tin.kinFrom")}</p>
          </div>
        </section>
      ) : (
        <section className="svika-card wallet-panel svika-animate-fade-up">
          <h1 className="svika-title">{t(lang, "profile.emergencyH")}</h1>
          <p className="svika-body">{t(lang, "vision.tin.responderWhy")}</p>
          <dl className="yourdata-list" data-testid="vision-responder-details">
            <div className="yourdata-row">
              <dt className="svika-meta">{t(lang, "profile.kinName")}</dt>
              <dd className="svika-body">{TINASHE.kinName}</dd>
            </div>
            <div className="yourdata-row">
              <dt className="svika-meta">{t(lang, "profile.kinPhone")}</dt>
              <dd className="svika-mono-code">{TINASHE.kinPhone}</dd>
            </div>
            <div className="yourdata-row">
              <dt className="svika-meta">{t(lang, "profile.aidName")}</dt>
              <dd className="svika-body">{TINASHE.aidName}</dd>
            </div>
            <div className="yourdata-row">
              <dt className="svika-meta">{t(lang, "profile.aidNumber")}</dt>
              <dd className="svika-mono-code">{TINASHE.aidNumber}</dd>
            </div>
          </dl>
          <p className="svika-meta vision-honesty">
            {t(lang, "vision.tin.responderNote")}
          </p>
        </section>
      )}
    </main>
    </StoryStage>
  );
}
