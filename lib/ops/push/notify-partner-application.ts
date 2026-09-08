import "server-only";

import { query } from "@/lib/db/postgres";
import { claimOpsPushEvent } from "@/lib/ops/push/dedupe";
import { buildPartnerApplicationPushPayload } from "@/lib/ops/push/payload";
import { sendOpsPushToActiveSubscriptions } from "@/lib/ops/push/send";

type PartnerPushRow = {
  id: string;
  name: string;
  contact_first_name: string | null;
  contact_last_name: string | null;
  is_primary_partner: boolean;
  status: string;
};

export async function notifyOpsPartnerApplicationCreated(
  partnerId: string,
): Promise<void> {
  try {
    const claimed = await claimOpsPushEvent(
      "partner_application_created",
      partnerId,
    );
    if (!claimed) {
      return;
    }
    const result = await query<PartnerPushRow>(
      `SELECT id, name, contact_first_name, contact_last_name, is_primary_partner, status
       FROM partners
       WHERE id = $1`,
      [partnerId],
    );
    const row = result.rows[0];
    if (!row || row.is_primary_partner || row.status !== "pending") {
      return;
    }
    await sendOpsPushToActiveSubscriptions(
      buildPartnerApplicationPushPayload({
        id: row.id,
        name: row.name,
        contactFirstName: row.contact_first_name,
        contactLastName: row.contact_last_name,
      }),
    );
  } catch (error) {
    console.error("[ops-push] partner application notification failed", {
      partnerId,
      error:
        error instanceof Error
          ? { name: error.name, message: error.message }
          : error,
    });
  }
}
