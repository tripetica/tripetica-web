import { type FlightTrackingSnapshot } from "@/lib/ops/flight-tracking";

export const NO_SHOW_SERVICE_TYPE = "transfer";
export const NO_SHOW_REVIEW_PENDING = "pending";
export const NO_SHOW_REVIEW_APPROVED = "approved";
export const NO_SHOW_REVIEW_REJECTED = "rejected";
export const RESERVATION_STATUS_NO_SHOW = "no_show";
export const RESERVATION_STATUS_SERVICE_FAILED = "service_failed";

export type NoShowReviewStatus =
  | typeof NO_SHOW_REVIEW_PENDING
  | typeof NO_SHOW_REVIEW_APPROVED
  | typeof NO_SHOW_REVIEW_REJECTED;
export type NoShowReviewDecision = typeof NO_SHOW_REVIEW_APPROVED | typeof NO_SHOW_REVIEW_REJECTED;
export type DriverTaskClosedOutcome =
  | typeof RESERVATION_STATUS_NO_SHOW
  | typeof RESERVATION_STATUS_SERVICE_FAILED;

export function isTransferNoShowService(serviceType: string | null | undefined) {
  return (serviceType ?? "").trim().toLowerCase() === NO_SHOW_SERVICE_TYPE;
}

export function canReportDriverNoShow(
  stage: string | null | undefined,
  alreadyReported: boolean,
  serviceType?: string | null,
) {
  return isTransferNoShowService(serviceType) && stage === "arrived" && !alreadyReported;
}

export function isReservationNoShowStatus(status: string | null | undefined) {
  return (status ?? "").trim() === RESERVATION_STATUS_NO_SHOW;
}

export function isReservationServiceFailedStatus(status: string | null | undefined) {
  return (status ?? "").trim() === RESERVATION_STATUS_SERVICE_FAILED;
}

export function isReservationOpsFinalStatus(status: string | null | undefined) {
  return isReservationNoShowStatus(status) || isReservationServiceFailedStatus(status);
}

export function reservationStatusFromNoShowDecision(decision: NoShowReviewDecision) {
  return decision === NO_SHOW_REVIEW_APPROVED
    ? RESERVATION_STATUS_NO_SHOW
    : RESERVATION_STATUS_SERVICE_FAILED;
}

export function driverTaskClosedOutcome(
  status: string | null | undefined,
): DriverTaskClosedOutcome | null {
  if (isReservationNoShowStatus(status)) {
    return RESERVATION_STATUS_NO_SHOW;
  }
  if (isReservationServiceFailedStatus(status)) {
    return RESERVATION_STATUS_SERVICE_FAILED;
  }
  return null;
}

export function isPendingNoShowReview(
  reviewStatus: string | null | undefined,
  reservationStatus: string | null | undefined,
) {
  return (
    (reviewStatus ?? "").trim() === NO_SHOW_REVIEW_PENDING &&
    !isReservationOpsFinalStatus(reservationStatus)
  );
}

export type DriverNoShowReport = {
  reportedAt: string;
  arrivedAt: string | null;
  driverKind: string | null;
  driverId: string | null;
  driverName: string | null;
  flightCode: string | null;
  pickupAt: string | null;
  serviceType: string | null;
  reservationStatus: string | null;
  reviewStatus: NoShowReviewStatus;
  reviewedAt: string | null;
  reviewedByName: string | null;
  operationsNote: string | null;
  canReview: boolean;
  flightTracking: FlightTrackingSnapshot | null;
};
