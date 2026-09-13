import type { ReactNode } from "react";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { OpsShell } from "@/components/ops/shell";
import { asPanelLocale, isLocale } from "@/lib/i18n/config";
import { requireOpsPage } from "@/lib/ops/auth";
import { opsCopy } from "@/lib/ops/copy";
import { loadOpsFxSummary } from "@/lib/ops/fx-summary";

export const dynamic = "force-dynamic";

export default async function OpsPanelLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) {
    notFound();
  }
  const actor = await requireOpsPage(locale);
  const copy = opsCopy[asPanelLocale(locale)];
  const headerList = await headers();
  const pathname = headerList.get("x-ops-pathname") ?? "";
  const pathWithoutLocale = pathname.replace(/^\/(tr|en|ru)/, "") || "/ops";
  const fxSummary = await loadOpsFxSummary();

  return (
    <OpsShell
      locale={locale}
      copy={copy}
      actor={actor}
      pathWithoutLocale={pathWithoutLocale}
      fxSummary={fxSummary}
    >
      {children}
    </OpsShell>
  );
}
