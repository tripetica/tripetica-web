import "server-only";

import { query } from "@/lib/db/postgres";
import { claimOpsPushEvent } from "@/lib/ops/push/dedupe";
import { buildProcessPushPayload } from "@/lib/ops/push/payload";
import { sendOpsPushToActiveSubscriptions } from "@/lib/ops/push/send";

type ProcessPushRow = {
  id: string;
  service_type: string | null;
  tour_code: string | null;
  selected_tour_code: string | null;
  selected_pickup_at: Date | null;
  applied_pickup_at: Date | null;
  selected_duration_hours: string | number | null;
  applied_duration_hours: string | number | null;
  selected_pickup_name_tr: string | null;
  selected_pickup_name_customer: string | null;
  applied_pickup_name_tr: string | null;
  applied_pickup_name_customer: string | null;
  selected_dropoff_name_tr: string | null;
  selected_dropoff_name_customer: string | null;
  applied_dropoff_name_tr: string | null;
  applied_dropoff_name_customer: string | null;
  selected_passenger_count: number | null;
  applied_passenger_count: number | null;
};

function asNumber(value: string | number | null | undefined): number | null {
  if (value == null || value === "") {
    return null;
  }
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

export async function notifyOpsProcessCreated(
  reservationSearchId: string,
): Promise<void> {
  try {
    const claimed = await claimOpsPushEvent("process_created", reservationSearchId);
    if (!claimed) {
      return;
    }
    const result = await query<ProcessPushRow>(
      `SELECT
         id,
         service_type,
         tour_code,
         selected_tour_code,
         selected_pickup_at,
         applied_pickup_at,
         selected_duration_hours,
         applied_duration_hours,
         selected_pickup_name_tr,
         selected_pickup_name_customer,
         applied_pickup_name_tr,
         applied_pickup_name_customer,
         selected_dropoff_name_tr,
         selected_dropoff_name_customer,
         applied_dropoff_name_tr,
         applied_dropoff_name_customer,
         selected_passenger_count,
         applied_passenger_count
       FROM reservation_searches
       WHERE id = $1`,
      [reservationSearchId],
    );
    const row = result.rows[0];
    if (!row) {
      return;
    }
    const payload = buildProcessPushPayload({
      id: row.id,
      serviceType: row.service_type,
      tourCode: row.tour_code ?? row.selected_tour_code,
      pickupAt: row.selected_pickup_at ?? row.applied_pickup_at,
      durationHours:
        asNumber(row.selected_duration_hours) ?? asNumber(row.applied_duration_hours),
      pickupNameTr: row.selected_pickup_name_tr ?? row.applied_pickup_name_tr,
      pickupNameCustomer:
        row.selected_pickup_name_customer ?? row.applied_pickup_name_customer,
      dropoffNameTr: row.selected_dropoff_name_tr ?? row.applied_dropoff_name_tr,
      dropoffNameCustomer:
        row.selected_dropoff_name_customer ?? row.applied_dropoff_name_customer,
      passengerCount: row.selected_passenger_count ?? row.applied_passenger_count,
    });
    await sendOpsPushToActiveSubscriptions(payload);
  } catch (error) {
    console.error("[ops-push] process notification failed", {
      reservationSearchId,
      error:
        error instanceof Error
          ? { name: error.name, message: error.message }
          : error,
    });
  }
}
