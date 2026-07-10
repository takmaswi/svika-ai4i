"use client";

// The watchdog card's flagged days with their bilingual narratives. The
// toggle switches narrative language on the card without leaving the app's
// chosen language, so an owner can read a flag both ways on the spot. The
// narratives are template text through the language adapter's mock twin and
// describe patterns, never a person (unit tested server side).
import { useState } from "react";

export interface WatchdogFlag {
  day: string;
  en: string;
  sn: string;
}

interface WatchdogNarrativesProps {
  flags: WatchdogFlag[];
  initial: "en" | "sn";
  englishLabel: string;
  shonaLabel: string;
}

export function WatchdogNarratives({
  flags,
  initial,
  englishLabel,
  shonaLabel,
}: WatchdogNarrativesProps) {
  const [lang, setLang] = useState<"en" | "sn">(initial);

  return (
    <div className="watchdog-flags">
      <div className="watchdog-lang lang-toggle" role="group">
        <button
          type="button"
          className={lang === "en" ? "lang-on" : ""}
          aria-pressed={lang === "en"}
          onClick={() => setLang("en")}
        >
          {englishLabel}
        </button>
        <button
          type="button"
          className={lang === "sn" ? "lang-on" : ""}
          aria-pressed={lang === "sn"}
          onClick={() => setLang("sn")}
        >
          {shonaLabel}
        </button>
      </div>
      {flags.map((d) => (
        <div key={d.day} className="watchdog-flag">
          <p className="svika-mono-code watchdog-day">{d.day}</p>
          <p className="svika-body watchdog-narrative">
            {lang === "sn" ? d.sn : d.en}
          </p>
        </div>
      ))}
    </div>
  );
}
