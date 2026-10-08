import "server-only";

import { query } from "@/lib/db/postgres";
import { type GpsLowBatteryAlert } from "@/lib/gps/ingest";
import { sendPartnerPushToSubscriptions } from "@/lib/partner/push/send";
import { listActivePartnerPushSubscriptionsForPartner } from "@/lib/partner/push/subscriptions";

export async function notifyPartnerLowBattery(alert: GpsLowBatteryAlert) {
  const subscriptions = await listActivePartnerPushSubscriptionsForPartner(alert.partnerId);
  const label = alert.plate?.trim() || alert.deviceCode;
  const percent = alert.batteryPercent;
  const result = await sendPartnerPushToSubscriptions(subscriptions, (subscription) => {
    const locale = subscription.locale;
    const title = percent === null
      ? (locale === "en" ? "Tripetica — Low battery" : locale === "ru" ? "Tripetica — Низкий заряд" : "Tripetica — Düşük batarya")
      : (locale === "en"
        ? `Tripetica — Low battery (${percent}%)`
        : locale === "ru"
          ? `Tripetica — Низкий заряд (${percent}%)`
          : `Tripetica — Düşük batarya (%${percent})`);
    const body = locale === "en"
      ? `Wi-Fi sharing and camera on ${label} will switch to energy saving within 10 minutes. GPS tracking continues.`
      : locale === "ru"
        ? `Раздача Wi-Fi и камера ${label} перейдут в энергосбережение в течение 10 минут. GPS-слежение продолжится.`
        : `${label} cihazının Wi-Fi paylaşımı ve kamera özellikleri 10 dakika içinde enerji tasarrufuna geçecek. GPS takibi devam edecek.`;
    return {
      kind: "partner-low-battery",
      title,
      body,
      icon: "/icon.png",
      badge: "/icon.png",
      tag: `gps-low-battery-${alert.deviceId}-${alert.episodeAt}`,
      url: `/${locale}/partner/gps/${alert.deviceId}`,
      requireInteraction: true,
    };
  });
  if (result.skipped || (result.sent === 0 && result.failed > 0)) {
    await query(
      `DELETE FROM gps_low_battery_pushes WHERE device_id = $1 AND episode_at = $2`,
      [alert.deviceId, alert.episodeAt],
    );
  }
  return result;
}
