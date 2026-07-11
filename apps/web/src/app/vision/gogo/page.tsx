import Link from "next/link";
import { getLang, t } from "@/lib/i18n";
import { LanguageToggle } from "@/components/LanguageToggle";
import { StoryStage } from "@/components/story/StoryStage";
import { SimStamp } from "@/components/story/SimStamp";
import { FeaturePhone } from "@/components/vision/FeaturePhone";
import { BackIcon } from "@/components/icons";
import { gogoKombiEta } from "@/lib/vision/gogo-eta";
import { USSD_CODE } from "@/lib/ussd/machine";

// Vision scene: Gogo on her mbudzi. The keypad works and the menus are real
// tested code (lib/ussd, unit tests beside it); what waits is a telco
// aggregator agreement, which is a contract, not a build. Money menus run
// fixture twins that touch nothing; the "how far" menu calls the real eta
// wiring through a read only server action. Permanently stamped Simulation.
export default async function GogoVisionPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const lang = await getLang();
  const params = await searchParams;

  return (
    <StoryStage params={params} lang={lang}>
    <main className="shell" data-testid="vision-gogo">
      <header className="shell-top">
        <Link href="/" className="back-btn" aria-label={t(lang, "common.back")}>
          <BackIcon />
        </Link>
        <span className="home-chips-right">
          <SimStamp label={t(lang, "vision.stamp")} />
          <LanguageToggle lang={lang} />
        </span>
      </header>

      <FeaturePhone
        etaAction={gogoKombiEta}
        labels={{
          menu: [
            t(lang, "vision.gogo.menu1"),
            t(lang, "vision.gogo.menu2"),
            t(lang, "vision.gogo.menu3"),
            t(lang, "vision.gogo.menu4"),
          ],
          invalid: t(lang, "vision.gogo.invalid"),
          claimPrompt: t(lang, "vision.gogo.claimPrompt"),
          balance: t(lang, "vision.gogo.balance"),
          booked: t(lang, "vision.gogo.booked"),
          bookedCode: t(lang, "vision.gogo.bookedCode"),
          eta: t(lang, "vision.gogo.eta"),
          etaDemo: t(lang, "vision.gogo.etaDemo"),
          claimed: t(lang, "vision.gogo.claimed"),
          claimRejected: t(lang, "vision.gogo.claimRejected"),
          unavailable: t(lang, "vision.gogo.unavailable"),
          idleHint: `${t(lang, "vision.gogo.idleHint")} ${USSD_CODE}`,
          endedHint: `${t(lang, "vision.gogo.endedHint")} ${USSD_CODE}`,
          waiting: t(lang, "vision.gogo.waiting"),
          keyOk: t(lang, "vision.gogo.keyOk"),
          keyClear: t(lang, "vision.gogo.keyClear"),
        }}
      />

      <section className="svika-card wallet-panel vision-honesty-card">
        <p className="svika-body">{t(lang, "vision.gogo.note")}</p>
      </section>
    </main>
    </StoryStage>
  );
}
