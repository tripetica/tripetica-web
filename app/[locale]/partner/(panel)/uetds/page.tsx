import { notFound, redirect } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/path";
import { requirePartnerPage } from "@/lib/partner/auth";

export const dynamic = "force-dynamic";

export default async function PartnerUetdsIndexPage({
  params,
}: PageProps<"/[locale]/partner/uetds">) {
  const { locale } = await params;
  if (!isLocale(locale)) {
    notFound();
  }
  await requirePartnerPage(locale);
  redirect(localizedPath(locale, "/partner/uetds/notifications/new"));
}
