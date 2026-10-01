import "server-only";
import { query } from "@/lib/db/postgres";

/** Display only; never authorizes or invokes an AI/portal update. Unknown status fails closed. */
export async function notificationHasGoldDriver(notificationId: string, partnerId: string): Promise<boolean> {
  try {
    const result = await query<{ membership_status: string }>(
      `SELECT d.membership_status FROM uetds_notifications n
       JOIN partner_drivers d ON d.id = n.driver_id AND d.partner_id = n.partner_id
       WHERE n.id = $1 AND n.partner_id = $2 AND d.deleted_at IS NULL`,
      [notificationId, partnerId],
    );
    return result.rows[0]?.membership_status === "gold";
  } catch {
    return false;
  }
}
