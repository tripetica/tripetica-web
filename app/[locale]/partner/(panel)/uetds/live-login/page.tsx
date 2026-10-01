import { notFound } from "next/navigation";
import { LunaLiveLoginScreen } from "@/components/uetds/luna-live-login-screen";
import { asPanelLocale, isLocale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/path";
import { requirePartnerPage } from "@/lib/partner/auth";
import { readLiveBridgeMeta } from "@/lib/uetds/kamu-login-live-bridge";

export const dynamic = "force-dynamic";

export default async function PartnerLiveLoginPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const actor = await requirePartnerPage(locale);
  const live = readLiveBridgeMeta();
  if (!live || live.partnerId !== actor.partnerId) notFound();
  return (
    <LunaLiveLoginScreen
      locale={asPanelLocale(locale)}
      notificationId={live.notificationId}
      authorityId={live.authorityId}
      listHref={localizedPath(locale, "/partner/uetds/notifications")}
    />
  );
}
