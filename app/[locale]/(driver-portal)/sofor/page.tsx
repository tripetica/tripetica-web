import { notFound, permanentRedirect } from "next/navigation";
import { DRIVER_PORTAL_PATH } from "@/lib/driver-portal/constants";
import { isLocale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/path";

export const dynamic = "force-dynamic";

export default async function LegacyDriverPortalPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) {
    notFound();
  }
  permanentRedirect(localizedPath(locale, DRIVER_PORTAL_PATH));
}
