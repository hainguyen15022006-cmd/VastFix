import { hasLocale, NextIntlClientProvider } from "next-intl";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/shared/app-shell";
import { routing } from "@/i18n/routing";
import "../globals.css";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "Common" });
  return { title: t("metadataTitle"), description: t("metadataDescription") };
}

export default async function LocaleLayout({ children, params }: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  return <html lang={locale}><body><NextIntlClientProvider><AppShell>{children}</AppShell></NextIntlClientProvider></body></html>;
}
