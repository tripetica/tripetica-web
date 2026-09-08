import "server-only";

import { query } from "@/lib/db/postgres";
import { claimOpsPushEvent } from "@/lib/ops/push/dedupe";
import { buildVehicleApprovalPushPayload } from "@/lib/ops/push/payload";
import { sendOpsPushToActiveSubscriptions } from "@/lib/ops/push/send";

type VehiclePushRow = {
  id: string;
  plate: string;
  brand: string | null;
  model: string | null;
  status: string;
  partner_id: string;
  partner_name: string;
};

export async function notifyOpsVehicleApprovalRequested(
  vehicleId: string,
): Promise<void> {
  try {
    await query(
      `DELETE FROM ops_push_events
       WHERE event_type = 'partner_vehicle_approval_requested'
         AND source_id = $1`,
      [vehicleId],
    );
    const claimed = await claimOpsPushEvent(
      "partner_vehicle_approval_requested",
      vehicleId,
    );
    if (!claimed) {
      return;
    }
    const result = await query<VehiclePushRow>(
      `SELECT
          v.id,
          v.plate,
          v.brand,
          v.model,
          v.status,
          p.id AS partner_id,
          p.name AS partner_name
       FROM partner_vehicles v
       JOIN partners p ON p.id = v.partner_id
       WHERE v.id = $1
         AND v.deleted_at IS NULL
         AND p.deleted_at IS NULL`,
      [vehicleId],
    );
    const row = result.rows[0];
    if (!row || row.status !== "pending_approval") {
      return;
    }
    await sendOpsPushToActiveSubscriptions(
      buildVehicleApprovalPushPayload({
        id: row.id,
        plate: row.plate,
        brand: row.brand,
        model: row.model,
        partnerId: row.partner_id,
        partnerName: row.partner_name,
      }),
    );
  } catch (error) {
    console.error("[ops-push] vehicle approval notification failed", {
      vehicleId,
      error:
        error instanceof Error
          ? { name: error.name, message: error.message }
          : error,
    });
  }
}
