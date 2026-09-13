import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { listRowNumber } from "@/lib/ops/format";

function source(path: string) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

test("list row numbers follow the filtered page offset", () => {
  assert.equal(listRowNumber(1, 25, 0), 1);
  assert.equal(listRowNumber(1, 25, 9), 10);
  assert.equal(listRowNumber(1, 20, 19), 20);
  assert.equal(listRowNumber(2, 20, 0), 21);
  assert.equal(listRowNumber(2, 20, 19), 40);
  assert.equal(listRowNumber(5, 25, 0), 101);
  assert.equal(listRowNumber(0, 25, 0), 1);
  assert.equal(listRowNumber(1, 0, 0), 1);
});

test("ops process and reservation tables show a compact # column after the checkbox", () => {
  const processTable = source("components/ops/process-table.tsx");
  const reservationTable = source("components/ops/reservation-table.tsx");
  const processPage = source("app/[locale]/ops/(panel)/processes/page.tsx");
  const reservationPage = source("app/[locale]/ops/(panel)/reservations/page.tsx");

  for (const table of [processTable, reservationTable]) {
    assert.match(table, /listRowNumber\(/);
    assert.match(table, /ops-row-num-col/);
    assert.match(table, /copy\.driverRowIndex/);
    const header = table.slice(table.indexOf("<thead>"), table.indexOf("</thead>"));
    const checkbox = header.indexOf('type="checkbox"');
    const rowNum = header.indexOf("ops-row-num-col");
    const transferAt = header.indexOf("copy.transferAt");
    assert.equal(checkbox > 0, true);
    assert.equal(rowNum > 0, true);
    assert.equal(transferAt > 0, true);
    assert.equal(checkbox < rowNum, true);
    assert.equal(rowNum < transferAt, true);
  }

  assert.match(processPage, /page=\{page\}/);
  assert.match(processPage, /pageSize=\{pageSize\}/);
  assert.match(reservationPage, /page=\{page\}/);
  assert.match(reservationPage, /pageSize=\{pageSize\}/);
  assert.match(processTable, /copy\.kilometre/);
  assert.match(processTable, /item\.flightCode/);
  assert.match(processTable, /item\.distanceKm/);
  assert.doesNotMatch(processTable, /from \"@\/lib\/ops\/process-list-display\"/);
});
