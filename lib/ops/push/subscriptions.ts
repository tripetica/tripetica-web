import "server-only";

import { isLocale, type Locale } from "@/lib/i18n/config";
import { query } from "@/lib/db/postgres";

export type OpsPushSubscriptionRecord = {
  id: string;
  ops_user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  locale: Locale;
};

function normalizeLocale(value: string | null | undefined): Locale {
  const locale = value?.trim();
  return locale && isLocale(locale) ? locale : "tr";
}

export async function upsertOpsPushSubscription(input: {
  opsUserId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  locale?: string | null;
  userAgent?: string | null;
}) {
  await query(
    `INSERT INTO ops_push_subscriptions (
       ops_user_id,
       endpoint,
       p256dh,
       auth,
       locale,
       user_agent,
       last_seen_at,
       disabled_at
     ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NULL)
     ON CONFLICT (endpoint) DO UPDATE
     SET ops_user_id = EXCLUDED.ops_user_id,
         p256dh = EXCLUDED.p256dh,
         auth = EXCLUDED.auth,
         locale = EXCLUDED.locale,
         user_agent = EXCLUDED.user_agent,
         last_seen_at = NOW(),
         disabled_at = NULL`,
    [
      input.opsUserId,
      input.endpoint,
      input.p256dh,
      input.auth,
      normalizeLocale(input.locale),
      input.userAgent?.slice(0, 400) ?? null,
    ],
  );
}

export async function disableOpsPushSubscription(endpoint: string) {
  await query(
    `UPDATE ops_push_subscriptions
     SET disabled_at = NOW()
     WHERE endpoint = $1
       AND disabled_at IS NULL`,
    [endpoint],
  );
}

export async function deleteOpsPushSubscription(opsUserId: string, endpoint: string) {
  await query(
    `UPDATE ops_push_subscriptions
     SET disabled_at = NOW()
     WHERE ops_user_id = $1
       AND endpoint = $2
       AND disabled_at IS NULL`,
    [opsUserId, endpoint],
  );
}

export async function listActiveOpsPushSubscriptions() {
  const result = await query<OpsPushSubscriptionRecord>(
    `SELECT id, ops_user_id, endpoint, p256dh, auth, locale
     FROM ops_push_subscriptions
     WHERE disabled_at IS NULL`,
  );
  return result.rows.map((row) => ({
    ...row,
    locale: normalizeLocale(row.locale),
  }));
}
