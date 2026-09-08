import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseOpsDriverListFilters } from "@/lib/ops/driver-filters";
import { opsCopy } from "@/lib/ops/copy";

function source(path: string) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

test("ops driver filters default to name A-Z and keep query", () => {
  assert.deepEqual(parseOpsDriverListFilters({}), { query: "", dir: "asc" });
  assert.deepEqual(parseOpsDriverListFilters({ q: " recep ", dir: "desc" }), {
    query: "recep",
    dir: "desc",
  });
  assert.equal(parseOpsDriverListFilters({ dir: "nope" }).dir, "asc");
});

test("ops global drivers reuse partner_drivers and do not create records", () => {
  const list = source("lib/ops/drivers.ts");
  const page = source("app/[locale]/ops/(panel)/drivers/page.tsx");
  const table = source("components/ops/driver-table.tsx");
  const actions = source("lib/ops/partner-fleet-actions.ts");
  assert.match(list, /JOIN partners p ON p.id = d.partner_id/);
  assert.match(list, /d.deleted_at IS NULL/);
  assert.match(list, /COLLATE "tr-x-icu"/);
  assert.match(list, /foldDriverSearchText/);
  assert.match(list, /translate\(lower/);
  assert.doesNotMatch(list, /CREATE TABLE|INSERT INTO partner_drivers/);
  assert.match(page, /partners\.view/);
  assert.doesNotMatch(page, /createPartnerDriver|Sürücü Ekle/);
  assert.match(table, /searchOpsDriversAction/);
  assert.doesNotMatch(table, /Filtrele|type="submit"/);
  assert.match(table, /\/ops\/drivers\/\$\{driver\.id\}/);
  assert.match(actions, /\/ops\/drivers/);
  assert.equal(opsCopy.tr.driverSearchPlaceholder, "Sürücü ara...");
  assert.equal(opsCopy.tr.vehicleSearchPlaceholder, "Araç ara...");
});
