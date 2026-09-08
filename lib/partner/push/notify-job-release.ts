import "server-only";

import { query } from "@/lib/db/postgres";
import { parseOpsAmount, selectedStoredAmount } from "@/lib/ops/money";
import { partnerCopy } from "@/lib/partner/copy";
import { formatPartnerMoney, partnerPayoutAmount } from "@/lib/partner/job-payout";
import {
  effectiveVisibleMaxRank,
  type PartnerJobRank,
} from "@/lib/partner/job-visibility";
import { claimPartnerPushEvent } from "@/lib/partner/push/dedupe";
import { buildPartnerJobPushPayload } from "@/lib/partner/push/payload";
import { sendPartnerPushToSubscriptions } from "@/lib/partner/push/send";
import { listActivePartnerPushSubscriptionsForRank } from "@/lib/partner/push/subscriptions";

type JobPushRow = {
  id: string;
  pickup_at: Date;
  created_at: Date;
  service_type: string | null;
  tour_code: string | null;
  pickup_name_customer: string | null;
  pickup_name_tr: string | null;
  dropoff_name_customer: string | null;
  dropoff_name_tr: string | null;
  duration_hours: string | null;
  bursa_route: string | null;
  total_price: string | null;
  currency: string | null;
  price_manually_overridden: boolean | null;
  manual_price_totals: unknown;
  accepted_partner_id: string | null;
  status: string;
  deleted_at: Date | null;
};

const JOB_PUSH_SELECT = `
  id, pickup_at, created_at, service_type, tour_code,
  pickup_name_customer, pickup_name_tr, dropoff_name_customer, dropoff_name_tr,
  duration_hours::text, bursa_route, total_price::text, currency,
  price_manually_overridden, manual_price_totals,
  accepted_partner_id, status, deleted_at
`;

function payoutLabel(row: JobPushRow, isPrimaryPartner: boolean, locale: string) {
  const stored = selectedStoredAmount({
    currency: row.currency,
    totalPrice: row.total_price,
    priceManuallyOverridden: Boolean(row.price_manually_overridden),
    manualPriceTotals: row.manual_price_totals as never,
  });
  const total = parseOpsAmount(stored.amount);
  const payout = partnerPayoutAmount({ total, isPrimaryPartner });
  return formatPartnerMoney(payout, stored.currency, locale);
}

function releasedRanks(maxRank: PartnerJobRank): PartnerJobRank[] {
  const ranks: PartnerJobRank[] = [0];
  if (maxRank >= 1) ranks.push(1);
  if (maxRank >= 2) ranks.push(2);
  if (maxRank >= 3) ranks.push(3);
  return ranks;
}

async function loadOpenJob(reservationId: string): Promise<JobPushRow | null> {
  const result = await query<JobPushRow>(
    `SELECT ${JOB_PUSH_SELECT}
     FROM reservations
     WHERE id = $1`,
    [reservationId],
  );
  return result.rows[0] ?? null;
}

function isPushableOpenJob(row: JobPushRow, now: Date) {
  return (
    !row.deleted_at &&
    row.status === "confirmed" &&
    row.accepted_partner_id == null &&
    row.pickup_at.getTime() >= now.getTime()
  );
}

async function releaseRank(row: JobPushRow, rank: PartnerJobRank) {
  if (row.accepted_partner_id) {
    return;
  }
  const claimed = await claimPartnerPushEvent(row.id, rank);
  if (!claimed) {
    return;
  }
  const fresh = await loadOpenJob(row.id);
  if (!fresh || !isPushableOpenJob(fresh, new Date())) {
    return;
  }
  const subscriptions = await listActivePartnerPushSubscriptionsForRank(rank);
  if (subscriptions.length === 0) {
    return;
  }
  await sendPartnerPushToSubscriptions(subscriptions, (subscription) => {
    const copy = partnerCopy[subscription.locale];
    return buildPartnerJobPushPayload({
      reservationId: fresh.id,
      locale: subscription.locale,
      title: copy.pushJobTitle,
      payoutTitle: copy.jobPayout,
      payoutLabel: payoutLabel(fresh, subscription.is_primary_partner, subscription.locale),
      serviceType: fresh.service_type,
      tourCode: fresh.tour_code,
      pickupAt: fresh.pickup_at,
      pickupNameCustomer: fresh.pickup_name_customer,
      pickupNameTr: fresh.pickup_name_tr,
      dropoffNameCustomer: fresh.dropoff_name_customer,
      dropoffNameTr: fresh.dropoff_name_tr,
      durationHours: fresh.duration_hours,
      bursaRoute: fresh.bursa_route,
    });
  });
}

export async function notifyPartnerJobVisibility(reservationId: string, now = new Date()) {
  try {
    const row = await loadOpenJob(reservationId);
    if (!row || !isPushableOpenJob(row, now)) {
      return;
    }
    const maxRank = effectiveVisibleMaxRank({
      now,
      pickupAt: row.pickup_at,
      createdAt: row.created_at,
    });
    for (const rank of releasedRanks(maxRank)) {
      await releaseRank(row, rank);
    }
  } catch (error) {
    console.error("[partner-push] job visibility notification failed", {
      reservationId,
      error:
        error instanceof Error
          ? { name: error.name, message: error.message }
          : error,
    });
  }
}

export async function dispatchDuePartnerJobPushes(now = new Date()) {
  try {
    const result = await query<JobPushRow>(
      `SELECT ${JOB_PUSH_SELECT}
       FROM reservations
       WHERE deleted_at IS NULL
         AND status = 'confirmed'
         AND accepted_partner_id IS NULL
         AND pickup_at >= $1
       ORDER BY created_at ASC`,
      [now],
    );
    for (const row of result.rows) {
      await notifyPartnerJobVisibility(row.id, now);
    }
  } catch (error) {
    console.error("[partner-push] due dispatch failed", {
      error:
        error instanceof Error
          ? { name: error.name, message: error.message }
          : error,
    });
  }
}
