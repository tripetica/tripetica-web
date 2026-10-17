const MINUTE = 60 * 1000;

export const MOBILE_REMINDER_LEAD_MS = 5 * MINUTE;
export const MOBILE_REMINDER_INTERVAL_MS = 10 * MINUTE;
export const MOBILE_REMINDER_CHECK_WINDOW_MS = MINUTE;
/** A server accept older than this is not a current share at the checkpoint. */
export const MOBILE_REMINDER_FRESH_MS = 2 * MINUTE;

export type MobileReminderPhase = "missing" | "interrupted";

export type ReminderAudience = "driver" | "owner";

export function mobileReminderSlot(input: { startMs: number; endMs: number; nowMs: number }): number | null {
  if (!Number.isFinite(input.startMs) || !Number.isFinite(input.endMs) || input.endMs <= input.startMs) return null;
  if (input.nowMs >= input.endMs) return null;
  const first = input.startMs - MOBILE_REMINDER_LEAD_MS;
  if (input.nowMs < first) return null;
  const index = Math.floor((input.nowMs - first) / MOBILE_REMINDER_INTERVAL_MS);
  const slot = first + index * MOBILE_REMINDER_INTERVAL_MS;
  if (slot >= input.endMs) return null;
  if (input.nowMs >= slot + MOBILE_REMINDER_CHECK_WINDOW_MS) return null;
  return slot;
}

/** A recent server accept counts even when the stored coordinate did not change. */
export function mobileShareHeard(lastHeardAtMs: number | null, nowMs: number) {
  if (lastHeardAtMs == null || !Number.isFinite(lastHeardAtMs)) return false;
  const age = nowMs - lastHeardAtMs;
  if (age < 0) return lastHeardAtMs - nowMs <= 5 * MINUTE;
  return age < MOBILE_REMINDER_FRESH_MS;
}

export function mobileReminderDue(input: {
  startMs: number;
  endMs: number;
  nowMs: number;
  lastHeardAtMs: number | null;
}) {
  if (mobileShareHeard(input.lastHeardAtMs, input.nowMs)) return null;
  return mobileReminderSlot(input);
}

export function mobileReminderPhase(nowMs: number, startMs: number): MobileReminderPhase {
  return nowMs < startMs ? "missing" : "interrupted";
}

export function mobileReminderRuntimeAllowed(env: { NODE_ENV?: string; EXPECTED_DATABASE?: string }) {
  if (env.EXPECTED_DATABASE === "tripetica_dev" && env.NODE_ENV !== "production") return true;
  if (env.EXPECTED_DATABASE === "tripetica" && env.NODE_ENV === "production") return true;
  return false;
}

/** One item per device. The same browser must not get both the driver and owner copy. */
export function uniquePushEndpoints<T extends { endpoint: string }>(rows: readonly T[]): T[] {
  const seen = new Set<string>();
  const unique: T[] = [];
  for (const row of rows) {
    if (!row.endpoint || seen.has(row.endpoint)) continue;
    seen.add(row.endpoint);
    unique.push(row);
  }
  return unique;
}

export function reminderPushSources(input: { samePerson: boolean; audience: ReminderAudience }): Array<"driver" | "owner"> {
  if (input.samePerson) return ["driver", "owner"];
  return [input.audience === "owner" ? "owner" : "driver"];
}

/**
 * Another open trip for the same driver shares one send only inside the
 * current one-minute checkpoint. Its next planned checkpoint stays open.
 */
export const MOBILE_REMINDER_COOLDOWN_MS = MOBILE_REMINDER_CHECK_WINDOW_MS;

export function recentReminderBlocks(input: { lastSentAtMs: number | null; nowMs: number }) {
  if (input.lastSentAtMs == null || !Number.isFinite(input.lastSentAtMs)) return false;
  return input.nowMs - input.lastSentAtMs < MOBILE_REMINDER_COOLDOWN_MS;
}

/** The trip's own previous checkpoint must not close its next one-minute window. */
export function overlappingTripReminderBlocks(input: { otherTripSentAtMs: number | null; nowMs: number }) {
  return recentReminderBlocks({ lastSentAtMs: input.otherTripSentAtMs, nowMs: input.nowMs });
}

export function reminderTargets(input: { ownerIsDriver: boolean }): Array<{ audience: ReminderAudience; channel: "push" | "email" }> {
  if (input.ownerIsDriver) {
    return [
      { audience: "driver", channel: "push" },
      { audience: "driver", channel: "email" },
    ];
  }
  return [
    { audience: "driver", channel: "push" },
    { audience: "owner", channel: "push" },
    { audience: "owner", channel: "email" },
  ];
}

export function ownerIsDriver(input: { driverEmail: string | null; ownerEmail: string | null }) {
  const driver = input.driverEmail?.trim().toLowerCase() ?? "";
  const owner = input.ownerEmail?.trim().toLowerCase() ?? "";
  return driver.length > 0 && driver === owner;
}

function reminderFacts(input: { plate: string; date: string; start: string; end: string; pickup: string; dropoff: string }) {
  return [
    `Plaka: ${input.plate}`,
    `Sefer tarihi: ${input.date || "—"}`,
    `Başlangıç: ${input.start || "—"}`,
    `Bitiş: ${input.end || "—"}`,
    `Alış: ${input.pickup || "—"}`,
    `Bırakış: ${input.dropoff || "—"}`,
  ];
}

function reminderLead(input: { phase: MobileReminderPhase; plate: string; driverName?: string }) {
  if (input.driverName) {
    const state = input.phase === "missing" ? "konum paylaşımı başlatılmadı" : "güncel GPS konumu alınamıyor";
    return `${input.plate} plakalı aracın şoförü ${input.driverName} için U-ETDS seferinde ${state}.`;
  }
  if (input.phase === "missing") {
    return `${input.plate} plakalı aracınızın U-ETDS seferi için konum paylaşımı başlatılmadı.`;
  }
  return `${input.plate} plakalı aracınızın U-ETDS seferi için güncel GPS konumu alınamıyor.`;
}

export function driverReminderCopy(input: {
  phase: MobileReminderPhase;
  plate: string;
  date: string;
  start: string;
  end: string;
  pickup: string;
  dropoff: string;
}) {
  const title = input.phase === "missing"
    ? "Mobil GPS Konum Paylaşımı Başlatılmadı"
    : "Mobil GPS Konum Paylaşımı Kesildi";
  return {
    title,
    preview: `${input.plate} · ${input.date} ${input.start}`.trim(),
    body: [
      reminderLead({ phase: input.phase, plate: input.plate }),
      "",
      "Bakanlığa ATS konum bildirimlerinin doğru yapılabilmesi için lütfen Tripetica’ya girerek Konum Paylaş butonuna basın ve konum paylaşımını başlatın.",
      "",
      ...reminderFacts(input),
    ].join("\n"),
  };
}

export function ownerReminderCopy(input: {
  phase: MobileReminderPhase;
  plate: string;
  driverName: string;
  date: string;
  start: string;
  end: string;
  pickup: string;
  dropoff: string;
}) {
  const title = input.phase === "missing"
    ? "Mobil GPS Konum Paylaşımı Başlatılmadı"
    : "Mobil GPS Konum Paylaşımı Kesildi";
  return {
    title,
    preview: `${input.plate} · ${input.driverName} · ${input.start}`,
    body: [
      reminderLead({ phase: input.phase, plate: input.plate, driverName: input.driverName }),
      "",
      "Bakanlığa ATS konum bildirimlerinin doğru yapılabilmesi için lütfen Tripetica’ya girerek Konum Paylaş butonuna basın ve konum paylaşımını başlatın.",
      "",
      ...reminderFacts(input),
    ].join("\n"),
  };
}

export function reminderEmailHtml(input: { title: string; body: string }) {
  const paragraphs = input.body.split("\n").map((line) => `<p style="margin:0 0 8px">${escapeHtml(line) || "&nbsp;"}</p>`).join("");
  return `<!doctype html><html><body style="margin:0;background:#f4f6f8;font-family:Arial,sans-serif;color:#111827">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
  <table role="presentation" width="100%" style="max-width:560px;background:#fff;border:1px solid #e5e7eb;border-radius:8px">
  <tr><td style="padding:20px 24px;font-size:16px;line-height:1.45">
  <h1 style="margin:0 0 12px;font-size:18px">${escapeHtml(input.title)}</h1>
  ${paragraphs}
  </td></tr></table></td></tr></table></body></html>`;
}

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
