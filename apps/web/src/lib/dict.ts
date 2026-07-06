// Every rider-facing string lives here in English and Shona from the start. No
// hardcoded copy in components. Hwindi is the local word for conductor and is
// used deliberately. Keep entries short, second-person and concrete.
import type { AppLanguage } from "@svika/shared";

export const LANG_COOKIE = "svika_lang";

type Entry = { en: string; sn: string };

export const dict = {
  "brand.tagline": {
    en: "Ride Harare. Keep your change.",
    sn: "Famba muHarare. Chenji yako haichararasika.",
  },
  "nav.signIn": { en: "Sign in", sn: "Pinda" },

  "landing.headline": {
    en: "Digital tickets for Harare kombis.",
    sn: "Matikiti edijitari ekombi dzeHarare.",
  },
  "landing.sub": {
    en: "Plan a trip, board with a code, and stop losing your change.",
    sn: "Ronga rwendo, kwira nekodhi, urege kurasikirwa nechenji yako.",
  },
  "landing.cta": { en: "Get started", sn: "Tanga" },

  "login.title": { en: "Sign in to Svika", sn: "Pinda muSvika" },
  "login.phoneLabel": { en: "Phone number", sn: "Nhamba yefoni" },
  "login.send": { en: "Send code", sn: "Tumira kodhi" },
  "login.sending": { en: "Sending…", sn: "Kutumira…" },
  "login.codeLabel": {
    en: "Enter the 6-digit code",
    sn: "Isa kodhi yenhamba 6",
  },
  "login.verify": { en: "Verify", sn: "Simbisa" },
  "login.verifying": { en: "Verifying…", sn: "Kusimbisa…" },
  "login.resend": { en: "Send a new code", sn: "Tumira kodhi itsva" },
  "login.codeSentTo": { en: "We sent a code to", sn: "Tatumira kodhi ku" },
  "login.errPhone": {
    en: "Enter a valid phone number.",
    sn: "Isa nhamba yefoni chaiyo.",
  },
  "login.errCode": {
    en: "That code did not work. Try again.",
    sn: "Kodhi iyi haina kushanda. Edzazve.",
  },

  "app.welcome": { en: "Welcome", sn: "Mauya" },
  "app.roleLabel": { en: "Your role", sn: "Basa rako" },
  "app.phoneLabel": { en: "Phone", sn: "Foni" },
  "app.signOut": { en: "Sign out", sn: "Buda" },

  "role.rider": { en: "Rider", sn: "Mufambi" },
  "role.owner": { en: "Owner", sn: "Muridzi" },
  "role.conductor": { en: "Conductor", sn: "Hwindi" },
} as const satisfies Record<string, Entry>;

export type DictKey = keyof typeof dict;

export function t(lang: AppLanguage, key: DictKey): string {
  return dict[key][lang];
}
