import { classifyUetdsListItem, filterUetdsList, parseUetdsListFilters, uetdsTripTimestamp, type UetdsListFilters } from "@/lib/uetds/list-policy";
import "server-only";

import { query } from "@/lib/db/postgres";
import { isUuid } from "@/lib/ops/process-filters";
import { foldUetdsSearchPlate, formatUetdsSnapshotDateTime } from "@/lib/uetds/edit-policy";
import {
  type UetdsNotificationDetail,
  type UetdsNotificationListItem,
} from "@/lib/uetds/notification-view";

export type { UetdsNotificationDetail, UetdsNotificationListItem };

type ListRow = {
  id: string;
  created_at: Date;
  partner_id: string;
  reservation_id: string | null;
  source: string;
  status: string;
  company_id: string | null;
  company_short_name: string;
  ministry_env: string;
  ministry_reference: string | null;
  snapshot: unknown;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function mapItem(row: ListRow): UetdsNotificationListItem {
  const snapshot = asRecord(row.snapshot);
  const trip = asRecord(snapshot?.trip);
  const verification = asRecord(asRecord(snapshot?.ministry)?.finalVerification);
  const driver = asRecord(snapshot?.driver);
  const vehicle = asRecord(snapshot?.vehicle);
  const passengers = Array.isArray(snapshot?.passengers) ? snapshot.passengers : [];
  const firstPassenger = asRecord(passengers[0]);
  const origin = text(trip?.origin);
  const destination = text(trip?.destination);
  return {
    id: row.id,
    createdAt: row.created_at.toISOString(),
    partnerId: row.partner_id,
    startTimestamp: uetdsTripTimestamp(text(trip?.startDate), text(trip?.startTime)),
    endTimestamp: uetdsTripTimestamp(text(trip?.endDate), text(trip?.endTime)),
    startLabel: formatUetdsSnapshotDateTime(text(trip?.startDate), text(trip?.startTime)) || "—",
    endLabel: formatUetdsSnapshotDateTime(text(trip?.endDate), text(trip?.endTime)) || "—",
    routeLabel: [origin, destination].filter(Boolean).join(" → ") || "—",
    plate: text(vehicle?.plate) || "—",
    driverName: text(driver?.fullName) || "—",
    passengerName: [text(firstPassenger?.firstName), text(firstPassenger?.lastName)]
      .filter(Boolean)
      .join(" ") || "—",
    companyShortName: row.company_short_name,
    status: row.status,
    finalVerificationResult: row.status === "submitted" && verification?.result === "verified" ? "verified" : row.status === "partial" && verification?.result === "final-verification-failed" ? "final-verification-failed" : null,
    ministryReference: row.ministry_reference,
  };
}

const LIST_SQL = `SELECT id, created_at, partner_id, reservation_id, source, status, company_id, company_short_name, ministry_env, ministry_reference, snapshot
     FROM uetds_notifications
     WHERE ($1::uuid IS NULL OR partner_id = $1)
       AND (
         $2 = ''
         OR COALESCE(ministry_reference, '') ILIKE '%' || $2 || '%'
         OR COALESCE(snapshot->'driver'->>'fullName', '') ILIKE '%' || $2 || '%'
         OR COALESCE(snapshot->'trip'->>'origin', '') ILIKE '%' || $2 || '%'
         OR COALESCE(snapshot->'trip'->>'destination', '') ILIKE '%' || $2 || '%'
         OR regexp_replace(COALESCE(snapshot->'vehicle'->>'plate', ''), '[^A-Za-z0-9]', '', 'g') ILIKE '%' || $3 || '%'
         OR regexp_replace(COALESCE(snapshot->'vehicle'->>'ministryPlate', ''), '[^A-Za-z0-9]', '', 'g') ILIKE '%' || $3 || '%'
       )
     ORDER BY
       NULLIF(snapshot->'trip'->>'startDate', '') DESC NULLS LAST,
       NULLIF(snapshot->'trip'->>'startTime', '') DESC NULLS LAST,
       created_at DESC,
       id DESC
`;

export async function listUetdsNotifications(input: {
  partnerId?: string | null;
  query?: string;
  filters?: UetdsListFilters;
}): Promise<UetdsNotificationListItem[]> {
  if (input.partnerId && !isUuid(input.partnerId)) {
    return [];
  }
  const raw = input.query?.trim() ?? "";
  const result = await query<ListRow>(LIST_SQL, [
    input.partnerId ?? null,
    raw,
    foldUetdsSearchPlate(raw),
  ]);
  const now = Date.now();
  return filterUetdsList(result.rows.map(mapItem), input.filters ?? parseUetdsListFilters(), now).map(item => ({ ...item, listClassification: classifyUetdsListItem(item, now) }));
}

export async function getUetdsNotification(input: {
  id: string;
  partnerId?: string | null;
}): Promise<UetdsNotificationDetail | null> {
  if (!isUuid(input.id) || (input.partnerId && !isUuid(input.partnerId))) {
    return null;
  }
  const result = await query<ListRow>(
    `SELECT id, created_at, partner_id, reservation_id, source, status, company_id, company_short_name, ministry_env, ministry_reference, snapshot
     FROM uetds_notifications
     WHERE id = $1
       AND ($2::uuid IS NULL OR partner_id = $2)
     LIMIT 1`,
    [input.id, input.partnerId ?? null],
  );
  const row = result.rows[0];
  if (!row) {
    return null;
  }
  return {
    ...mapItem(row),
    snapshotJson: JSON.stringify(row.snapshot ?? {}),
    reservationId: row.reservation_id,
    source: row.source,
    companyId: row.company_id,
    ministryEnv: row.ministry_env,
  };
}
