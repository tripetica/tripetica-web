import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { TRANSFER_SERVICE_TYPE } from "@/lib/booking/reservation-search";
import {
  canReportDriverNoShow,
  isPendingNoShowReview,
  isReservationOpsFinalStatus,
  isTransferNoShowService,
  NO_SHOW_SERVICE_TYPE,
  reservationStatusFromNoShowDecision,
} from "@/lib/ops/no-show";
import { reservationOperationWhereSql } from "@/lib/ops/reservation-filters";

function source(path: string) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

test("No Show service-type guard is Transfer only", () => {
  assert.equal(NO_SHOW_SERVICE_TYPE, TRANSFER_SERVICE_TYPE);
  assert.equal(isTransferNoShowService("transfer"), true);
  assert.equal(isTransferNoShowService("Transfer"), true);
  assert.equal(isTransferNoShowService("hourly"), false);
  assert.equal(isTransferNoShowService("tour"), false);
  assert.equal(isTransferNoShowService(null), false);
});

test("1. Transfer + VARDIM can report No Show", () => {
  assert.equal(canReportDriverNoShow("arrived", false, "transfer"), true);
});

test("4. Transfer + ALDIM cannot report No Show", () => {
  assert.equal(canReportDriverNoShow("picked_up", false, "transfer"), false);
  assert.equal(canReportDriverNoShow("completed", false, "transfer"), false);
  assert.equal(canReportDriverNoShow("en_route", false, "transfer"), false);
});

test("17/22. Hourly and Tour never expose No Show after VARDIM", () => {
  assert.equal(canReportDriverNoShow("arrived", false, "hourly"), false);
  assert.equal(canReportDriverNoShow("arrived", false, "tour"), false);
});

test("5. duplicate No Show reports are rejected by unique reservation id", () => {
  const sql = source("db/migrations/051_flight_tracking_and_no_show.sql");
  assert.match(sql, /reservation_id UUID PRIMARY KEY/);
  assert.match(source("lib/ops/driver-no-show.ts"), /ON CONFLICT \(reservation_id\) DO NOTHING/);
});

test("6. driver No Show report does not close the reservation or complete the task", () => {
  const impl = source("lib/ops/driver-no-show.ts");
  const reportFn = impl.slice(
    impl.indexOf("export async function reportDriverNoShowByToken"),
    impl.indexOf("export async function reviewDriverNoShowReport"),
  );
  assert.doesNotMatch(reportFn, /current_stage = 'completed'/);
  assert.doesNotMatch(reportFn, /status = 'cancelled'/);
  assert.doesNotMatch(reportFn, /status = 'no_show'/);
  assert.doesNotMatch(reportFn, /status = 'service_failed'/);
  assert.doesNotMatch(reportFn, /UPDATE reservations/);
  assert.match(reportFn, /isTransferNoShowService\(row\.service_type\)/);
  assert.match(reportFn, /current_stage !== "arrived"/);
});

test("19/24. backend rejects non-Transfer No Show reports before insert", () => {
  const reportFn = source("lib/ops/driver-no-show.ts");
  const fn = reportFn.slice(
    reportFn.indexOf("export async function reportDriverNoShowByToken"),
    reportFn.indexOf("export async function reviewDriverNoShowReport"),
  );
  assert.match(fn, /isTransferNoShowService\(row\.service_type\)/);
  assert.match(fn, /return \{ ok: false, reason: "conflict" \}/);
  assert.ok(
    fn.indexOf("isTransferNoShowService") < fn.indexOf("INSERT INTO reservation_driver_no_show_reports"),
  );
});

test("8-16. ops review approve/reject writes independent final statuses and keeps history", () => {
  const impl = source("lib/ops/driver-no-show.ts");
  const reviewFn = impl.slice(impl.indexOf("export async function reviewDriverNoShowReport"));
  assert.match(reviewFn, /review_status = \$2/);
  assert.match(reviewFn, /SET status = \$2/);
  assert.doesNotMatch(reviewFn, /DELETE FROM reservation_driver_no_show_reports/);
  assert.doesNotMatch(reviewFn, /current_stage = 'completed'/);
  assert.doesNotMatch(reviewFn, /refund|compensation|payout/i);
  assert.equal(reservationStatusFromNoShowDecision("approved"), "no_show");
  assert.equal(reservationStatusFromNoShowDecision("rejected"), "service_failed");
  assert.equal(isReservationOpsFinalStatus("no_show"), true);
  assert.equal(isReservationOpsFinalStatus("service_failed"), true);
  assert.equal(isReservationOpsFinalStatus("confirmed"), false);
  assert.equal(isReservationOpsFinalStatus("cancelled"), false);
  assert.match(source("lib/ops/no-show-review-actions.ts"), /reviewDriverNoShowReport/);
  assert.match(source("lib/ops/no-show-review-actions.ts"), /operationsNote/);
  assert.match(source("components/ops/no-show-review-section.tsx"), /OpsConfirmDialog/);
  assert.match(source("components/ops/no-show-review-section.tsx"), /driverNoShowApprove/);
  assert.match(source("components/ops/no-show-review-section.tsx"), /driverNoShowReject/);
  assert.match(source("components/ops/no-show-review-section.tsx"), /copy\.pickup/);
  assert.match(source("components/ops/no-show-review-section.tsx"), /copy\.dropoff/);
  assert.match(source("components/ops/no-show-review-section.tsx"), /copy\.assignmentVehicle/);
  assert.match(source("components/ops/no-show-review-section.tsx"), /driverNoShowNote/);
});

test("7. pending No Show review is visible without leaving Aktif", () => {
  assert.equal(isPendingNoShowReview("pending", "confirmed"), true);
  assert.equal(isPendingNoShowReview("pending", "no_show"), false);
  assert.equal(isPendingNoShowReview("approved", "no_show"), false);
  assert.match(source("components/ops/reservation-table.tsx"), /driverNoShowReviewBadge/);
  assert.match(source("lib/ops/reservation-filters.ts"), /status NOT IN \('cancelled', 'no_show', 'service_failed'\)/);
});

test("pending driver report does not match the approved No Show filter", () => {
  assert.equal(reservationOperationWhereSql("no_show"), "status = 'no_show'");
  assert.doesNotMatch(reservationOperationWhereSql("no_show") ?? "", /review_status/);
  assert.equal(reservationOperationWhereSql("service_failed"), "status = 'service_failed'");
});

test("ops operation column uses final No Show statuses instead of the driver stage", () => {
  const table = source("components/ops/reservation-table.tsx");
  assert.match(table, /isReservationOpsFinalStatus\(item\.status\)/);
  assert.match(table, /reservationStatusLabel\(item\.status, copy\)/);
  assert.match(table, /reservationStatusBadgeClass\(item\.status\)/);
  assert.match(source("app/globals.css"), /\.ops-status-badge\.is-service-failed/);
});

test("15. Driver Task token, grace, and advance path stay untouched by driver report", () => {
  const task = source("lib/ops/driver-task.ts");
  const stages = source("lib/ops/driver-task-stages.ts");
  assert.match(task, /driver_fingerprint = \$2/);
  const syncFn = task.slice(
    task.indexOf("export async function syncDriverTaskAfterAssignment"),
    task.indexOf("export async function getDriverTaskForOps"),
  );
  assert.doesNotMatch(syncFn, /access_token/);
  assert.match(stages, /DRIVER_TASK_PUBLIC_GRACE_MS = 2 \* 60 \* 1000/);
  assert.match(source("lib/ops/driver-task-actions.ts"), /reportDriverNoShowByToken/);
  assert.doesNotMatch(source("lib/ops/driver-task-actions.ts"), /advanceDriverTaskByToken\(token, "completed"\)/);
});

test("11. Driver Task blocks ALDIM/BIRAKTIM after ops final No Show outcomes", () => {
  const task = source("lib/ops/driver-task.ts");
  const advance = task.slice(task.indexOf("export async function advanceDriverTaskByToken"));
  assert.match(advance, /isReservationOpsFinalStatus\(row\.status\)/);
  assert.match(source("components/driver-task/driver-task-screen.tsx"), /closedOutcome/);
  assert.match(source("components/driver-task/driver-task-screen.tsx"), /Hizmet Gerçekleşmedi/);
});

test("2/3. Transfer wait copy stays on the No Show button only", () => {
  const screen = source("components/driver-task/driver-task-screen.tsx");
  assert.match(screen, /view\.noShow\?\.canReport/);
  assert.match(
    screen,
    /Ücretsiz bekleme süresi, uçağın gerçek iniş saatinden 30 dakika sonra başlar ve 90 dakikadır/,
  );
  assert.match(screen, /Ücretsiz bekleme süresi 30 dakikadır/);
  assert.match(source("lib/ops/driver-task.ts"), /isTransferNoShowService\(row\.service_type\)/);
});

test("driver No Show first tap opens confirmation without a backend mutation", () => {
  const screen = source("components/driver-task/driver-task-screen.tsx");
  const openFn = screen.slice(
    screen.indexOf("function openNoShowConfirm"),
    screen.indexOf("function cancelNoShowConfirm"),
  );
  const cancelFn = screen.slice(
    screen.indexOf("function cancelNoShowConfirm"),
    screen.indexOf("function reportNoShow"),
  );
  const reportFn = screen.slice(
    screen.indexOf("function reportNoShow"),
    screen.indexOf("const body ="),
  );
  assert.match(screen, /onClick=\{openNoShowConfirm\}/);
  assert.match(
    screen,
    /Bu rezervasyonu No Show olarak bildirmek istediğinizden emin misiniz\?/,
  );
  assert.match(screen, />\s*VAZGEÇ\s*</);
  assert.doesNotMatch(openFn, /reportDriverNoShowAction/);
  assert.doesNotMatch(openFn, /startTransition/);
  assert.match(openFn, /setConfirmNoShow\(true\)/);
  assert.doesNotMatch(cancelFn, /reportDriverNoShowAction/);
  assert.doesNotMatch(cancelFn, /startTransition/);
  assert.match(cancelFn, /setConfirmNoShow\(false\)/);
  assert.match(cancelFn, /if \(pending\)/);
  assert.match(reportFn, /!confirmNoShow/);
  assert.match(reportFn, /reportDriverNoShowAction\(token\)/);
  assert.match(reportFn, /startTransition/);
  assert.equal((reportFn.match(/reportDriverNoShowAction\(token\)/g) ?? []).length, 1);
  assert.match(screen, /disabled=\{pending\}/);
  assert.match(screen, /confirmNoShow && view\.noShow\?\.canReport/);
});

test("26-29. flight tracking is not service-type gated by No Show", () => {
  const tracking = source("lib/ops/flight-tracking.ts");
  const shouldTrack = tracking.slice(
    tracking.indexOf("export function shouldTrackAirportPickupFlight"),
    tracking.indexOf("export function parseDhmiClock"),
  );
  assert.doesNotMatch(shouldTrack, /serviceType|service_type|hourly|tour|transfer/);
  const poller = source("lib/ops/flight-tracking-poll.ts");
  assert.doesNotMatch(poller, /service_type/);
  assert.match(poller, /r\.status = 'confirmed'/);
  assert.doesNotMatch(source("lib/ops/no-show.ts"), /shouldTrackAirportPickupFlight/);
  const task = source("lib/ops/driver-task.ts");
  assert.match(task, /shouldTrackAirportPickupFlight\(/);
  assert.match(task, /status: "confirmed"/);
});

test("052 review lifecycle is additive and does not rewrite pickup_at", () => {
  const sql = source("db/migrations/052_no_show_review_lifecycle.sql");
  assert.match(sql, /ADD COLUMN IF NOT EXISTS review_status/);
  assert.match(sql, /reviewed_at/);
  assert.match(sql, /reviewed_by/);
  assert.match(sql, /operations_note/);
  assert.match(sql, /GRANT SELECT, INSERT, UPDATE/);
  assert.doesNotMatch(sql, /ALTER TABLE reservations/);
  assert.doesNotMatch(sql, /UPDATE reservations/i);
  assert.doesNotMatch(sql, /DELETE FROM reservation_driver_no_show_reports/);
  const original = source("db/migrations/051_flight_tracking_and_no_show.sql");
  assert.doesNotMatch(original, /ALTER TABLE reservations/);
  assert.doesNotMatch(original, /UPDATE reservations/i);
});

test("production flight-track units are not rewritten by this change", () => {
  assert.doesNotMatch(source("deploy/systemd/tripetica-prod-flight-track.timer"), /no_show|service_failed/);
  assert.doesNotMatch(source("deploy/systemd/tripetica-prod-flight-track.service"), /no_show|service_failed/);
  assert.doesNotMatch(source("lib/ops/flight-tracking-prod-guard.ts"), /no_show|service_failed/);
});
