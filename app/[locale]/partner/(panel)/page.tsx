import { notFound, redirect } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/path";

export const dynamic = "force-dynamic";

export default async function PartnerPanelIndexPage({
  params,
}: PageProps<"/[locale]/partner">) {
  const { locale } = await params;
  if (!isLocale(locale)) {
    notFound();
  }
  redirect(localizedPath(locale, "/partner/jobs"));
}
