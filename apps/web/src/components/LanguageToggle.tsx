"use client";
import { useRouter } from "next/navigation";
import type { AppLanguage } from "@svika/shared";
import { LANG_COOKIE } from "@/lib/dict";

// Sets the language cookie and re-renders. Server components read the cookie, so
// the whole app switches language, not just this widget.
export function LanguageToggle({ lang }: { lang: AppLanguage }) {
  const router = useRouter();
  function choose(next: AppLanguage) {
    document.cookie = `${LANG_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  }
  return (
    <div className="lang-toggle" role="group" aria-label="Language">
      {(["en", "sn"] as const).map((code) => (
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
    </div>
  );
}
