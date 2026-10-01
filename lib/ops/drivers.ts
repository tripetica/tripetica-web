import "server-only";

import { query } from "@/lib/db/postgres";
import { type OpsDriverListFilters } from "@/lib/ops/driver-filters";
import { buildOpsDriverListQueryPlan } from "@/lib/ops/driver-list-query";
import { normalizePartnerDriverLanguageCodes } from "@/lib/partner/driver-languages";
import { type UetdsCompanyRef } from "@/lib/ops/uetds-company-fields";
import {
  mapUetdsCompanyLink,
  partnerDriverFullName,
  type PartnerDriverRecord,
  type PartnerFleetStatus,
} from "@/lib/partner/fleet-view";
import {
  isDriverMembershipStatus,
  type DriverMembershipStatus,
} from "@/lib/ops/driver-membership";
import {
  istanbulSubscriptionPeriodKey,
  mapUetdsSubscriptionListSummary,
  type UetdsDriverSubscriptionListSummary,
} from "@/lib/uetds/driver-subscription";
import { listFleetChoicesForPartners, type FleetChoicesByPartner } from "@/lib/partner/fleet-pairing";

export const OPS_DRIVERS_PAGE_SIZE = 25;

export type OpsDriverListItem = {
  id: string;
  fullName: string;
  phone: string | null;
  languageCodes: string[];
  status: PartnerFleetStatus;
  membershipStatus: DriverMembershipStatus;
  partnerId: string;
  partnerName: string;
  partnerCode: string;
  uetdsCompanyId: string | null;
  uetdsCompany: UetdsCompanyRef | null;
  defaultVehicleId: string | null;
  defaultAuthorityId: string | null;
  uetdsSubscription: UetdsDriverSubscriptionListSummary;
};

export type OpsDriverRecord = PartnerDriverRecord & {
  partnerName: string;
  partnerCode: string;
};

type DriverListRow = {
  id: string;
  partner_id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  languages: string[] | null;
  status: PartnerFleetStatus;
  partner_name: string;
  partner_code: string;
  uetds_company_id: string | null;
  uetds_company_short_name: string | null;
  uetds_subscription_enrolled_at: Date | null;
  uetds_subscription_monthly_fee: string | null;
  uetds_subscription_currency: string | null;
  current_period_status: string | null;
  next_period_status: string | null;
  membership_status: string | null;
  default_vehicle_id: string | null;
  default_authority_id: string | null;
};

type DriverDetailRow = {
  id: string;
  partner_id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  languages: string[] | null;
  status: PartnerFleetStatus;
  partner_name: string;
  partner_code: string;
  uetds_company_id: string | null;
  uetds_company_short_name: string | null;
  national_id: string | null;
  phone_country_code: string | null;
  email: string | null;
  deleted_at: Date | null;
  updated_at: Date;
};

function mapListItem(row: DriverListRow): OpsDriverListItem {
  return {
    id: row.id,
    fullName: partnerDriverFullName(row.first_name, row.last_name),
    phone: row.phone,
    languageCodes: normalizePartnerDriverLanguageCodes(row.languages ?? []),
    status: row.status,
    membershipStatus: isDriverMembershipStatus(row.membership_status)
      ? row.membership_status
      : "standard",
    partnerId: row.partner_id,
    partnerName: row.partner_name,
    partnerCode: row.partner_code,
    ...mapUetdsCompanyLink(row.uetds_company_id, row.uetds_company_short_name),
    defaultVehicleId: row.default_vehicle_id,
    defaultAuthorityId: row.default_authority_id,
    uetdsSubscription: mapUetdsSubscriptionListSummary({
      enrolledAt: row.uetds_subscription_enrolled_at,
      monthlyFee: row.uetds_subscription_monthly_fee,
      currency: row.uetds_subscription_currency,
      currentPeriodStatus: row.current_period_status,
      nextPeriodStatus: row.next_period_status,
    }),
  };
}

export async function listOpsDrivers(input: {
  query: string;
  dir: OpsDriverListFilters["dir"];
  page: number;
  pageSize?: number;
}) {
  const pageSize = input.pageSize ?? OPS_DRIVERS_PAGE_SIZE;
  const period = istanbulSubscriptionPeriodKey();
  const plan = buildOpsDriverListQueryPlan({
    query: input.query,
    dir: input.dir,
    page: input.page,
    pageSize,
    period,
  });
  const count = await query<{ count: string }>(plan.count.sql, plan.count.values);
  const total = Number(count.rows[0]?.count ?? 0);
  const page = Math.max(1, input.page);
  const result = await query<DriverListRow>(plan.list.sql, plan.list.values);
  const items = result.rows.map(mapListItem);
  const fleetChoices = await listFleetChoicesForPartners(items.map((item) => item.partnerId));
  return { items, total, page, pageSize, fleetChoices };
}

export type { FleetChoicesByPartner };

export async function getOpsDriver(driverId: string): Promise<OpsDriverRecord | null> {
  const result = await query<DriverDetailRow>(
    `SELECT
        d.id,
        d.partner_id,
        d.first_name,
        d.last_name,
        d.national_id,
        d.phone,
        d.phone_country_code,
        d.email,
        d.languages,
        d.status,
        d.deleted_at,
        d.updated_at,
        d.uetds_company_id,
        uc.short_name AS uetds_company_short_name,
        p.name AS partner_name,
        p.partner_code
     FROM partner_drivers d
     JOIN partners p ON p.id = d.partner_id
     LEFT JOIN uetds_companies uc ON uc.id = d.uetds_company_id
     WHERE d.id = $1
       AND d.deleted_at IS NULL
       AND p.deleted_at IS NULL
     LIMIT 1`,
    [driverId],
  );
  const row = result.rows[0];
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    partnerId: row.partner_id,
    firstName: row.first_name,
    lastName: row.last_name,
    fullName: partnerDriverFullName(row.first_name, row.last_name),
    nationalId: row.national_id,
    phone: row.phone,
    phoneCountryCode: row.phone_country_code,
    email: row.email,
    languageCodes: normalizePartnerDriverLanguageCodes(row.languages ?? []),
    status: row.status,
    deletedAt: row.deleted_at?.toISOString() ?? null,
    updatedAt: row.updated_at.toISOString(),
    partnerName: row.partner_name,
    partnerCode: row.partner_code,
    ...mapUetdsCompanyLink(row.uetds_company_id, row.uetds_company_short_name),
  };
}
