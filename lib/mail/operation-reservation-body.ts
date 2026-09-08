export type OperationSummaryRow = {
  label: string;
  value: string;
  detail?: string;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function buildOperationBodies(input: {
  reservationCode: string;
  serviceTypeLabel: string;
  rows: OperationSummaryRow[];
  passengerNames: string[];
}) {
  const subject = `Yeni Rezervasyon • ${input.reservationCode} • ${input.serviceTypeLabel}`;
  const rowsHtml = input.rows
    .map(
      (row) => `
        <tr>
          <td style="padding:8px 0;color:#667085;font-size:14px;vertical-align:top;width:38%;">${escapeHtml(row.label)}</td>
          <td style="padding:8px 0;color:#172033;font-size:14px;font-weight:600;vertical-align:top;">
            ${escapeHtml(row.value)}
            ${row.detail ? `<div style="margin-top:3px;color:#667085;font-size:12px;font-weight:400;line-height:1.4;">${escapeHtml(row.detail)}</div>` : ""}
          </td>
        </tr>`,
    )
    .join("");
  const passengersHtml = input.passengerNames
    .map(
      (name, index) =>
        `<li style="margin:0 0 6px;">${index + 1}. ${escapeHtml(name)}</li>`,
    )
    .join("");
  const html = `<!DOCTYPE html>
<html lang="tr">
<body style="margin:0;padding:0;background:#f4f6fa;">
  <div style="max-width:640px;margin:0 auto;padding:24px 16px;font-family:Arial,Helvetica,sans-serif;color:#172033;">
    <div style="background:#ffffff;border-radius:12px;padding:28px 24px;">
      <p style="margin:0 0 12px;font-size:16px;">Merhaba Tripetica Operasyon Ekibi,</p>
      <p style="margin:0 0 20px;font-size:14px;line-height:1.5;">Tripetica web sitesi üzerinden yeni bir rezervasyon oluşturuldu. Operasyon için gerekli temel bilgiler aşağıdadır.</p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
        ${rowsHtml}
      </table>
      <hr style="border:none;border-top:1px solid #d8dee8;margin:24px 0;" />
      <h2 style="margin:0 0 12px;font-size:18px;color:#142e5c;">Yolcular</h2>
      <ol style="margin:0;padding:0;list-style:none;font-size:14px;line-height:1.5;">
        ${passengersHtml}
      </ol>
    </div>
  </div>
</body>
</html>`;
  const rowsText = input.rows
    .map(
      (row) =>
        `${row.label}: ${row.value}${row.detail ? `\n  ${row.detail}` : ""}`,
    )
    .join("\n");
  const passengersText = input.passengerNames
    .map((name, index) => `${index + 1}. ${name}`)
    .join("\n");
  const text = `Merhaba Tripetica Operasyon Ekibi,

Tripetica web sitesi üzerinden yeni bir rezervasyon oluşturuldu. Operasyon için gerekli temel bilgiler aşağıdadır.

${rowsText}

Yolcular
${passengersText}`;
  return { subject, html, text };
}
