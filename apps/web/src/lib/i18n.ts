import { cookies } from "next/headers";
import type { AppLanguage } from "@svika/shared";
import { LANG_COOKIE } from "./dict";

/** Read the viewer's language from the cookie; English is the default. */
export async function getLang(): Promise<AppLanguage> {
  const store = await cookies();
  return store.get(LANG_COOKIE)?.value === "sn" ? "sn" : "en";
}

export { t, dict, LANG_COOKIE, type DictKey } from "./dict";
