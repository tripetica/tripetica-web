"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { OpsConfirmDialog } from "@/components/ops/ops-confirm-dialog";
import { type Locale } from "@/lib/i18n/config";
import { type OpsCopy } from "@/lib/ops/copy";
import { formatOpsDateTime } from "@/lib/ops/format";
import { formatIstanbulClock } from "@/lib/ops/flight-tracking";
import { reviewDriverNoShowAction } from "@/lib/ops/no-show-review-actions";
import { type DriverNoShowReport, type NoShowReviewDecision } from "@/lib/ops/no-show";

type NoShowReviewSectionProps = {
  locale: Locale;
  copy: OpsCopy;
  reservationId: string;
  reservationCode: string | null;
  report: DriverNoShowReport;
  pickupName?: string | null;
  dropoffName?: string | null;
  vehicleSummary?: string | null;
};

function reviewStatusLabel(copy: OpsCopy, status: DriverNoShowReport["reviewStatus"]) {
  if (status === "approved") {
    return copy.driverNoShowReviewApproved;
  }
  if (status === "rejected") {
    return copy.driverNoShowReviewRejected;
  }
  return copy.driverNoShowReviewPending;
}

export function NoShowReviewSection({
  locale,
  copy,
  reservationId,
  reservationCode,
  report,
  pickupName,
  dropoffName,
  vehicleSummary,
}: NoShowReviewSectionProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState<NoShowReviewDecision | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [operationsNote, setOperationsNote] = useState(report.operationsNote ?? "");

  function decide(decision: NoShowReviewDecision) {
    startTransition(async () => {
      const result = await reviewDriverNoShowAction(
        reservationId,
        decision,
        locale,
        operationsNote,
      );
      if (!result.ok) {
        setError(copy.driverNoShowDecisionError);
        return;
      }
      setConfirming(null);
      setError(null);
      router.refresh();
    });
  }

  const rows = [
    { label: copy.reservationCode, value: reservationCode ?? "—" },
    { label: copy.status, value: reviewStatusLabel(copy, report.reviewStatus) },
    { label: copy.driverNoShowDriver, value: report.driverName || "—" },
    ...(vehicleSummary
      ? [{ label: copy.assignmentVehicle, value: vehicleSummary }]
      : []),
    ...(pickupName ? [{ label: copy.pickup, value: pickupName }] : []),
    ...(dropoffName ? [{ label: copy.dropoff, value: dropoffName }] : []),
    {
      label: copy.driverNoShowArrivedAt,
      value: formatOpsDateTime(report.arrivedAt, locale) || "—",
    },
    {
      label: copy.driverNoShowReportedAt,
      value: formatOpsDateTime(report.reportedAt, locale) || "—",
    },
    {
      label: copy.driverNoShowPickupAt,
      value: formatOpsDateTime(report.pickupAt, locale) || "—",
    },
    ...(report.flightCode
      ? [{ label: copy.flight, value: report.flightCode }]
      : []),
    ...(report.flightTracking?.scheduledArrival
      ? [
          {
            label: copy.flightScheduled,
            value: formatIstanbulClock(report.flightTracking.scheduledArrival) || "—",
          },
        ]
      : []),
    ...(report.flightTracking?.estimatedArrival
      ? [
          {
            label: copy.flightEstimated,
            value: formatIstanbulClock(report.flightTracking.estimatedArrival) || "—",
          },
        ]
      : []),
    ...(report.flightTracking?.actualArrival
      ? [
          {
            label: copy.flightActual,
            value: formatIstanbulClock(report.flightTracking.actualArrival) || "—",
          },
        ]
      : []),
    ...(report.reviewedAt
      ? [
          {
            label: copy.driverNoShowReviewedAt,
            value: formatOpsDateTime(report.reviewedAt, locale) || "—",
          },
        ]
      : []),
    ...(report.reviewedByName
      ? [{ label: copy.driverNoShowReviewedBy, value: report.reviewedByName }]
      : []),
    ...(report.operationsNote
      ? [{ label: copy.driverNoShowNote, value: report.operationsNote }]
      : []),
  ];

  return (
    <section className="ops-no-show-section">
      <h3>{copy.driverNoShow}</h3>
      <dl className="ops-dl">
        {rows.map((item) => (
          <div key={item.label} className="ops-kv">
            <dt>{item.label}</dt>
            <dd>
              <span>{item.value}</span>
            </dd>
          </div>
        ))}
      </dl>
      {error ? (
        <p className="ops-form-error" role="alert">
          {error}
        </p>
      ) : null}
      {report.canReview ? (
        <label className="ops-no-show-note">
          <span>{copy.driverNoShowNote}</span>
          <textarea
            value={operationsNote}
            maxLength={500}
            disabled={pending}
            onChange={(event) => setOperationsNote(event.target.value)}
          />
        </label>
      ) : null}
      {report.canReview ? (
        <div className="ops-no-show-actions">
          <button
            type="button"
            className="ops-btn-primary"
            disabled={pending}
            onClick={() => {
              setError(null);
              setConfirming("approved");
            }}
          >
            {copy.driverNoShowApprove}
          </button>
          <button
            type="button"
            className="ops-btn-danger"
            disabled={pending}
            onClick={() => {
              setError(null);
              setConfirming("rejected");
            }}
          >
            {copy.driverNoShowReject}
          </button>
        </div>
      ) : null}
      {confirming ? (
        <OpsConfirmDialog
          title={
            confirming === "approved"
              ? copy.driverNoShowApproveConfirm
              : copy.driverNoShowRejectConfirm
          }
          pending={pending}
          cancelLabel={copy.cancel}
          confirmLabel={
            confirming === "approved" ? copy.driverNoShowApprove : copy.driverNoShowReject
          }
          confirmTone={confirming === "approved" ? "positive" : "danger"}
          onConfirm={() => decide(confirming)}
          onClose={() => {
            if (!pending) {
              setConfirming(null);
            }
          }}
        />
      ) : null}
    </section>
  );
}
