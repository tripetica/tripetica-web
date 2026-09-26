import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { extractUetdsSoapPdfBytes } from "@/lib/uetds/ministry-pdf-parse";

function source(path: string) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

test("official V15 seferDetayCiktisiAl is the Ministry PDF operation", () => {
  const env = source("lib/uetds/ministry-env.ts");
  assert.match(env, /seferDetayCiktisiAl/);
  const pdf = source("lib/uetds/ministry-pdf.ts");
  assert.match(pdf, /seferDetayCiktisiAl/);
  assert.match(pdf, /uetdsSeferReferansNo/);
  assert.match(pdf, /sonucpdf/i);
  assert.match(pdf, /loadUetdsMinistryCredentials/);
  assert.doesNotMatch(pdf, /buildOpsRecordPdf|pdfkit|Tripetica U-ETDS Bildirim Belgesi/);
  assert.match(source("app/[locale]/partner/(panel)/uetds/notifications/[id]/pdf/route.ts"), /loadAuthorizedUetdsMinistryPdf/);
  assert.match(source("app/[locale]/ops/(panel)/uetds/notifications/[id]/pdf/route.ts"), /uetds\.view/);
  assert.match(source("app/[locale]/partner/(panel)/uetds/notifications/[id]/pdf/route.ts"), /actor\.partnerId/);
});

test("Ministry PDF bytes are accepted only when they are a real PDF", () => {
  const pdf = extractUetdsSoapPdfBytes(Buffer.from("%PDF-1.4 test", "utf8").toString("base64"));
  assert.equal(pdf?.subarray(0, 4).toString("latin1"), "%PDF");
  assert.equal(extractUetdsSoapPdfBytes("not-a-pdf"), null);
  assert.equal(extractUetdsSoapPdfBytes(""), null);
});
