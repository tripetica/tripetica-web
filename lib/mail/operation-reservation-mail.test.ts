import test from "node:test";
import assert from "node:assert/strict";
import { buildOperationBodies } from "@/lib/mail/operation-reservation-body";

test("operation reservation mail is Turkish and lists every passenger", () => {
  const result = buildOperationBodies({
    reservationCode: "TRP-20260904-0013",
    serviceTypeLabel: "Özel Transfer & Taksi",
    rows: [
      { label: "Rezervasyon kodu", value: "TRP-20260904-0013" },
      {
        label: "Araç sınıfı",
        value: "Standart Minivan",
        detail: "Volkswagen Caravelle veya benzeri",
      },
      { label: "Toplam tutar", value: "$70,00" },
    ],
    passengerNames: ["Recep YILDIRIM", "Ayşe YILDIRIM"],
  });

  assert.equal(
    result.subject,
    "Yeni Rezervasyon • TRP-20260904-0013 • Özel Transfer & Taksi",
  );
  assert.match(result.html, /Merhaba Tripetica Operasyon Ekibi/);
  assert.match(result.html, /Volkswagen Caravelle veya benzeri/);
  assert.match(result.html, /1\. Recep YILDIRIM/);
  assert.match(result.html, /2\. Ayşe YILDIRIM/);
  assert.match(result.text, /Toplam tutar: \$70,00/);
});

test("operation reservation mail escapes customer-controlled values", () => {
  const result = buildOperationBodies({
    reservationCode: "TRP-1",
    serviceTypeLabel: "Turlar & Rotalar",
    rows: [{ label: "Alış noktası", value: "<script>alert(1)</script>" }],
    passengerNames: ["A&B"],
  });
  assert.doesNotMatch(result.html, /<script>/);
  assert.match(result.html, /&lt;script&gt;/);
  assert.match(result.html, /A&amp;B/);
});
