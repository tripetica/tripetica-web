import "server-only";

import { getPool, query } from "@/lib/db/postgres";
import { isPartnerTab, PARTNER_TABS, type PartnerTab } from "@/lib/partner/access";

export async function listPartnerMenuDenials(partnerId: string): Promise<PartnerTab[]> {
  const result = await query<{ tab: string }>(
    `SELECT tab
       FROM partner_menu_denials
      WHERE partner_id = $1
      ORDER BY tab`,
    [partnerId],
  );
  return result.rows.map((row) => row.tab).filter(isPartnerTab);
}

export async function replacePartnerMenuDenials(partnerId: string, openTabs: readonly string[]) {
  const open = new Set(openTabs.filter(isPartnerTab));
  const denied = PARTNER_TABS.filter((tab) => !open.has(tab));
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const partner = await client.query<{ id: string }>(
      `SELECT id
         FROM partners
        WHERE id = $1
          AND deleted_at IS NULL`,
      [partnerId],
    );
    if (!partner.rows[0]) {
      await client.query("ROLLBACK");
      return { ok: false as const, error: "not-found" as const };
    }
    await client.query(`DELETE FROM partner_menu_denials WHERE partner_id = $1`, [partnerId]);
    for (const tab of denied) {
      await client.query(
        `INSERT INTO partner_menu_denials (partner_id, tab) VALUES ($1, $2)`,
        [partnerId, tab],
      );
    }
    await client.query("COMMIT");
    return { ok: true as const, denied };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
