import Link from "next/link";
import { getLang } from "@/lib/i18n";
import { LoginForm } from "@/components/LoginForm";
import { LanguageToggle } from "@/components/LanguageToggle";

export default async function LoginPage() {
  const lang = await getLang();
  return (
    <main className="auth">
      <header className="auth-top">
        <Link href="/">
          <img className="wordmark" src="/wordmark.svg" alt="Svika" height={24} />
        </Link>
        <LanguageToggle lang={lang} />
      </header>
      <LoginForm lang={lang} />
    </main>
  );
}
