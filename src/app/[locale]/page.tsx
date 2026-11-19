import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Icon } from "@/components/shared/icon";

export default async function Home() {
  const t = await getTranslations("Home");
  return (
    <div className="vf-home">
      <section className="vf-hero">
        <p className="vf-eyebrow">{t("eyebrow")}</p>
        <h1>{t("title")}</h1>
        <p className="vf-lead">{t("description")}</p>
      </section>
      <section className="vf-welcome-card">
        <span className="vf-icon-tile"><Icon name="inbox" /></span>
        <h2>{t("managerTitle")}</h2>
        <p>{t("managerDescription")}</p>
        <Link className="vf-button vf-primary" href="/manager/issues">{t("openQueue")}<Icon name="arrow" /></Link>
        <p className="vf-fine-print">{t("accessNote")}</p>
      </section>
      <aside className="vf-principle"><Icon name="shield" /><div><h2>{t("principleTitle")}</h2><p>{t("principleBody")}</p></div></aside>
    </div>
  );
}
