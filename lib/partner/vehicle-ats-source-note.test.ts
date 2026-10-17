import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { partnerCopy } from "@/lib/partner/copy";

const detail = readFileSync(new URL("../../components/partner/vehicle-detail.tsx", import.meta.url), "utf8");
const opsForm = readFileSync(new URL("../../components/ops/partner-vehicle-form.tsx", import.meta.url), "utf8");
const field = readFileSync(new URL("../../components/ops/ats-ministry-source-field.tsx", import.meta.url), "utf8");

test("partner vehicle detail shows the status and a mobile-only note", () => {
  assert.doesNotMatch(detail, /atsSourceTitle/);
  assert.match(detail, /copy\.atsSourceStatusPhysical/);
  assert.match(detail, /copy\.atsSourceStatusMobile/);
  assert.match(detail, /copy\.atsSourceStatusNone/);
  assert.match(detail, /atsSource === "mobile" \?/);
  assert.match(detail, /copy\.atsSourceMobileNotice/);
  assert.doesNotMatch(detail, /atsSourceDescription/);
  assert.equal(
    partnerCopy.tr.atsSourceMobileNotice,
    "Bilgilendirme: Mobil GPS konum doğruluğu ve sürekliliği, sürücünün telefon ayarlarına ve konum paylaşımına bağlıdır. Fiziksel GPS cihazıyla aynı düzeyde güvenilirlik garanti edilemez.",
  );
});

test("the operations source field still explains the choice", () => {
  assert.match(opsForm, /copy\.atsSourceTitle/);
  assert.match(opsForm, /description: copy\.atsSourceDescription/);
  assert.match(field, /labels\.description/);
  assert.doesNotMatch(opsForm, /atsSourceMobileNotice/);
});
