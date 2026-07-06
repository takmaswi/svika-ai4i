import type { Metadata } from "next";
import type { ReactNode } from "react";
import "@svika/ui/styles.css";
import "./globals.css";
import { getLang } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "Svika",
  description: "Digital ticketing and trip intelligence for Harare's kombis.",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const lang = await getLang();
  return (
    <html lang={lang}>
      <body className="svika-body-base">{children}</body>
    </html>
  );
}
