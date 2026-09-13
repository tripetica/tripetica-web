import assert from "node:assert/strict";
import test from "node:test";
import {
  hasArabicScript,
  prepareArabicVoucherText,
  shapeArabicLine,
} from "@/lib/booking/voucher-pdf-arabic";

test("Arabic shaping joins letters instead of leaving isolated forms", () => {
  const visual = shapeArabicLine("نقطة");
  assert.notEqual(visual, "نقطة");
  assert.match(visual, /[\uFB50-\uFDFF\uFE70-\uFEFF]/);
  assert.equal(hasArabicScript("نقطة الانطلاق"), true);
  assert.equal(hasArabicScript("TK 123"), false);
});

test("Arabic + LTR reservation code keeps the code readable", () => {
  const visual = shapeArabicLine("رمز الحجز TPT-AR-1001");
  assert.match(visual, /TPT-AR-1001/);
  // Visual order starts with the leftmost glyph, not the first logical letter.
  assert.notEqual(visual[0], "ر");
});

test("LTR Ops values keep airport codes on the Latin side of mixed strings", () => {
  const ist = shapeArabicLine("مطار إسطنبول (IST)", "ltr");
  const saw = shapeArabicLine("مطار صبيحة كوكجن (SAW)", "ltr");
  const flight = shapeArabicLine("رقم الرحلة TK1925", "ltr");
  assert.match(ist, /\(IST\)/);
  assert.match(saw, /\(SAW\)/);
  assert.match(flight, /TK1925/);
  assert.match(ist, /\(IST\)$/);
  assert.match(saw, /\(SAW\)$/);
  assert.match(flight, /TK1925$/);
  assert.notEqual(ist[0], "(");
});

test("long Arabic policy wraps into multiple visual lines", () => {
  const body =
    "يمكن إلغاء الحجز أو تغييره ما دام قد تبقّى أكثر من 6 ساعات على بدء الخدمة.";
  const wrapped = prepareArabicVoucherText(
    body,
    { width: 180 },
    (value) => value.length * 6,
  );
  assert.ok(wrapped.includes("\n"));
  assert.ok(wrapped.split("\n").every((line) => line.length > 0));
});
