"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { Icon } from "./icon";

export function AppShell({ children }: { children: React.ReactNode }) {
  const t = useTranslations("Common");
  const locale = useLocale();
  const pathname = usePathname();
  return (
    <div className="vf-app">
      <a href="#main-content" className="vf-skip">{t("skip")}</a>
      <aside className="vf-sidebar">
        <Link className="vf-logo" href="/"><span className="vf-monogram" aria-hidden="true">V<span>F</span></span><span>{t("brand")}<small>{t("campus")}</small></span></Link>
        <p className="vf-nav-label">{t("workspace")}</p>
        <nav aria-label={t("navigation")} className="vf-nav">
          <Link href="/" aria-current={pathname === "/" ? "page" : undefined}><Icon name="home" />{t("home")}</Link>
          <Link href="/reports/new" aria-current={pathname.startsWith("/reports") ? "page" : undefined}><Icon name="pin" />{t("report")}</Link>
          <Link href="/manager/issues" aria-current={pathname.startsWith("/manager") ? "page" : undefined}><Icon name="inbox" />{t("queue")}</Link>
          <a href="/account"><Icon name="shield" />{t("account")}</a>
        </nav>
        <p className="vf-sidebar-note">{t("footer")}</p>
      </aside>
      <div className="vf-workspace">
        <header className="vf-topbar">
          <span className="vf-context"><span className="vf-context-dot" />{pathname.startsWith("/manager") ? t("managerArea") : t("campus")}</span>
          <nav className="vf-languages" aria-label={t("language")}>
            {(["vi", "en"] as const).map((value) => <Link key={value} href={pathname} locale={value} lang={value} hrefLang={value} aria-current={locale === value ? "true" : undefined} aria-label={value === "vi" ? "Tiếng Việt" : "English"}>{value.toUpperCase()}</Link>)}
          </nav>
        </header>
        <main id="main-content" tabIndex={-1} className="vf-main">{children}</main>
        <footer className="vf-footer"><span>{t("brand")} · {t("campus")}</span><span>{t("footer")}</span></footer>
      </div>
    </div>
  );
}
