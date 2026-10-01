import type { ReactNode } from "react";
import { type Locale } from "@/lib/i18n/config";
import { type OpsCopy } from "@/lib/ops/copy";
import { PartnerInfoForm } from "@/components/ops/partner-info-form";
import { type OpsPartnerDetail } from "@/lib/ops/partner-view";
import { type PartnerDriverRecord, type PartnerVehicleRecord } from "@/lib/partner/fleet-view";
import { type PartnerJobRecord } from "@/lib/partner/job-types";

type PartnerDetailProps = {
  authoritySection?: ReactNode;
  locale: Locale;
  copy: OpsCopy;
  partner: OpsPartnerDetail;
  canManage: boolean;
  primaryPartnerId: string | null;
  tab: "jobs" | "info" | "drivers" | "vehicles";
  drivers: PartnerDriverRecord[];
  vehicles: PartnerVehicleRecord[];
  jobs: PartnerJobRecord[];
};

export function PartnerDetail({
  authoritySection,
  locale,
  copy,
  partner,
  canManage,
  primaryPartnerId,
  tab,
  drivers,
  vehicles,
  jobs,
}: PartnerDetailProps) {
  return (
    <section className="ops-page ops-partner-detail">
      <PartnerInfoForm
        authoritySection={authoritySection}
        locale={locale}
        copy={copy}
        partner={partner}
        canManage={canManage}
        primaryPartnerId={primaryPartnerId}
        tab={tab}
        drivers={drivers}
        vehicles={vehicles}
        jobs={jobs}
      />
    </section>
  );
}
