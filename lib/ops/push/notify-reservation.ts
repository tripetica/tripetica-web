import "server-only";

import { query } from "@/lib/db/postgres";
import { claimOpsPushEvent } from "@/lib/ops/push/dedupe";
import { buildReservationPushPayload } from "@/lib/ops/push/payload";
import { sendOpsPushToActiveSubscriptions } from "@/lib/ops/push/send";

type ReservationPushRow = {
  id: string;
  reservation_code: string | null;
  service_type: string | null;
  tour_code: string | null;
  pickup_at: Date | null;
  duration_hours: string | number | null;
  vehicle_code: string | null;
  vehicle_label_tr: string | null;
  pickup_name_tr: string | null;
  pickup_name_customer: string | null;
  dropoff_name_tr: string | null;
  dropoff_name_customer: string | null;
  passenger_count: number | null;
  total_price: string | number | null;
  currency: string | null;
  status: string;
  deleted_at: Date | null;
};

function asNumber(value: string | number | null | undefined): number | null {
  if (value == null || value === "") {
    return null;
  }
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

export async function notifyOpsReservationConfirmed(
  reservationId: string,
): Promise<void> {
  try {
    const result = await query<ReservationPushRow>(
      `SELECT
         id,
         reservation_code,
         service_type,
         tour_code,
         pickup_at,
         duration_hours,
         vehicle_code,
         vehicle_label_tr,
         pickup_name_tr,
         pickup_name_customer,
         dropoff_name_tr,
         dropoff_name_customer,
         passenger_count,
         total_price,
         currency,
         status,
         deleted_at
       FROM reservations
       WHERE id = $1`,
      [reservationId],
    );
    const row = result.rows[0];
    if (!row || row.deleted_at || row.status !== "confirmed") {
      return;
    }
    const claimed = await claimOpsPushEvent("reservation_confirmed", reservationId);
    if (!claimed) {
      return;
    }
    const payload = buildReservationPushPayload({
      id: row.id,
      reservationCode: row.reservation_code,
      serviceType: row.service_type,
      tourCode: row.tour_code,
      pickupAt: row.pickup_at,
      durationHours: asNumber(row.duration_hours),
      vehicleCode: row.vehicle_code,
      vehicleLabelTr: row.vehicle_label_tr,
      pickupNameTr: row.pickup_name_tr,
      pickupNameCustomer: row.pickup_name_customer,
      dropoffNameTr: row.dropoff_name_tr,
      dropoffNameCustomer: row.dropoff_name_customer,
      passengerCount: row.passenger_count,
      totalPrice: row.total_price,
      currency: row.currency,
    });
    await sendOpsPushToActiveSubscriptions(payload);
  } catch (error) {
    console.error("[ops-push] reservation notification failed", {
      reservationId,
      error:
        error instanceof Error
          ? { name: error.name, message: error.message }
          : error,
    });
  }
}
