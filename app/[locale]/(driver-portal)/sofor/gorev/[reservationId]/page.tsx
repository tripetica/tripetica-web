import { notFound, permanentRedirect } from "next/navigation";
import { driverPortalPath } from "@/lib/driver-portal/constants";
import { isLocale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/path";

export const dynamic = "force-dynamic";

export default async function LegacyDriverPortalTaskPage({
  params,
}: {
  params: Promise<{ locale: string; reservationId: string }>;
}) {
  const { locale, reservationId } = await params;
  if (!isLocale(locale)) {
    notFound();
  }
  permanentRedirect(localizedPath(locale, driverPortalPath(reservationId)));
}
