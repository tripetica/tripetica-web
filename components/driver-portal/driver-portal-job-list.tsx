import { driverPortalPath } from "@/lib/driver-portal/constants";
import { driverPortalCopy } from "@/lib/driver-portal/copy";
import { type DriverPortalJobRow } from "@/lib/driver-portal/jobs-view";
import { type Locale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/path";

function JobCard({ locale, job }: { locale: Locale; job: DriverPortalJobRow }) {
  return (
    <article className="driver-portal-job">
      <p className="driver-portal-job-time">{job.pickupAtLabel}</p>
      <p className="driver-portal-job-service">{job.serviceLabel}</p>
      <p className="driver-portal-job-place">{job.pickupName || "—"}</p>
      {job.dropoffName ? (
        <p className="driver-portal-job-place">→ {job.dropoffName}</p>
      ) : null}
      <p className="driver-portal-job-status">
        {driverPortalCopy.statusPrefix}: {job.stageLabel}
      </p>
      <a
        className="driver-task-action driver-portal-detail"
        href={localizedPath(locale, driverPortalPath(job.reservationId))}
      >
        {driverPortalCopy.detail}
      </a>
    </article>
  );
}

export function DriverPortalJobList({
  locale,
  jobs,
}: {
  locale: Locale;
  jobs: DriverPortalJobRow[];
}) {
  if (jobs.length === 0) {
    return <p className="driver-portal-empty">{driverPortalCopy.emptyJobs}</p>;
  }
  return (
    <div className="driver-portal-jobs">
      <section>
        <h2>{driverPortalCopy.upcoming}</h2>
        {jobs.map((job) => (
          <JobCard key={job.reservationId} locale={locale} job={job} />
        ))}
      </section>
    </div>
  );
}
