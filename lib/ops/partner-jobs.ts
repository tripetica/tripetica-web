import "server-only";

import { type Locale } from "@/lib/i18n/config";
import { type PartnerJobRecord } from "@/lib/partner/job-types";
import { listAcceptedPartnerJobs } from "@/lib/partner/jobs";

export type OpsPartnerJobRecord = PartnerJobRecord;

export async function listOpsPartnerAcceptedJobs(
  partnerId: string,
  locale: Locale,
): Promise<OpsPartnerJobRecord[]> {
  return listAcceptedPartnerJobs({
    partnerId,
    userId: "",
    isPrimaryPartner: false,
    locale,
  });
}
