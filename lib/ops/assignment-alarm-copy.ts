import { missingAssignmentParts, type MissingAssignmentPart } from "@/lib/ops/assignment-completeness";
import type { AssignmentAlarmUrgency } from "@/lib/ops/assignment-alarm-slots";

const PART_LABELS: Record<MissingAssignmentPart, string> = {
  partner: "Partner",
  driver: "Şoför",
  vehicle: "Araç",
};

export function formatMissingAssignmentLabel(
  parts: readonly MissingAssignmentPart[],
) {
  if (parts.length === 0) {
    return "Eksik yok";
  }
  return `Eksik: ${parts.map((part) => PART_LABELS[part]).join(" + ")}`;
}

export function formatRemainingMinutes(remainingMs: number) {
  return Math.max(1, Math.round(remainingMs / 60000));
}

export function buildAssignmentAlarmEmail(input: {
  reservationCode: string;
  remainingMs: number;
  urgency: AssignmentAlarmUrgency;
  pickupAtLabel: string;
  serviceTypeLabel: string;
  pickup: string;
  dropoff: string;
  vehicleClass: string;
  customerName: string;
  missing: readonly MissingAssignmentPart[];
  opsHref: string | null;
}) {
  const minutes = formatRemainingMinutes(input.remainingMs);
  const missingLabel = formatMissingAssignmentLabel(input.missing);
  const subject =
    input.urgency === "urgent"
      ? `🚨 ACİL: Operasyon Ataması Eksik — ${input.reservationCode} — ${minutes} dk kaldı`
      : `⚠️ Operasyon Ataması Eksik — ${input.reservationCode} — ${minutes} dk kaldı`;
  const rows = [
    ["Rezervasyon kodu", input.reservationCode],
    ["Tarih / saat", input.pickupAtLabel],
    ["Kalan süre", `${minutes} dakika`],
    ["Hizmet", input.serviceTypeLabel],
    ["Alış", input.pickup],
    ["Bırakış", input.dropoff],
    ["Araç sınıfı", input.vehicleClass],
    ["Yolcu", input.customerName],
    ["Eksik operasyon", missingLabel],
  ];
  const textRows = rows.map(([label, value]) => `${label}: ${value}`).join("\n");
  const opsLine = input.opsHref
    ? `\nOps: ${input.opsHref}`
    : "";
  const text = `Operasyon ataması eksik.

${textRows}${opsLine}`;
  const rowsHtml = rows
    .map(
      ([label, value]) =>
        `<tr><td style="padding:6px 0;color:#667085;width:38%;">${escapeHtml(label)}</td><td style="padding:6px 0;font-weight:600;">${escapeHtml(value)}</td></tr>`,
    )
    .join("");
  const opsHtml = input.opsHref
    ? `<p style="margin:16px 0 0;"><a href="${escapeHtml(input.opsHref)}">Ops rezervasyon detayı</a></p>`
    : "";
  const html = `<!DOCTYPE html>
<html lang="tr"><body style="margin:0;padding:0;background:#f4f6fa;">
<div style="max-width:640px;margin:0 auto;padding:24px 16px;font-family:Arial,Helvetica,sans-serif;color:#172033;">
<div style="background:#fff;border-radius:12px;padding:24px;">
<p style="margin:0 0 12px;">Operasyon ataması eksik.</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0">${rowsHtml}</table>
${opsHtml}
</div></div></body></html>`;
  return { subject, text, html, missingLabel };
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function describeMissingFromState(
  missing: readonly MissingAssignmentPart[],
) {
  return formatMissingAssignmentLabel(missing);
}

export { missingAssignmentParts };
