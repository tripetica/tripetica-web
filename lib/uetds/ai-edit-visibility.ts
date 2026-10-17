import "server-only";
import { query } from "@/lib/db/postgres";

/** Display only; never authorizes or invokes an AI/portal update. Unknown status fails closed. */
export async function notificationHasGoldDriver(notificationId: string, partnerId: string): Promise<boolean> {
  try {
    const result = await query<{ service_advanced_enabled: boolean }>(
      `SELECT v.service_advanced_enabled FROM uetds_notifications n
       JOIN partner_vehicles v ON v.id = n.vehicle_id AND v.partner_id = n.partner_id
       WHERE n.id = $1 AND n.partner_id = $2 AND v.deleted_at IS NULL`,
      [notificationId, partnerId],
    );
    return result.rows[0]?.service_advanced_enabled === true;
  } catch {
    return false;
  }
}
