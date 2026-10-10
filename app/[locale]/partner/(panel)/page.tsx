import { notFound, redirect } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/path";
import { firstPartnerTabPath } from "@/lib/partner/access";
import { getPartnerActor } from "@/lib/partner/session";

export const dynamic = "force-dynamic";

export default async function PartnerPanelIndexPage({
  params,
}: PageProps<"/[locale]/partner">) {
  const { locale } = await params;
  if (!isLocale(locale)) {
    notFound();
  }
  const actor = await getPartnerActor();
  redirect(localizedPath(locale, actor ? firstPartnerTabPath(actor) : "/partner/login"));
}
