import "server-only";

import { query } from "@/lib/db/postgres";
import {
  TRANSFER_PRICING_SERVICE_TYPE,
  TRANSFER_PRICING_V1,
  type TransferPricingRules,
} from "@/lib/booking/pricing/transfer-pricing";

function isRules(value: unknown): value is TransferPricingRules {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const rules = value as TransferPricingRules;
  return (
    Array.isArray(rules.openingFees) &&
    Array.isArray(rules.distanceBands) &&
    Array.isArray(rules.regionFees) &&
    Array.isArray(rules.districtFees) &&
    Array.isArray(rules.timeSurcharges)
  );
}

export async function loadActiveTransferPricingRules(): Promise<TransferPricingRules> {
  try {
    const result = await query<{ version: string; rules: unknown }>(
      `SELECT version, rules
       FROM transfer_pricing_rules
       WHERE service_type = $1
         AND is_active = TRUE
       ORDER BY created_at DESC
       LIMIT 1`,
      [TRANSFER_PRICING_SERVICE_TYPE],
    );
    const row = result.rows[0];
    if (row && isRules(row.rules)) {
      return { ...row.rules, version: row.version };
    }
  } catch (error) {
    console.error("[Tripetica transfer-pricing] load rules", error);
  }
  return TRANSFER_PRICING_V1;
}
