const MINUTE = 60 * 1000;

export const MOBILE_REMINDER_LEAD_MS = 30 * MINUTE;
export const MOBILE_REMINDER_FRESH_MS = 2 * MINUTE;
export const MOBILE_GAP_ALERT_MS = 10 * MINUTE;

export type ReminderAudience = "driver" | "owner";

export function mobileReminderSlot(input: { startMs: number; endMs: number; nowMs: number }): number | null {
  if (!Number.isFinite(input.startMs) || !Number.isFinite(input.endMs) || input.endMs <= input.startMs) return null;
  if (input.nowMs < input.startMs - MOBILE_REMINDER_LEAD_MS || input.nowMs >= input.endMs) return null;
  let slot: number | null = null;
  for (let at = input.startMs - MOBILE_REMINDER_LEAD_MS; at <= input.startMs - 10 * MINUTE; at += 10 * MINUTE) {
    if (at <= input.nowMs) slot = at;
  }
  for (let at = input.startMs - 5 * MINUTE; at < input.endMs; at += 5 * MINUTE) {
    if (at <= input.nowMs) slot = at;
  }
  return slot;
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

export function mobileGapAlert(input: {
  shareEnabled: boolean;
  lastReceivedAtMs: number | null;
  nowMs: number;
  tripOpen: boolean;
}): { send: true; anchorMs: number } | { send: false; reason: "inactive" | "never" | "grace" } {
  if (!input.shareEnabled || !input.tripOpen) return { send: false, reason: "inactive" };
  if (input.lastReceivedAtMs == null || !Number.isFinite(input.lastReceivedAtMs)) return { send: false, reason: "never" };
  if (input.nowMs - input.lastReceivedAtMs < MOBILE_GAP_ALERT_MS) return { send: false, reason: "grace" };
  return { send: true, anchorMs: input.lastReceivedAtMs };
}

export function driverGapCopy(input: { plate: string; lastFix: string }) {
  return {
    title: "Tripetica – GPS Bağlantı Uyarısı",
    preview: `${input.plate} · Son konum ${input.lastFix}`,
    body: [
      `${input.plate} plakalı aracınızdan 10 dakikadır güncel konum alınamıyor.`,
      `Son konum: ${input.lastFix}`,
      "Konum paylaşımınız açık görünüyor, ancak veri akışı durmuş. Lütfen internet ve konum izinlerini kontrol edin. Gerekirse Konum Paylaşmayı Durdur butonuna basıp yeniden Konum Paylaş ile başlatın.",
      "ATS veri gönderimi için güncel GPS paylaşımının sürdürülmesi gereklidir.",
    ].join("\n"),
  };
}

export function ownerGapCopy(input: { plate: string; driverName: string; lastFix: string; start: string; end: string; pickup: string; dropoff: string }) {
  return {
    title: "Tripetica – GPS Bağlantı Uyarısı",
    preview: `${input.plate} · ${input.driverName} · Son konum ${input.lastFix}`,
    body: [
      `${input.plate} plakalı aracınızın şoförü ${input.driverName} için konum paylaşımı açık görünüyor, ancak 10 dakikadır güncel konum alınamıyor.`,
      `Son konum: ${input.lastFix}`,
      `Başlangıç: ${input.start}`,
      `Bitiş: ${input.end}`,
      `Alış: ${input.pickup || "—"}`,
      `Bırakış: ${input.dropoff || "—"}`,
      "Veri akışının neden durduğu bu kayıttan kesin olarak bilinmiyor. ATS veri gönderimi için güncel GPS paylaşımının sürdürülmesi gereklidir.",
    ].join("\n"),
  };
}

export function ownerIsDriver(input: { driverEmail: string | null; ownerEmail: string | null }) {
  const driver = input.driverEmail?.trim().toLowerCase() ?? "";
  const owner = input.ownerEmail?.trim().toLowerCase() ?? "";
  return driver.length > 0 && driver === owner;
}

export function driverReminderCopy(input: { plate: string; start: string; end: string; pickup: string; dropoff: string }) {
  return {
    title: "Tripetica – Mobil GPS / ATS Uyarısı",
    preview: `Seferiniz için güncel konum alınamıyor. ${input.plate} · ${input.start}`,
    body: [
      "Seferiniz için güncel konum alınamıyor. ATS veri gönderimi için konum paylaşımınızın aktif olması ve güncel GPS verisinin sisteme ulaşması gereklidir.",
      "",
      `Plaka: ${input.plate}`,
      `Başlangıç: ${input.start}`,
      `Bitiş: ${input.end}`,
      `Alış: ${input.pickup || "—"}`,
      `Bırakış: ${input.dropoff || "—"}`,
    ].join("\n"),
  };
}

export function ownerReminderCopy(input: { plate: string; driverName: string; start: string; end: string; pickup: string; dropoff: string }) {
  return {
    title: "Tripetica – Şoför Konum Uyarısı",
    preview: `${input.plate} · ${input.driverName} · ${input.start}`,
    body: [
      `${input.plate} plakalı aracınızın şoförü ${input.driverName} için tanımlı seferde güncel GPS konumu alınamıyor. ATS veri gönderiminin aksamaması için lütfen konum paylaşımını kontrol ettiriniz.`,
      "",
      `Başlangıç: ${input.start}`,
      `Bitiş: ${input.end}`,
      `Alış: ${input.pickup || "—"}`,
      `Bırakış: ${input.dropoff || "—"}`,
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
