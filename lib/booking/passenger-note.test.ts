import test from "node:test";
import assert from "node:assert/strict";
import { passengerNoteText } from "@/lib/booking/passenger-note";
import { voucherCopy } from "@/lib/booking/voucher-copy";
import { readFileSync } from "node:fs";

test("passenger note keeps multiline text and drops empty values", () => {
  assert.equal(passengerNoteText(null), null);
  assert.equal(passengerNoteText(undefined), null);
  assert.equal(passengerNoteText(""), null);
  assert.equal(passengerNoteText("   \n  "), null);
  assert.equal(
    passengerNoteText("Terminal 1 kapısı\nPlease call +1-555-0017"),
    "Terminal 1 kapısı\nPlease call +1-555-0017",
  );
  assert.equal(
    passengerNoteText("  İlk satır\r\nİkinci satır  "),
    "İlk satır\nİkinci satır",
  );
});

test("voucher copy uses passenger note labels without mixing other notes", () => {
  assert.equal(voucherCopy.tr.passengerNote, "Yolcu Notu");
  assert.equal(voucherCopy.en.passengerNote, "Passenger Note");
  assert.equal(voucherCopy.ru.passengerNote, "Заметка пассажира");
  const pdf = readFileSync(new URL("./reservation-voucher-pdf.ts", import.meta.url), "utf8");
  assert.match(pdf, /copy\.passengerNote/);
  assert.match(pdf, /data\.passengerNote/);
  const access = readFileSync(
    new URL("./reservation-voucher-access.ts", import.meta.url),
    "utf8",
  );
  assert.match(access, /r\.notes/);
  assert.match(access, /passengerNoteText\(row\.notes\)/);
});
