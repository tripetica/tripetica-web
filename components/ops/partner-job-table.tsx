import { localizedPath } from "@/lib/i18n/path";
import { type Locale } from "@/lib/i18n/config";
import { formatOpsDateTime } from "@/lib/ops/format";
import { type OpsCopy } from "@/lib/ops/copy";
import { type PartnerJobRecord } from "@/lib/partner/job-types";

type PartnerJobTableProps = {
  locale: Locale;
  copy: OpsCopy;
  jobs: PartnerJobRecord[];
  emptyLabel?: string;
};

export function PartnerJobTable({ locale, copy, jobs, emptyLabel }: PartnerJobTableProps) {
  if (jobs.length === 0) {
    return <p className="ops-empty">{emptyLabel ?? copy.emptyPartnerJobs}</p>;
  }
  return (
    <div className="ops-table-wrap ops-partner-fleet-table">
      <table className="ops-table">
        <thead>
          <tr>
            <th>{copy.driverRowIndex}</th>
            <th>{copy.partnerJobCode}</th>
            <th>{copy.partnerJobWhen}</th>
            <th>{copy.partnerJobService}</th>
            <th>{copy.partnerJobRoute}</th>
            <th>{copy.partnerJobPayout}</th>
            <th>{copy.partnerJobCollect}</th>
            <th>{copy.details}</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((job, index) => (
            <tr key={job.id}>
              <td>{index + 1}</td>
              <td>{job.reservationCode ?? "—"}</td>
              <td>{formatOpsDateTime(job.pickupAt, locale)}</td>
              <td>{job.serviceLabel}</td>
              <td>
                {[job.pickupName || "—", job.dropoffName || "—"].join(" → ")}
              </td>
              <td>{job.payoutLabel}</td>
              <td>{job.collectLabel ?? "—"}</td>
              <td>
                <a
                  className="ops-row-detail"
                  href={localizedPath(locale, `/ops/reservations/${job.id}`)}
                >
                  {copy.details}
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
