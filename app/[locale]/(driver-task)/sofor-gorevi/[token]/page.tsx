import { notFound, permanentRedirect } from "next/navigation";
import { driverTaskPath } from "@/lib/ops/driver-task-stages";
import { isLocale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/path";

export const dynamic = "force-dynamic";

export default async function LegacyDriverTaskPage({
  params,
}: {
  params: Promise<{ locale: string; token: string }>;
}) {
  const { locale, token } = await params;
  if (!isLocale(locale)) {
    notFound();
  }
  permanentRedirect(localizedPath(locale, driverTaskPath(decodeURIComponent(token))));
}
