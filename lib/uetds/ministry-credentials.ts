import "server-only";

import { query } from "@/lib/db/postgres";
import { isUuid } from "@/lib/ops/process-filters";
import { unsealSecret } from "@/lib/security/sealed-secret";

import { resolveUetdsMinistryRuntime, type UetdsMinistryRuntime } from "@/lib/uetds/ministry-env";

export type UetdsMinistryCredentials = {
  username: string;
  password: string;
  env: UetdsMinistryRuntime;
};

export type UetdsTestCredentials = UetdsMinistryCredentials;

async function unsealCompanyPassword(username: string | null, sealed: string | null) {
  const user = username?.trim() ?? "";
  const secret = sealed?.trim() ?? "";
  if (!user || !secret) {
    return null;
  }
  try {
    const password = unsealSecret(secret);
    if (!password) {
      return null;
    }
    return { username: user, password };
  } catch {
    return null;
  }
}

export async function loadUetdsMinistryCredentials(
  companyId: string,
): Promise<UetdsMinistryCredentials | null> {
  const runtime = resolveUetdsMinistryRuntime();
  if (!runtime || !isUuid(companyId)) {
    return null;
  }
  const result = await query<{
    test_username: string | null;
    test_password_sealed: string | null;
    live_username: string | null;
    live_password_sealed: string | null;
  }>(
    `SELECT test_username, test_password_sealed, live_username, live_password_sealed
     FROM uetds_companies
     WHERE id = $1
     LIMIT 1`,
    [companyId],
  );
  const row = result.rows[0];
  if (!row) {
    return null;
  }
  if (runtime === "live") {
    const live = await unsealCompanyPassword(row.live_username, row.live_password_sealed);
    return live ? { ...live, env: "live" } : null;
  }
  const test = await unsealCompanyPassword(row.test_username, row.test_password_sealed);
  return test ? { ...test, env: "test" } : null;
}

export async function loadUetdsTestCredentials(
  companyId: string,
): Promise<UetdsTestCredentials | null> {
  const credentials = await loadUetdsMinistryCredentials(companyId);
  return credentials?.env === "test" ? credentials : null;
}

/**
 * LIVE ministry credentials regardless of current runtime.
 * Used only to verify Kamu portal (live) passenger in-place updates.
 * Does not change TEST-only create/submit routing in DEV.
 */
export async function loadUetdsLiveMinistryCredentials(
  companyId: string,
): Promise<UetdsMinistryCredentials | null> {
  if (!isUuid(companyId)) {
    return null;
  }
  const result = await query<{
    live_username: string | null;
    live_password_sealed: string | null;
  }>(
    `SELECT live_username, live_password_sealed
     FROM uetds_companies
     WHERE id = $1
     LIMIT 1`,
    [companyId],
  );
  const row = result.rows[0];
  if (!row) {
    return null;
  }
  const live = await unsealCompanyPassword(row.live_username, row.live_password_sealed);
  return live ? { ...live, env: "live" } : null;
}
