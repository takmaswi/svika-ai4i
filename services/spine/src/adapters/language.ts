// The language adapter for owner facing watchdog narratives. Per the AI
// usage map the production target is an LLM writing the bilingual audit
// narrative; this is its mock twin: pregenerated templates, filled offline,
// so no live vendor ever sits in the demo path. Providers swap behind
// getNarrator exactly like getSpines.
//
// Product law, enforced by unit test: explanations describe patterns (a
// route, a day, an unnamed vehicle) and can never name or point at a person.
// The input type carries no person field, the templates accept only the
// whitelisted placeholders below, and the template text is screened for
// person words in both languages.

export interface Bilingual {
  en: string;
  sn: string;
}

export type DeviationKind = "tickets_low" | "peak_missing" | "one_vehicle_low" | "pattern";

export interface AnomalyDeviation {
  kind: DeviationKind;
  /** How far off usual, in whole percent. */
  pct: number;
}

/** Everything the narrator is allowed to know. No person fields exist. */
export interface AnomalyExplanationInput {
  routeCode: string;
  day: string;
  /** Strongest deviation first; empty means a combined pattern flag. */
  deviations: AnomalyDeviation[];
}

export interface AnomalyNarrator {
  readonly provider: string;
  explain(input: AnomalyExplanationInput): Bilingual;
}

export const ALLOWED_PLACEHOLDERS = ["route", "day", "pct"] as const;

// Shona strings are machine drafted placeholders pending an external
// translator pass; the English is the reviewed source of truth.
export const EXPLANATION_TEMPLATES: Record<DeviationKind, Bilingual> = {
  tickets_low: {
    en: "Fares recorded on {route} for {day} came in about {pct} percent below the usual level for that kind of day.",
    sn: "Mari yakanyorwa pa{route} musi wa {day} yakadzika nezvikamu zvingangoita {pct} pane zvakajairika pazuva rakadaro.",
  },
  peak_missing: {
    en: "Rush hour fares on {route} for {day} are thinner than usual. The morning and evening peaks do not match the rest of the day.",
    sn: "Mari yenguva dzekumhanyirwa pa{route} musi wa {day} ishoma pane zvakajairika. Mangwanani nemanheru hazvienderani nerimwe zuva rose.",
  },
  one_vehicle_low: {
    en: "One vehicle on {route} recorded far fewer fares than its own usual level on {day}. Worth checking that day's cash count.",
    sn: "Imwe kombi pa{route} yakanyora mari shoma zvakanyanya pane zvayakajairika musi wa {day}. Zvakanaka kutarisa mari yezuva iroro.",
  },
  pattern: {
    en: "The mix of fares on {route} for {day} does not match the usual pattern for that kind of day.",
    sn: "Mafambiro emari pa{route} musi wa {day} haana kufanana nezvakajairika pazuva rakadaro.",
  },
};

function render(template: string, input: AnomalyExplanationInput, pct: number): string {
  return template
    .replaceAll("{route}", input.routeCode)
    .replaceAll("{day}", input.day)
    .replaceAll("{pct}", String(pct));
}

export const templateNarrator: AnomalyNarrator = {
  provider: "template",
  explain(input: AnomalyExplanationInput): Bilingual {
    const strongest = input.deviations[0] ?? { kind: "pattern" as const, pct: 0 };
    const template = EXPLANATION_TEMPLATES[strongest.kind];
    return {
      en: render(template.en, input, strongest.pct),
      sn: render(template.sn, input, strongest.pct),
    };
  },
};

/** Provider selection, mock twin fallback, same shape as getSpines. */
export function getNarrator(
  provider = process.env.AI_PROVIDER ?? "template",
): AnomalyNarrator {
  switch (provider) {
    case "template":
    default:
      return templateNarrator;
  }
}
