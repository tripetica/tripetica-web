import "server-only";

import { query } from "@/lib/db/postgres";
import { isUuid } from "@/lib/ops/process-filters";

/**
 * Ministry UNET / live_username values allowed to use Kamu portal in-place
 * passenger update (DEV allowlist). Default is SEARCH TRAVEL's firm id.
 * Override with UETDS_KAMU_PASSENGER_UPDATE_UNET_IDS=1046786,….
 * Matching uses DB live_username (ministry firm id), never short_name hardcoding.
 */
export function kamuPassengerUpdateUnetAllowlist(
  env: Record<string, string | undefined> = process.env,
) {
  const raw = env.UETDS_KAMU_PASSENGER_UPDATE_UNET_IDS?.trim() || "1046786";
  return new Set(
    raw
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
  );
}

export async function companyUsesKamuPassengerUpdate(companyId: string): Promise<boolean> {
  if (!isUuid(companyId)) {
    return false;
  }
  const allow = kamuPassengerUpdateUnetAllowlist();
  if (allow.size === 0) {
    return false;
  }
  const result = await query<{ live_username: string | null }>(
    `SELECT live_username FROM uetds_companies WHERE id = $1 LIMIT 1`,
    [companyId],
  );
  const liveUsername = result.rows[0]?.live_username?.trim() ?? "";
  return Boolean(liveUsername && allow.has(liveUsername));
}
