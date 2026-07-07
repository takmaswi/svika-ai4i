import type { Metadata } from "next";
import type { ReactNode } from "react";
import { cookies } from "next/headers";
import "@svika/ui/styles.css";
import "./globals.css";
import { getLang } from "@/lib/i18n";
import { parseTheme, THEME_COOKIE } from "@/lib/theme";

export const metadata: Metadata = {
  title: "Svika",
  description: "Digital ticketing and trip intelligence for Harare's kombis.",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const lang = await getLang();
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);
  return (
    <html lang={lang} {...(theme ? { "data-theme": theme } : {})}>
      <body className="svika-body-base">{children}</body>
    </html>
  );
}
