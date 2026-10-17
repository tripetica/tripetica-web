import { parseAtsMinistrySource } from "@/lib/gps/ats-source";
import { formatAtsKonumZamani } from "@/lib/uetds/ats-soap";

/** Circular (c): notify within 24 hours of the fault start. The repair clock does not restart. */
export const ATS_FAULT_NOTIFY_MS = 24 * 60 * 60 * 1000;
/** Circular (c): repair within 72 hours of the fault start. */
export const ATS_FAULT_REPAIR_MS = 72 * 60 * 60 * 1000;
/** Circular (d): at most two successful reports in 30 days from the first success. */
export const ATS_FAULT_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
export const ATS_FAULT_OUTAGE_MS = 30 * 60 * 1000;
export const ATS_FAULT_REMINDER_MS = 48 * 60 * 60 * 1000;
export const ATS_GNSS_FUTURE_SKEW_MS = 5 * 60 * 1000;

export const ATS_FAULT_KINDS = ["gnss", "connection", "ats", "power", "other"] as const;
export type AtsFaultKind = (typeof ATS_FAULT_KINDS)[number];

export function isAtsFaultKind(value: string): value is AtsFaultKind {
  return (ATS_FAULT_KINDS as readonly string[]).includes(value);
}

export function faultDeadlines(startedAtMs: number) {
  return {
    notifyDeadlineMs: startedAtMs + ATS_FAULT_NOTIFY_MS,
    repairDeadlineMs: startedAtMs + ATS_FAULT_REPAIR_MS,
  };
}

export type AcceptedFaultStamp = { acceptedAtMs: number };

/**
 * The open 30-day period is anchored to the first successful ministry
 * acceptance that still covers `now`. The end instant is exclusive.
 */
export function faultReportingWindow(accepted: readonly AcceptedFaultStamp[], nowMs: number) {
  const times = accepted
    .map((row) => row.acceptedAtMs)
    .filter((value) => Number.isFinite(value))
    .sort((left, right) => left - right);
  let periodStart: number | null = null;
  let periodEnd: number | null = null;
  let count = 0;
  for (const time of times) {
    if (periodStart == null || periodEnd == null || time >= periodEnd) {
      periodStart = time;
      periodEnd = time + ATS_FAULT_WINDOW_MS;
      count = 1;
      continue;
    }
    count += 1;
  }
  const open = periodStart != null && periodEnd != null && nowMs < periodEnd;
  return {
    open,
    count: open ? count : 0,
    firstAcceptedAtMs: open ? periodStart : null,
    periodEndMs: open ? periodEnd : null,
  };
}

export function nextFaultReport(window: { open: boolean; count: number }): "first" | "second" | "blocked" {
  if (!window.open || window.count <= 0) return "first";
  if (window.count === 1) return "second";
  return "blocked";
}

export function remainingDaysHours(nowMs: number, endMs: number) {
  const ms = endMs - nowMs;
  if (!Number.isFinite(ms) || ms <= 0) {
    return { days: 0, hours: 0, ended: true };
  }
  return {
    days: Math.floor(ms / 86_400_000),
    hours: Math.floor((ms % 86_400_000) / 3_600_000),
    ended: false,
  };
}

export function formatFaultClock(instantMs: number) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Istanbul",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(instantMs));
  const read = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${read("day")}.${read("month")}.${read("year")} – ${read("hour")}:${read("minute")}`;
}

export function formatRemainingTr(nowMs: number, endMs: number) {
  const left = remainingDaysHours(nowMs, endMs);
  if (left.ended) return "süre doldu";
  return `${left.days} gün ${left.hours} saat`;
}

/** V15 leaves arizaBaslangicTarihi unconstrained. The circular also requires the clock, so the konum timestamp pattern is used. */
export function formatAtsFaultStart(instant: Date) {
  return formatAtsKonumZamani(instant);
}

export function istanbulHourKey(instantMs: number) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(instantMs));
  const read = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${read("year")}-${read("month")}-${read("day")}T${read("hour")}`;
}

export type GpsSubscriptionClass =
  | { kind: "physical" }
  | { kind: "excluded"; reason: "mobile" | "none" | "ats_disabled" }
  | { kind: "uncertain"; reason: "missing_fields" | "physical_without_subscription" };

/**
 * Physical suspicion uses the stored ministry source and the GPS-ATS flag.
 * Plate shape and IMEI are not inputs. An unresolved source does not alert.
 */
export function classifyGpsSubscription(input: {
  source: string | null | undefined;
  gpsAtsEnabled: boolean | null | undefined;
  mobileEnabled: boolean | null | undefined;
  explicitlyDisabled?: boolean;
}): GpsSubscriptionClass {
  const source = typeof input.source === "string" ? parseAtsMinistrySource(input.source) : null;
  if (source == null || typeof input.gpsAtsEnabled !== "boolean" || typeof input.mobileEnabled !== "boolean") {
    return { kind: "uncertain", reason: "missing_fields" };
  }
  if (source === "mobile") return { kind: "excluded", reason: "mobile" };
  if (source === "none") return { kind: "excluded", reason: "none" };
  if (!input.gpsAtsEnabled) return { kind: "uncertain", reason: "physical_without_subscription" };
  if (input.explicitlyDisabled) return { kind: "excluded", reason: "ats_disabled" };
  return { kind: "physical" };
}

export type GnssCheckpointDecision = {
  alert: boolean;
  reason: "before_trip" | "trip_ended" | "before_checkpoint" | "fresh" | "stale" | "missing" | "invalid";
  checkpointMs: number | null;
  ageMs: number | null;
};

/**
 * Checkpoints are tripStart + 30 minutes, then every 30 minutes until the trip ends.
 * Age is measured at the checkpoint. A late scan still judges that checkpoint.
 * A fix from before the trip does not count as an in-trip fix.
 */
export function gnssCheckpointDecision(input: {
  tripStartMs: number;
  tripEndMs: number;
  lastGnssMs: number | null;
  nowMs: number;
}): GnssCheckpointDecision {
  if (!Number.isFinite(input.tripStartMs) || !Number.isFinite(input.tripEndMs) || !Number.isFinite(input.nowMs)) {
    return { alert: false, reason: "invalid", checkpointMs: null, ageMs: null };
  }
  if (input.tripEndMs < input.tripStartMs || input.nowMs < input.tripStartMs) {
    return { alert: false, reason: "before_trip", checkpointMs: null, ageMs: null };
  }
  if (input.nowMs >= input.tripEndMs) {
    return { alert: false, reason: "trip_ended", checkpointMs: null, ageMs: null };
  }
  const elapsed = input.nowMs - input.tripStartMs;
  if (elapsed < ATS_FAULT_OUTAGE_MS) {
    return { alert: false, reason: "before_checkpoint", checkpointMs: null, ageMs: null };
  }
  const checkpointMs = input.tripStartMs + Math.floor(elapsed / ATS_FAULT_OUTAGE_MS) * ATS_FAULT_OUTAGE_MS;
  if (checkpointMs >= input.tripEndMs) {
    return { alert: false, reason: "trip_ended", checkpointMs: null, ageMs: null };
  }
  const lastGnssMs = input.lastGnssMs;
  const inTrip = lastGnssMs != null
    && Number.isFinite(lastGnssMs)
    && lastGnssMs >= input.tripStartMs
    && lastGnssMs <= input.nowMs + ATS_GNSS_FUTURE_SKEW_MS;
  if (!inTrip || lastGnssMs == null) {
    return { alert: true, reason: "missing", checkpointMs, ageMs: null };
  }
  const ageMs = checkpointMs - lastGnssMs;
  if (ageMs >= ATS_FAULT_OUTAGE_MS) {
    return { alert: true, reason: "stale", checkpointMs, ageMs };
  }
  return { alert: false, reason: "fresh", checkpointMs, ageMs };
}

export function planGnssSuspicion(input: {
  subscription: GpsSubscriptionClass;
  activeTrip: boolean;
  openAcceptedFault: boolean;
  decision: GnssCheckpointDecision | null;
}) {
  if (input.subscription.kind === "uncertain") {
    return { alert: false, reason: `unresolved:${input.subscription.reason}`, checkpointMs: null as number | null };
  }
  if (input.subscription.kind !== "physical") {
    return { alert: false, reason: input.subscription.reason, checkpointMs: null as number | null };
  }
  if (!input.activeTrip) {
    return { alert: false, reason: "no_trip", checkpointMs: null as number | null };
  }
  if (input.openAcceptedFault) {
    return { alert: false, reason: "open_accepted_fault", checkpointMs: null as number | null };
  }
  if (!input.decision?.alert) {
    return {
      alert: false,
      reason: input.decision?.reason ?? "no_checkpoint",
      checkpointMs: input.decision?.checkpointMs ?? null,
    };
  }
  return { alert: true, reason: input.decision.reason, checkpointMs: input.decision.checkpointMs };
}

export function gnssIsCurrent(input: { tripStartMs: number; lastGnssMs: number | null; nowMs: number }) {
  if (input.lastGnssMs == null) return false;
  if (input.lastGnssMs < input.tripStartMs) return false;
  if (input.lastGnssMs > input.nowMs + ATS_GNSS_FUTURE_SKEW_MS) return false;
  return input.nowMs - input.lastGnssMs < ATS_FAULT_OUTAGE_MS;
}

export function repairReminderDecision(input: {
  startedAtMs: number;
  nowMs: number;
  resolved: boolean;
  sent48: boolean;
  sentHourKeys: readonly string[];
}) {
  if (input.resolved || input.nowMs < input.startedAtMs + ATS_FAULT_REMINDER_MS) {
    return null;
  }
  const overdue = input.nowMs >= input.startedAtMs + ATS_FAULT_REPAIR_MS;
  if (!input.sent48) {
    return { slot: "48h", overdue, kind: overdue ? "repair_overdue" as const : "repair_reminder" as const };
  }
  const hour = istanbulHourKey(input.nowMs);
  const firstHour = istanbulHourKey(input.startedAtMs + ATS_FAULT_REMINDER_MS);
  if (hour === firstHour || input.sentHourKeys.includes(hour)) {
    return null;
  }
  return {
    slot: `hour:${hour}`,
    overdue,
    kind: overdue ? "repair_overdue" as const : "repair_reminder" as const,
  };
}

export function elapsedMs(startedAtMs: number, nowMs: number) {
  return Math.max(0, nowMs - startedAtMs);
}

export function formatElapsedTr(ms: number) {
  const minutes = Math.floor(ms / 60_000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days} gün ${hours % 24} saat`;
  if (hours > 0) return `${hours} saat ${minutes % 60} dakika`;
  return `${minutes} dakika`;
}

export function gnssOutageMail(input: {
  plate: string;
  driverName: string | null;
  driverPhone: string | null;
  tripStartMs: number;
  checkpointMs: number;
  lastGnssMs: number | null;
  lastLinkMs: number | null;
  lastAtsMs: number | null;
  ageMs: number | null;
  href: string;
}) {
  const phone = input.driverPhone?.trim() || "Tanımlanmamış";
  const lines = [
    "GPS / ATS KONUM KESİNTİSİ – ARIZA ŞÜPHESİ",
    "",
    `Araç: ${input.plate}`,
    `Şoför: ${input.driverName?.trim() || "Tanımlanmamış"}`,
    `Şoför telefonu: ${phone}`,
    `Sefer başlangıcı: ${formatFaultClock(input.tripStartMs)}`,
    `Kontrol zamanı: ${formatFaultClock(input.checkpointMs)}`,
    `Son geçerli GNSS zamanı: ${input.lastGnssMs == null ? "Tanımlanmamış" : formatFaultClock(input.lastGnssMs)}`,
    `Son cihaz bağlantısı: ${input.lastLinkMs == null ? "Tanımlanmamış" : formatFaultClock(input.lastLinkMs)}`,
    `Son başarılı ATS bildirimi: ${input.lastAtsMs == null ? "Tanımlanmamış" : formatFaultClock(input.lastAtsMs)}`,
    `Kontrol anındaki konum yaşı: ${input.ageMs == null ? "sefer içinde geçerli konum yok" : formatElapsedTr(input.ageMs)}`,
    "",
    "Aktif sefer sırasında araçtan güncel GNSS konum verisi alınamıyor.",
    "GPS cihazının ve aracın durumunu kontrol etmek için şoförle iletişime geçin.",
    "",
    input.href,
  ];
  return { subject: "GPS / ATS KONUM KESİNTİSİ – ARIZA ŞÜPHESİ", text: lines.join("\n") };
}

export function repairReminderMail(input: {
  plate: string;
  driverName: string | null;
  driverPhone: string | null;
  startedAtMs: number;
  acceptedAtMs: number | null;
  nowMs: number;
  overdue: boolean;
  href: string;
}) {
  const deadlines = faultDeadlines(input.startedAtMs);
  const subject = input.overdue
    ? "GPS ARIZASI – ARIZA GİDERME SÜRESİ AŞILDI"
    : "GPS ARIZASI – GİDERME SÜRESİ HATIRLATMASI";
  const lines = [
    subject,
    "",
    `Araç: ${input.plate}`,
    `Şoför: ${input.driverName?.trim() || "Tanımlanmamış"}`,
    `Şoför telefonu: ${input.driverPhone?.trim() || "Tanımlanmamış"}`,
    `Arıza başlangıcı: ${formatFaultClock(input.startedAtMs)}`,
    `Bakanlığa bildirim: ${input.acceptedAtMs == null ? "Tanımlanmamış" : formatFaultClock(input.acceptedAtMs)}`,
    `Arıza giderme son zamanı: ${formatFaultClock(deadlines.repairDeadlineMs)}`,
    input.overdue
      ? `Geçen süre: ${formatElapsedTr(input.nowMs - input.startedAtMs)}`
      : `Kalan süre: ${formatRemainingTr(input.nowMs, deadlines.repairDeadlineMs)}`,
    "",
    input.overdue
      ? "Bakanlığa bildirilen GPS arızasının 72 saatlik giderme süresi aşıldı. Arıza kapatılana kadar takip sürer."
      : "Bakanlığa bildirilen GPS arızasının giderilmesi için süre azalmaktadır. Arıza giderildiyse operasyon panelinden arıza giderildi işlemini tamamlayın.",
    "",
    input.href,
  ];
  return { subject, text: lines.join("\n") };
}
