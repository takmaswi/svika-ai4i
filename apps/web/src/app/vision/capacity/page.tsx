import { getLang, t } from "@/lib/i18n";
import { LanguageToggle } from "@/components/LanguageToggle";
import { LiveMapLazy } from "@/components/map/LiveMapLazy";
import { StoryStage } from "@/components/story/StoryStage";
import { SimStamp } from "@/components/story/SimStamp";
import { CAPACITY_FIXTURES, capacityBadges } from "@/lib/vision/capacity-fixtures";

// Vision scene: kombi capacity on the corridor. Each simulated kombi wears
// the number its conductor declares; the card holds that number against what
// redeemed tickets and check ins prove, and drift is flagged as a pattern,
// never a person. Ships for real when vehicles stream data. Permanently
// stamped Simulation; nothing here reads or writes any account.
export default async function CapacityVisionPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const lang = await getLang();
  const params = await searchParams;
  const drifting = Object.values(CAPACITY_FIXTURES).filter(
    (c) => c.declared !== c.proven,
  );

  return (
    <StoryStage params={params} lang={lang}>
    <main className="home-screen" data-testid="vision-capacity">
      <div className="home-map">
        <LiveMapLazy
          labels={{
            ariaLabel: t(lang, "map.ariaLabel"),
            demoChip: t(lang, "map.demoChip"),
            unavailable: t(lang, "map.unavailable"),
          }}
          vehicleBadges={capacityBadges()}
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
        <p className="svika-meta tickets-heading">{t(lang, "vision.cap.heading")}</p>
        <div className="vision-cap-rows" data-testid="capacity-rows">
          <div className="vision-cap-row vision-cap-head">
            <span />
            <span className="svika-meta">{t(lang, "vision.cap.colDeclared")}</span>
            <span className="svika-meta">{t(lang, "vision.cap.colProven")}</span>
          </div>
          {Object.entries(CAPACITY_FIXTURES).map(([id, c]) => (
            <div key={id} className="vision-cap-row">
              <span className="plate-chip">{c.plate}</span>
              <span className="svika-mono-code">{c.declared}</span>
              <span className="svika-mono-code">{c.proven}</span>
            </div>
          ))}
        </div>
        <p className="svika-meta vision-honesty" data-testid="capacity-drift">
          {drifting.map((c) => c.plate).join(", ")} {t(lang, "vision.cap.drift")}
        </p>
      </section>
    </main>
    </StoryStage>
  );
}
