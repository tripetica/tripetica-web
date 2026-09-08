import "server-only";

import { isLocale, type Locale } from "@/lib/i18n/config";
import { query } from "@/lib/db/postgres";
import { partnerJobRank, type PartnerJobRank } from "@/lib/partner/job-visibility";

export type PartnerPushSubscriptionRecord = {
  id: string;
  partner_id: string;
  partner_user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  locale: Locale;
  is_primary_partner: boolean;
  rank: PartnerJobRank;
};

function normalizeLocale(value: string | null | undefined): Locale {
  const locale = value?.trim();
  return locale && isLocale(locale) ? locale : "tr";
}

export async function upsertPartnerPushSubscription(input: {
  partnerId: string;
  partnerUserId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  locale?: string | null;
  userAgent?: string | null;
}) {
  await query(
    `INSERT INTO partner_push_subscriptions (
       partner_id,
       partner_user_id,
       endpoint,
       p256dh,
       auth,
       locale,
       user_agent,
       updated_at,
       last_seen_at,
       disabled_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW(), NULL)
     ON CONFLICT (endpoint) DO UPDATE
     SET partner_id = EXCLUDED.partner_id,
         partner_user_id = EXCLUDED.partner_user_id,
         p256dh = EXCLUDED.p256dh,
         auth = EXCLUDED.auth,
         locale = EXCLUDED.locale,
         user_agent = EXCLUDED.user_agent,
         updated_at = NOW(),
         last_seen_at = NOW(),
         disabled_at = NULL`,
    [
      input.partnerId,
      input.partnerUserId,
      input.endpoint,
      input.p256dh,
      input.auth,
      normalizeLocale(input.locale),
      input.userAgent?.slice(0, 400) ?? null,
    ],
  );
}

export async function disablePartnerPushSubscription(endpoint: string) {
  await query(
    `UPDATE partner_push_subscriptions
     SET disabled_at = NOW(),
         updated_at = NOW()
     WHERE endpoint = $1
       AND disabled_at IS NULL`,
    [endpoint],
  );
}

export async function deletePartnerPushSubscription(
  partnerUserId: string,
  endpoint: string,
) {
  await query(
    `UPDATE partner_push_subscriptions
     SET disabled_at = NOW(),
         updated_at = NOW()
     WHERE partner_user_id = $1
       AND endpoint = $2
       AND disabled_at IS NULL`,
    [partnerUserId, endpoint],
  );
}

type SubscriptionRow = {
  id: string;
  partner_id: string;
  partner_user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  locale: string;
  is_primary_partner: boolean;
  priority_level: number | null;
};

export async function listActivePartnerPushSubscriptionsForRank(rank: PartnerJobRank) {
  const result = await query<SubscriptionRow>(
    `SELECT
        s.id,
        s.partner_id,
        s.partner_user_id,
        s.endpoint,
        s.p256dh,
        s.auth,
        s.locale,
        p.is_primary_partner,
        p.priority_level
     FROM partner_push_subscriptions s
     JOIN partner_users u ON u.id = s.partner_user_id
     JOIN partners p ON p.id = s.partner_id
     WHERE s.disabled_at IS NULL
       AND u.status = 'active'
       AND p.status = 'active'
       AND p.deleted_at IS NULL`,
  );
  return result.rows.flatMap((row) => {
    const mappedRank = partnerJobRank({
      isPrimaryPartner: row.is_primary_partner,
      priorityLevel: row.priority_level,
    });
    if (mappedRank !== rank) {
      return [];
    }
    return [
      {
        id: row.id,
        partner_id: row.partner_id,
        partner_user_id: row.partner_user_id,
        endpoint: row.endpoint,
        p256dh: row.p256dh,
        auth: row.auth,
        locale: normalizeLocale(row.locale),
        is_primary_partner: row.is_primary_partner,
        rank: mappedRank,
      } satisfies PartnerPushSubscriptionRecord,
    ];
  });
}
