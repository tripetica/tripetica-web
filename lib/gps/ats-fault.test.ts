import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { istanbulLocalToUtcMs } from "@/lib/booking/istanbul-time";
import {
  ATS_FAULT_NOTIFY_MS,
  ATS_FAULT_OUTAGE_MS,
  ATS_FAULT_REPAIR_MS,
  classifyGpsSubscription,
  faultDeadlines,
  faultReportingWindow,
  formatAtsFaultStart,
  formatRemainingTr,
  deviceSignalState,
  faultClearanceState,
  gnssCheckpointDecision,
  gnssIsCurrent,
  gnssOutageAlertIdentity,
  gnssOutageMail,
  ministryNoticeState,
  nextFaultReport,
  panelMinistryView,
  planGnssSuspicion,
  repairReminderDecision,
} from "@/lib/gps/ats-fault";

const start = istanbulLocalToUtcMs("2026-10-15T10:00");
const first = istanbulLocalToUtcMs("2026-10-28T13:15");

test("24h and 72h clocks start at the fault and do not restart", () => {
  const deadlines = faultDeadlines(start);
  assert.equal(deadlines.notifyDeadlineMs - start, ATS_FAULT_NOTIFY_MS);
  assert.equal(deadlines.repairDeadlineMs - start, ATS_FAULT_REPAIR_MS);
  assert.equal(deadlines.repairDeadlineMs, istanbulLocalToUtcMs("2026-10-18T10:00"));
});

test("the 30-day window follows the first success and counts only accepted reports", () => {
  const open = faultReportingWindow([{ acceptedAtMs: first }], first + 5 * 86_400_000);
  assert.equal(nextFaultReport(open), "second");
  assert.equal(open.periodEndMs, istanbulLocalToUtcMs("2026-11-27T13:15"));
  const second = faultReportingWindow(
    [{ acceptedAtMs: first }, { acceptedAtMs: first + 86_400_000 }],
    first + 2 * 86_400_000,
  );
  assert.equal(nextFaultReport(second), "blocked");
  assert.equal(second.count, 2);
  const after = faultReportingWindow([{ acceptedAtMs: first }], istanbulLocalToUtcMs("2026-11-27T13:15"));
  assert.equal(nextFaultReport(after), "first");
  assert.equal(after.open, false);
});

test("remaining time is calculated from the clock", () => {
  const end = istanbulLocalToUtcMs("2026-11-27T13:15");
  const now = end - ((5 * 24 + 6) * 3_600_000);
  assert.equal(formatRemainingTr(now, end), "5 gün 6 saat");
  assert.equal(formatRemainingTr(end, end), "süre doldu");
});

const tripStart = istanbulLocalToUtcMs("2026-10-15T12:00");
const tripEnd = istanbulLocalToUtcMs("2026-10-15T18:00");
const at = (clock: string) => istanbulLocalToUtcMs(`2026-10-15T${clock}`);
const physical = classifyGpsSubscription({
  source: "physical",
  gpsAtsEnabled: true,
  mobileEnabled: false,
});

function checkpoint(last: string | null, now: string) {
  return gnssCheckpointDecision({
    tripStartMs: tripStart,
    tripEndMs: tripEnd,
    lastGnssMs: last == null ? null : at(last),
    nowMs: at(now),
  });
}

test("mobile and idle vehicles never raise a device-fault suspicion", () => {
  const mobile = classifyGpsSubscription({ source: "mobile", gpsAtsEnabled: false, mobileEnabled: true });
  const mobileWithDeviceFlag = classifyGpsSubscription({ source: "mobile", gpsAtsEnabled: true, mobileEnabled: true });
  assert.equal(planGnssSuspicion({
    subscription: mobile,
    activeTrip: true,
    openAcceptedFault: false,
    decision: checkpoint("11:58", "12:30"),
  }).alert, false);
  assert.equal(planGnssSuspicion({
    subscription: mobileWithDeviceFlag,
    activeTrip: false,
    openAcceptedFault: false,
    decision: null,
  }).reason, "mobile");
  assert.equal(planGnssSuspicion({
    subscription: physical,
    activeTrip: false,
    openAcceptedFault: false,
    decision: null,
  }).reason, "no_trip");
  assert.equal(classifyGpsSubscription({
    source: "physical",
    gpsAtsEnabled: false,
    mobileEnabled: true,
  }).kind, "uncertain");
  assert.equal(classifyGpsSubscription({ source: null, gpsAtsEnabled: true, mobileEnabled: false }).kind, "uncertain");
});

test("checkpoints follow the trip start and ignore a fix from before the trip", () => {
  const first = checkpoint("11:58", "12:30");
  assert.equal(first.alert, true);
  assert.equal(first.reason, "missing");
  assert.equal(first.checkpointMs, at("12:30"));

  const fresh = checkpoint("12:43", "13:00");
  assert.equal(fresh.alert, false);
  assert.equal(fresh.reason, "fresh");
  assert.equal(fresh.checkpointMs, at("13:00"));
  assert.equal(fresh.ageMs, 17 * 60 * 1000);

  const staleAgain = checkpoint("12:43", "13:30");
  assert.equal(staleAgain.alert, true);
  assert.equal(staleAgain.reason, "stale");
  assert.equal(staleAgain.checkpointMs, at("13:30"));

  const exact = checkpoint("12:30", "13:00");
  assert.equal(exact.alert, true);
  assert.equal(exact.ageMs, ATS_FAULT_OUTAGE_MS);

  const beforeFirst = checkpoint("11:58", "12:29");
  assert.equal(beforeFirst.alert, false);
  assert.equal(beforeFirst.reason, "before_checkpoint");

  const lateScan = checkpoint("12:05", "12:37");
  assert.equal(lateScan.alert, false);
  assert.equal(lateScan.checkpointMs, at("12:30"));
  assert.equal(lateScan.ageMs, 25 * 60 * 1000);

  const sameSlot = checkpoint("11:58", "12:36");
  assert.equal(sameSlot.checkpointMs, first.checkpointMs);
  assert.equal(staleAgain.checkpointMs === first.checkpointMs, false);

  assert.equal(gnssCheckpointDecision({
    tripStartMs: tripStart,
    tripEndMs: tripEnd,
    lastGnssMs: at("12:10"),
    nowMs: tripEnd,
  }).reason, "trip_ended");
  assert.equal(gnssIsCurrent({
    tripStartMs: tripStart,
    lastGnssMs: at("12:40"),
    nowMs: at("12:50"),
  }), true);
});

test("an open ministry fault suppresses the same suspicion and a recovered gap can alert later", () => {
  const suppressed = planGnssSuspicion({
    subscription: physical,
    activeTrip: true,
    openAcceptedFault: true,
    decision: checkpoint("11:58", "12:30"),
  });
  assert.equal(suppressed.alert, false);
  assert.equal(suppressed.reason, "open_accepted_fault");
  const recovered = checkpoint("12:40", "13:00");
  const nextGap = checkpoint("12:40", "13:30");
  assert.equal(recovered.alert, false);
  assert.equal(nextGap.alert, true);
  assert.equal(nextGap.checkpointMs, at("13:30"));
});

test("the suspicion mail names the checkpoint and the scanner cannot send a ministry fault", () => {
  const mail = gnssOutageMail({
    plate: "34 EGP 847",
    driverName: "Ada Yılmaz",
    driverPhone: null,
    tripStartMs: tripStart,
    checkpointMs: at("12:30"),
    lastGnssMs: at("11:58"),
    lastLinkMs: at("12:20"),
    lastAtsMs: at("11:50"),
    ageMs: null,
    href: "/tr/ops/gps?tab=devices&devices=faults",
  });
  assert.match(mail.text, /34 EGP 847/);
  assert.match(mail.text, /Ada Yılmaz/);
  assert.match(mail.text, /Şoför telefonu: Tanımlanmamış/);
  assert.match(mail.text, /Sefer başlangıcı: 15\.10\.2026 – 12:00/);
  assert.match(mail.text, /Kontrol zamanı: 15\.10\.2026 – 12:30/);
  assert.match(mail.text, /Son geçerli GNSS zamanı: 15\.10\.2026 – 11:58/);
  assert.match(mail.text, /Son cihaz bağlantısı: 15\.10\.2026 – 12:20/);
  assert.match(mail.text, /Son ATS kabul zamanı: 15\.10\.2026 – 11:50/);
  assert.match(mail.text, /GNSS ölçüm zamanından sonra olabilir/);
  const scan = readFileSync(new URL("./ats-fault-scan.ts", import.meta.url), "utf8");
  assert.match(scan, /classifyGpsSubscription/);
  assert.match(scan, /service_gps_ats_enabled/);
  assert.match(scan, /ats_ministry_source/);
  assert.match(scan, /hasOpenAcceptedFault/);
  assert.match(scan, /gnssOutageAlertIdentity/);
  assert.doesNotMatch(scan, /slot: String\(item\.plan\.checkpointMs\)/);
  assert.match(scan, /kind: "gnss_outage"/);
  assert.doesNotMatch(scan, /postAtsArizaBildir|atsArizaBildir|setdigout/);
  assert.doesNotMatch(scan, /ATS GÖNDERİM HATASI|scanAtsError|ats_error/);
  const store = readFileSync(new URL("./ats-fault-store.ts", import.meta.url), "utf8");
  assert.match(store, /kind <> 'ats_error'/);
  assert.match(store, /ON CONFLICT \(channel, kind, source_key, slot\) DO NOTHING/);
  assert.match(store, /false_alarm = FALSE/);
  const migration = readFileSync(new URL("../../db/migrations/105_gps_fault_false_alarms.sql", import.meta.url), "utf8");
  assert.match(migration, /false_alarm = TRUE/);
  assert.match(migration, /service_gps_ats_enabled/);
  assert.match(migration, /ats_ministry_source = 'physical'/);
  assert.doesNotMatch(migration, /DELETE FROM/);
  assert.doesNotMatch(migration, /gps_ats_faults/);
});

test("repair reminders fire once before 72h and once when the deadline passes", () => {
  assert.equal(repairReminderDecision({
    startedAtMs: start,
    nowMs: start + 47 * 3_600_000,
    resolved: false,
    sent48: false,
    sent72: false,
  }), null);
  const firstReminder = repairReminderDecision({
    startedAtMs: start,
    nowMs: start + 48 * 3_600_000,
    resolved: false,
    sent48: false,
    sent72: false,
  });
  assert.equal(firstReminder?.slot, "48h");
  assert.equal(firstReminder?.overdue, false);
  assert.equal(repairReminderDecision({
    startedAtMs: start,
    nowMs: start + 49 * 3_600_000,
    resolved: false,
    sent48: true,
    sent72: false,
  }), null);
  const overdue = repairReminderDecision({
    startedAtMs: start,
    nowMs: start + ATS_FAULT_REPAIR_MS,
    resolved: false,
    sent48: true,
    sent72: false,
  });
  assert.equal(overdue?.slot, "72h");
  assert.equal(overdue?.kind, "repair_overdue");
  assert.equal(repairReminderDecision({
    startedAtMs: start,
    nowMs: start + 80 * 3_600_000,
    resolved: false,
    sent48: true,
    sent72: true,
  }), null);
  assert.equal(repairReminderDecision({
    startedAtMs: start,
    nowMs: start + 80 * 3_600_000,
    resolved: true,
    sent48: true,
    sent72: false,
  }), null);
});

test("device, ministry, and clearance stay separate, and one silence alerts once", () => {
  const now = start + 12 * 3_600_000;
  assert.equal(deviceSignalState({ lastLinkMs: start, lastGnssMs: start, nowMs: now }), "offline");
  assert.equal(deviceSignalState({ lastLinkMs: now - 60_000, lastGnssMs: start, nowMs: now }), "no_gnss");
  assert.equal(deviceSignalState({ lastLinkMs: now - 60_000, lastGnssMs: now - 60_000, nowMs: now }), "restored");
  assert.equal(ministryNoticeState({ status: "withheld", attempts: [{ outcome: "withheld" }] }), "disabled");
  assert.equal(ministryNoticeState({ status: "accepted", attempts: [{ outcome: "accepted" }] }), "accepted");
  assert.equal(ministryNoticeState({ status: "rejected", attempts: [{ outcome: "rejected" }] }), "rejected");
  assert.equal(ministryNoticeState({ status: "local", attempts: [] }), "not_sent");
  assert.equal(faultClearanceState(null), "open");
  assert.equal(faultClearanceState("2026-10-21T20:15:00.000Z"), "closed_local");
  const first = gnssOutageAlertIdentity("vehicle-1", start);
  const repeat = gnssOutageAlertIdentity("vehicle-1", start);
  const nextSilence = gnssOutageAlertIdentity("vehicle-1", start + 3_600_000);
  assert.equal(first.sourceKey, repeat.sourceKey);
  assert.equal(first.slot, repeat.slot);
  assert.notEqual(first.slot, nextSilence.slot);
  const section = readFileSync(new URL("../../components/gps/ats-fault-section.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(section, /fault\.ministryStatus\}/);
  assert.match(section, /panelMinistryView/);
  assert.match(section, /historyTitle/);
  assert.match(section, /<details/);
  assert.doesNotMatch(section, /copy\.ministryReady/);
  const actions = readFileSync(new URL("./ats-fault-actions.ts", import.meta.url), "utf8");
  assert.match(actions, /atsFaultSocketOpen/);
  assert.match(actions, /postAtsArizaBildir/);
  assert.equal(panelMinistryView({
    status: "unknown",
    attempts: [
      { outcome: "rejected", sonucKodu: 159, sonucMesaji: "Tarih bilgisi hatalı", attemptedAt: "2026-10-19T09:56:00.000Z" },
      { outcome: "unknown", sonucKodu: null, sonucMesaji: "U-ETDS servisine bağlanılamadı", attemptedAt: "2026-10-19T09:58:00.000Z" },
    ],
  }).state, "unknown");
  assert.equal(panelMinistryView({
    status: "rejected",
    attempts: [{ outcome: "rejected", sonucKodu: 159, sonucMesaji: "Tarih bilgisi hatalı", attemptedAt: "2026-10-19T09:56:00.000Z" }],
  }).code, 159);
  assert.equal(panelMinistryView({
    status: "withheld",
    attempts: [{ outcome: "withheld", sonucKodu: null, sonucMesaji: "kapalı", attemptedAt: "2026-10-19T08:08:00.000Z" }],
  }).state, "not_sent");
  assert.equal(panelMinistryView({
    status: "accepted",
    attempts: [{ outcome: "accepted", sonucKodu: 0, sonucMesaji: "ok", attemptedAt: "2026-10-19T09:00:00.000Z" }],
  }).state, "accepted");
});

test("ministry fault time is day/month/year hour:minute, without konum seconds", () => {
  assert.equal(formatAtsFaultStart(new Date("2026-10-15T07:00:00.000Z")), "15/10/2026 10:00");
  assert.notEqual(formatAtsFaultStart(new Date("2026-10-15T07:00:45.000Z")), "15/10/2026 10:00:45");
  const scan = readFileSync(new URL("./ats-fault-scan.ts", import.meta.url), "utf8");
  const post = readFileSync(new URL("../uetds/ats-post.ts", import.meta.url), "utf8");
  assert.doesNotMatch(scan, /postAtsArizaBildir|atsArizaBildir|setdigout/);
  assert.match(post, /export async function postAtsArizaBildir/);
  assert.match(post, /UETDS_TEST_ENDPOINT/);
  assert.match(post, /UETDS_LIVE_ENDPOINT/);
  assert.match(post, /atsPlate/);
});
