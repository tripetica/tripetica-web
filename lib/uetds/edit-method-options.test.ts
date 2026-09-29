import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { uetdsFormCopy } from "@/lib/uetds/copy";
import {
  showUetdsAiEditMethod,
  uetdsEditMethodOptionIds,
  uetdsEditMethodSeferNo,
} from "@/lib/uetds/edit-method-options";

function source(relative: string) {
  return readFileSync(join(process.cwd(), relative), "utf8");
}

test("Gold edit methods are AI, form, then e-Devlet; Standard omits AI", () => {
  assert.deepEqual(uetdsEditMethodOptionIds(true), ["ai", "form", "edevlet"]);
  assert.deepEqual(uetdsEditMethodOptionIds(false), ["form", "edevlet"]);
  assert.equal(showUetdsAiEditMethod(), false);
});

test("Sefer No prefers the ministry reference, then firma sefer number, never a placeholder", () => {
  assert.equal(
    uetdsEditMethodSeferNo({ ministryReference: " 987654 ", firmaSeferNo: "TRP-1" }),
    "987654",
  );
  assert.equal(
    uetdsEditMethodSeferNo({ ministryReference: "", firmaSeferNo: " TRP-22 " }),
    "TRP-22",
  );
  assert.equal(uetdsEditMethodSeferNo({ ministryReference: "  ", firmaSeferNo: " " }), null);
  assert.equal(uetdsEditMethodSeferNo({}), null);
  assert.doesNotMatch(JSON.stringify(uetdsFormCopy.tr.editMethodSeferNo), /XXXXXXXX/);
});

test("Turkish edit-method copy matches the method cards and colors only the consequence phrase", () => {
  const copy = uetdsFormCopy.tr;
  assert.equal(copy.editMethodAiTitle, "Tripetica AI ile düzenle");
  assert.equal(
    copy.editMethodAiBody,
    "Tripetica AI, onayınızla Kamu Uygulama Merkezi’ne giriş yaparak ilgili seferde gerekli güncellemeleri yapacaktır.",
  );
  assert.equal(copy.editMethodFormTitle, "Tripetica Bildirim Formu üzerinden düzenle");
  assert.equal(
    copy.editMethodFormBody,
    "Mevcut bildirimi Tripetica Bildirim Formu üzerinden düzenleyerek U-ETDS’ye güncelleyebilirsiniz.",
  );
  assert.equal(copy.editMethodEdevletTitle, "e-Devlet üzerinden manuel düzenle");
  assert.equal(
    copy.editMethodEdevletBody,
    "Kamu Uygulama Merkezi’ne e-Devlet hesabınızla giriş yaparak ilgili seferi bulabilir ve gerekli değişiklikleri manuel olarak kendiniz yapabilirsiniz.",
  );
  assert.equal(copy.editMethodSeferNo, "İşlem yapılacak Sefer No: {seferNo}");
  assert.equal(copy.editMethodPassengerUpdatePrefix, "Mevcut yolcu bilgileri güncellendiğinde");
  assert.equal(copy.editMethodNotifyUnchanged, "Son Yolcu Bildirim Tarih/Saat değişmez.");
  assert.equal(copy.editMethodNotifyChanged, "Son Yolcu Bildirim Tarih/Saat değişir.");
});

test("modal keeps form navigation and e-Devlet popup, and does not start AI automation", () => {
  const modal = source("components/uetds/uetds-edit-method-modal.tsx");
  const css = source("app/globals.css");
  assert.match(modal, /uetdsEditMethodOptionIds\(showAiEdit\)/);
  assert.match(modal, /href=\{formHref\}/);
  assert.match(modal, /window\.open\(edevletUrl, "_blank"\)/);
  assert.match(modal, /kamuPopupBlocked/);
  assert.match(modal, /is-positive-green/);
  assert.match(modal, /is-attention-amber/);
  assert.match(modal, /is-neutral-teal/);
  assert.doesNotMatch(modal, /extractAi|gpt-5\.6-luna|kamuYolcuGuncelle|localStorage/);
  assert.match(css, /\.uetds-edit-method-emphasis\.is-positive-green/);
  assert.match(css, /\.uetds-edit-method-emphasis\.is-attention-amber/);
  assert.match(css, /\.uetds-edit-method-emphasis\.is-neutral-teal/);
  assert.doesNotMatch(css, /\.uetds-edit-method-option\.is-positive-green|\.uetds-edit-method-option\.is-attention-amber/);

  const detail = source("components/uetds/uetds-notification-detail.tsx");
  assert.match(detail, /uetdsEditMethodSeferNo\(\{[\s\S]*ministryReference: seferRef[\s\S]*firmaSeferNo/);
  assert.match(detail, /showAiEdit=\{showAiEdit\}/);
  for (const page of [
    "app/[locale]/ops/(panel)/uetds/notifications/[id]/page.tsx",
    "app/[locale]/partner/(panel)/uetds/notifications/[id]/page.tsx",
  ]) {
    const text = source(page);
    assert.match(text, /showAiEdit=\{showUetdsAiEditMethod\(\)\}/);
    assert.doesNotMatch(text, /localStorage|sessionStorage/);
  }
});
