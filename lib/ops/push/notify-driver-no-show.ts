import "server-only";

import { query } from "@/lib/db/postgres";
import { formatIstanbulClock } from "@/lib/ops/flight-tracking";
import { loadDriverNoShowReport } from "@/lib/ops/driver-no-show";
import { claimOpsPushEvent } from "@/lib/ops/push/dedupe";
import {
  RESERVATION_PUSH_BADGE,
  RESERVATION_PUSH_ICON,
  type OpsPushPayload,
} from "@/lib/ops/push/payload";
import { sendOpsPushToActiveSubscriptions } from "@/lib/ops/push/send";

const NO_SHOW_PUSH_TITLE = "🔴 Şoför No Show bildirimi";

export function buildDriverNoShowPushPayload(input: {
  reservationId: string;
  reservationCode: string | null;
  driverName: string | null;
  arrivedAt: string | null;
  reportedAt: string;
  flightCode: string | null;
  estimatedArrival: string | null;
  actualArrival: string | null;
  localePath?: string;
}): OpsPushPayload {
  const localePath = input.localePath ?? "tr";
  const body = [
    input.reservationCode ? `Rezervasyon: ${input.reservationCode}` : null,
    input.driverName ? `Şoför: ${input.driverName}` : null,
    input.arrivedAt
      ? `VARDIM: ${formatIstanbulClock(input.arrivedAt) ?? input.arrivedAt}`
      : null,
    `Bildirim: ${formatIstanbulClock(input.reportedAt) ?? input.reportedAt}`,
    input.flightCode ? `Uçuş: ${input.flightCode}` : null,
    input.estimatedArrival
      ? `Tahmini: ${formatIstanbulClock(input.estimatedArrival)}`
      : null,
    input.actualArrival
      ? `İniş: ${formatIstanbulClock(input.actualArrival)}`
      : null,
  ]
    .filter((line): line is string => Boolean(line?.trim()))
    .join("\n");
  return {
    kind: "reservation",
    title: NO_SHOW_PUSH_TITLE,
    body,
    icon: RESERVATION_PUSH_ICON,
    badge: RESERVATION_PUSH_BADGE,
    tag: `driver-no-show:${input.reservationId}`,
    url: `/${localePath}/ops/reservations/${input.reservationId}`,
    requireInteraction: true,
  };
}

export async function notifyOpsDriverNoShowReported(
  reservationId: string,
): Promise<void> {
  try {
    const claimed = await claimOpsPushEvent("driver_no_show_reported", reservationId);
    if (!claimed) {
      return;
    }
    const report = await loadDriverNoShowReport(reservationId);
    const reservation = await query<{ reservation_code: string | null }>(
      `SELECT reservation_code FROM reservations WHERE id = $1 LIMIT 1`,
      [reservationId],
    );
    await sendOpsPushToActiveSubscriptions(
      buildDriverNoShowPushPayload({
        reservationId,
        reservationCode: reservation.rows[0]?.reservation_code ?? null,
        driverName: report?.driverName ?? null,
        arrivedAt: report?.arrivedAt ?? null,
        reportedAt: report?.reportedAt ?? new Date().toISOString(),
        flightCode: report?.flightCode ?? null,
        estimatedArrival: report?.flightTracking?.estimatedArrival ?? null,
        actualArrival: report?.flightTracking?.actualArrival ?? null,
      }),
    );
  } catch (error) {
    console.error("[ops-push] driver no-show notification failed", {
      reservationId,
      error:
        error instanceof Error
          ? { name: error.name, message: error.message }
          : error,
    });
  }
}
