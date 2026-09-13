"use client";

import { useActionState, useMemo, useState } from "react";
import { OpsConfirmDialog } from "@/components/ops/ops-confirm-dialog";
import { PartnerRefreshButton } from "@/components/partner/refresh-button";
import { localizedPath } from "@/lib/i18n/path";
import { type Locale } from "@/lib/i18n/config";
import { formatOpsDateTime } from "@/lib/ops/format";
import { type PartnerCopy } from "@/lib/partner/copy";
import { type PartnerDriverRecord, type PartnerVehicleRecord } from "@/lib/partner/fleet-view";
import {
  partnerAcceptJobAction,
  type PartnerJobFormState,
} from "@/lib/partner/job-actions";
import {
  emptyDriverAssignment,
  emptyVehicleAssignment,
} from "@/lib/partner/job-assignment-view";
import {
  filterPartnerJobs,
  partnerJobDurationLabel,
  partnerJobNeedsBabySeat,
  partnerJobOccupancyCompact,
  sortPartnerJobs,
  type PartnerJobSort,
} from "@/lib/partner/job-view";
import { type PartnerJobRecord } from "@/lib/partner/job-types";
import {
  JobDriverAssignmentCell,
  JobVehicleAssignmentCell,
} from "@/components/partner/job-assignment-cell";

type PartnerJobListProps = {
  locale: Locale;
  copy: PartnerCopy;
  jobs: PartnerJobRecord[];
  mode: "open" | "accepted";
  justClaimed?: boolean;
  isPrimaryPartner?: boolean;
  drivers?: PartnerDriverRecord[];
  vehicles?: PartnerVehicleRecord[];
  emptyLabel?: string;
};

export function PartnerJobList({
  locale,
  copy,
  jobs,
  mode,
  justClaimed = false,
  isPrimaryPartner = false,
  drivers = [],
  vehicles = [],
  emptyLabel,
}: PartnerJobListProps) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<PartnerJobSort>("newest");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [state, action, pending] = useActionState<PartnerJobFormState, FormData>(
    partnerAcceptJobAction,
    { error: null, ok: false },
  );
  const visible = useMemo(
    () => sortPartnerJobs(filterPartnerJobs(jobs, query), mode === "open" ? sort : "newest"),
    [jobs, query, sort, mode],
  );
  const title = mode === "open" ? copy.jobs : copy.accepted;
  const empty = mode === "open" ? copy.jobEmpty : (emptyLabel ?? copy.jobAcceptedEmpty);
  const searchEmpty = mode === "open" ? copy.jobSearchEmpty : copy.jobAcceptedSearchEmpty;
  const detailBase = mode === "open" ? "/partner/jobs" : "/partner/accepted";

  return (
    <>
      <div className="ops-page-head partner-drivers-head partner-jobs-head">
        <h1>{title}</h1>
        <input
          type="search"
          className="partner-drivers-search"
          value={query}
          placeholder={copy.jobSearchPlaceholder}
          aria-label={copy.jobSearchPlaceholder}
          onChange={(event) => setQuery(event.target.value)}
        />
        {mode === "open" ? (
          <div className="partner-jobs-toolbar">
            <PartnerRefreshButton
              label={copy.jobRefresh}
              busyLabel={copy.jobRefreshing}
              className="partner-jobs-refresh"
            />
            <button
              type="button"
              className="ops-btn-secondary partner-jobs-sort"
              onClick={() => setSort((current) => (current === "newest" ? "service" : "newest"))}
            >
              {sort === "newest" ? copy.jobSortByService : copy.jobSortByNewest}
            </button>
          </div>
        ) : null}
      </div>
      {justClaimed ? (
        <p className="ops-form-ok partner-drivers-success" role="status">
          {copy.jobAcceptedOk}
        </p>
      ) : null}
      {state.error ? (
        <p className="ops-form-error" role="alert">
          {state.error === "already-taken"
            ? copy.jobAlreadyTaken
            : state.error === "not-visible"
              ? copy.jobNotVisible
              : copy.jobAcceptFailed}
        </p>
      ) : null}
      {jobs.length === 0 ? (
        <p className="partner-empty-lead">{empty}</p>
      ) : visible.length === 0 ? (
        <p className="partner-empty-lead">{searchEmpty}</p>
      ) : (
        <div className="ops-table-wrap partner-jobs-table">
          <table className="ops-table">
            <thead>
              <tr>
                <th className="partner-job-num">#</th>
                {mode === "accepted" ? (
                  <th className="partner-job-code">{copy.jobReservationCode}</th>
                ) : null}
                <th className="partner-job-when">{copy.jobDateTime}</th>
                <th className="partner-job-service">{copy.jobService}</th>
                <th className="partner-job-pickup">{copy.jobPickup}</th>
                <th className="partner-job-dropoff">{copy.jobDropoff}</th>
                <th className="partner-job-duration">{copy.jobDuration}</th>
                <th className="partner-job-occupancy">{copy.jobOccupancy}</th>
                <th className="partner-job-payout">{copy.jobPayout}</th>
                {mode === "accepted" ? (
                  <>
                    <th className="partner-job-assign partner-job-assign-driver">
                      {copy.jobAssignedDriver}
                    </th>
                    <th className="partner-job-assign partner-job-assign-vehicle">
                      {copy.jobAssignedVehicle}
                    </th>
                  </>
                ) : null}
                {mode === "open" ? <th className="partner-job-actions">{copy.jobAccept}</th> : null}
                <th className="partner-job-actions partner-job-detail-col">{copy.jobDetail}</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((job, index) => {
                const duration = partnerJobDurationLabel(
                  job.serviceType,
                  job.durationHours,
                  locale,
                );
                return (
                <tr key={job.id} className="partner-job-row">
                  <td className="partner-job-num">{index + 1}</td>
                  {mode === "accepted" ? (
                    <td
                      className="partner-job-code partner-job-clip"
                      data-label={copy.jobReservationCode}
                      title={job.reservationCode || undefined}
                    >
                      {job.reservationCode || "—"}
                    </td>
                  ) : null}
                  <td className="partner-job-when" data-label={copy.jobDateTime}>
                    {formatOpsDateTime(job.pickupAt, locale)}
                  </td>
                  <td
                    className="partner-job-service partner-job-clip"
                    data-label={copy.jobService}
                    title={job.serviceLabel}
                  >
                    {job.serviceLabel}
                  </td>
                  <td
                    data-label={copy.jobPickup}
                    className="partner-job-pickup partner-job-clip"
                    title={job.pickupName || undefined}
                  >
                    {job.pickupName || "—"}
                  </td>
                  <td
                    data-label={copy.jobDropoff}
                    className="partner-job-dropoff partner-job-clip"
                    title={job.dropoffName || undefined}
                  >
                    {job.dropoffName || "—"}
                  </td>
                  <td
                    className="partner-job-duration"
                    data-label={copy.jobDuration}
                    title={duration === "—" ? undefined : duration}
                  >
                    {duration}
                  </td>
                  <td className="partner-job-occupancy" data-label={copy.jobOccupancy}>
                    <span className="partner-job-occupancy-value">
                      {partnerJobOccupancyCompact(job)}
                    </span>
                    {partnerJobNeedsBabySeat(job.babySeatCount) ? (
                      <span className="partner-job-baby-seat">
                        {copy.jobBabySeatRequired}: {copy.jobYes}
                      </span>
                    ) : null}
                  </td>
                  <td className="partner-job-payout" data-label={copy.jobPayout}>
                    {job.payoutLabel}
                  </td>
                  {mode === "accepted" ? (
                    <>
                      <td
                        className="partner-job-assign partner-job-assign-driver"
                        data-label={copy.jobAssignedDriver}
                      >
                        <JobDriverAssignmentCell
                          locale={locale}
                          copy={copy}
                          jobId={job.id}
                          locked={job.assignment?.locked ?? false}
                          driver={job.assignment?.driver ?? emptyDriverAssignment()}
                          drivers={drivers}
                          isPrimaryPartner={isPrimaryPartner}
                        />
                      </td>
                      <td
                        className="partner-job-assign partner-job-assign-vehicle"
                        data-label={copy.jobAssignedVehicle}
                      >
                        <JobVehicleAssignmentCell
                          locale={locale}
                          copy={copy}
                          jobId={job.id}
                          locked={job.assignment?.locked ?? false}
                          vehicle={job.assignment?.vehicle ?? emptyVehicleAssignment()}
                          vehicles={vehicles}
                          isPrimaryPartner={isPrimaryPartner}
                        />
                      </td>
                    </>
                  ) : null}
                  {mode === "open" ? (
                    <td data-label={copy.jobAccept} className="partner-job-actions">
                      <button
                        type="button"
                        className="ops-btn-primary partner-job-accept"
                        onClick={() => setPendingId(job.id)}
                      >
                        {copy.jobAccept}
                      </button>
                    </td>
                  ) : null}
                  <td data-label={copy.jobDetail} className="partner-job-actions partner-job-detail-col">
                    <a
                      className="ops-row-detail"
                      href={localizedPath(locale, `${detailBase}/${job.id}`)}
                    >
                      {copy.jobDetail}
                    </a>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <form action={action} id="partner-job-accept-form" hidden>
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="id" value={pendingId ?? ""} />
      </form>
      {pendingId ? (
        <OpsConfirmDialog
          title={copy.jobAcceptConfirm}
          pending={pending}
          cancelLabel={copy.jobClose}
          confirmLabel={pending ? copy.jobAccepting : copy.jobAcceptYes}
          confirmFormId="partner-job-accept-form"
          confirmTone="positive"
          onClose={() => setPendingId(null)}
        />
      ) : null}
    </>
  );
}
