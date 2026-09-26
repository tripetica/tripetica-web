import "server-only";
import { getPool, query } from "@/lib/db/postgres";
import { isUuid } from "@/lib/ops/process-filters";
import { resolveUetdsMinistryRuntime } from "@/lib/uetds/ministry-env";
import { loadUetdsMinistryCredentials } from "@/lib/uetds/ministry-credentials";
import { queryUetdsTestBildirimOzeti } from "@/lib/uetds/ministry-ozet";

export type UetdsDeleteScope = { actorType: "ops" | "partner"; partnerId: string | null };
export type UetdsDeleteReason = "deleted" | "still-valid" | "unverified" | "unavailable";
export type UetdsDeleteResult = { id: string; reason: UetdsDeleteReason };
type Row = { id: string; status: string; company_id: string | null; ministry_env: string; ministry_reference: string | null };
const rowSql = `SELECT id, status, company_id, ministry_env, ministry_reference FROM uetds_notifications
 WHERE id = $1 AND ($2::uuid IS NULL OR partner_id = $2)`;
function authorizedInput(id: string, scope: UetdsDeleteScope) {
  return isUuid(id) && (scope.actorType === "ops" || isUuid(scope.partnerId ?? ""));
}
async function ministryCancellation(row: Row): Promise<UetdsDeleteReason> {
  const runtime = resolveUetdsMinistryRuntime();
  if (!runtime || runtime !== row.ministry_env || !row.ministry_reference || !row.company_id || row.status !== "cancelled") return "unverified";
  const credentials = await loadUetdsMinistryCredentials(row.company_id);
  if (!credentials || credentials.env !== runtime) return "unverified";
  const summary = await queryUetdsTestBildirimOzeti({ ...credentials, seferReferansNo: row.ministry_reference });
  if (summary.sonucKodu !== 0 || (summary.seferReference && summary.seferReference !== row.ministry_reference)) return "unverified";
  if (summary.seferStatusCode === 0 && summary.seferStatus?.trim().toLocaleUpperCase("tr-TR") === "GEÇERLİ") return "still-valid";
  return summary.seferStatusCode === 1 && summary.seferStatus?.trim().toLocaleUpperCase("tr-TR") === "İPTAL" ? "deleted" : "unverified";
}
/** Used after the existing cancel action; this function sends no mutations. */
export async function isUetdsCancellationConfirmed(id: string, scope: UetdsDeleteScope) {
  if (!authorizedInput(id, scope)) return false;
  try {
    const result = await query<Row>(rowSql, [id, scope.actorType === "partner" ? scope.partnerId : null]);
    return Boolean(result.rows[0] && await ministryCancellation(result.rows[0]) === "deleted");
  } catch { return false; }
}
async function deleteOne(id: string, scope: UetdsDeleteScope): Promise<UetdsDeleteResult> {
  if (!authorizedInput(id, scope)) return { id, reason: "unavailable" };
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await client.query<Row>(`${rowSql} FOR UPDATE`, [id, scope.actorType === "partner" ? scope.partnerId : null]);
    const row = result.rows[0];
    if (!row) { await client.query("ROLLBACK"); return { id, reason: "unavailable" }; }
    const reason = await ministryCancellation(row);
    if (reason !== "deleted") { await client.query("ROLLBACK"); return { id, reason }; }
    // Revisions cascade via FK; all group/personnel/passenger/stage/verification data lives in this snapshot.
    // Reservations, fleet, companies and partners are parent records and are never deleted.
    const deleted = await client.query(`DELETE FROM uetds_notifications WHERE id = $1 AND status = 'cancelled' RETURNING id`, [id]);
    if (deleted.rowCount !== 1) throw new Error("delete_conflict");
    await client.query("COMMIT");
    return { id, reason: "deleted" };
  } catch {
    await client.query("ROLLBACK").catch(() => undefined);
    return { id, reason: "unverified" };
  } finally { client.release(); }
}
export async function deleteCancelledUetdsNotifications(ids: string[], scope: UetdsDeleteScope): Promise<UetdsDeleteResult[]> {
  const unique = [...new Set(ids)].slice(0, 100);
  const results: UetdsDeleteResult[] = [];
  for (let offset = 0; offset < unique.length; offset += 3) {
    results.push(...await Promise.all(unique.slice(offset, offset + 3).map(id => deleteOne(id, scope).catch(() => ({ id, reason: "unverified" as const })))));
  }
  return results;
}
