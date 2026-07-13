"use client";
import { useRouter } from "next/navigation";
import type { AppLanguage } from "@svika/shared";
import { LANG_COOKIE, LIVE_LANGUAGES, t } from "@/lib/dict";

// Sets the language cookie and re-renders. Server components read the cookie, so
// the whole app switches language, not just this widget. Only the live languages
// (English and Shona) are selectable; Ndebele shows as an honest, disabled
// "coming soon" chip so riders from the Ndebele speaking south see they are
// included, without claiming a translation that does not exist yet.
export function LanguageToggle({ lang }: { lang: AppLanguage }) {
  const router = useRouter();
  function choose(next: AppLanguage) {
    document.cookie = `${LANG_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  }
  const comingSoon = `${t(lang, "lang.ndebele")}, ${t(lang, "lang.comingSoon")}`;
  return (
    <div className="lang-toggle" role="group" aria-label="Language">
      {LIVE_LANGUAGES.map((code) => (
        <button
          key={code}
          type="button"
          aria-pressed={lang === code}
          className={lang === code ? "lang-on" : "lang-off"}
          onClick={() => choose(code)}
        >
          {code.toUpperCase()}
        </button>
      ))}
      <button
        type="button"
        className="lang-soon"
        disabled
        aria-disabled="true"
        aria-label={comingSoon}
        title={comingSoon}
        data-testid="lang-ndebele"
      >
        ND<span className="lang-soon-tag">{t(lang, "lang.comingSoon")}</span>
      </button>
    </div>
  );
}
