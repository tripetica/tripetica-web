import { notFound } from "next/navigation";
import { LunaLiveLoginScreen } from "@/components/uetds/luna-live-login-screen";
import { asPanelLocale, isLocale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/path";
import { requireOpsPage } from "@/lib/ops/auth";
import { readLiveBridgeMeta } from "@/lib/uetds/kamu-login-live-bridge";

export const dynamic = "force-dynamic";

export default async function OpsLiveLoginPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  await requireOpsPage(locale, "uetds.manage");
  const live = readLiveBridgeMeta();
  if (!live) notFound();
  return (
    <LunaLiveLoginScreen
      locale={asPanelLocale(locale)}
      notificationId={live.notificationId}
      authorityId={live.authorityId}
      listHref={localizedPath(locale, "/ops/uetds/notifications")}
    />
  );
}
