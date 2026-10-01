import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseOpsDriverListFilters } from "@/lib/ops/driver-filters";
import {
  assertSqlBindArity,
  buildOpsDriverListQueryPlan,
  buildPartnerDriverListQueryPlan,
  sqlPlaceholderArity,
} from "@/lib/ops/driver-list-query";
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
  const plan = source("lib/ops/driver-list-query.ts");
  const page = source("app/[locale]/ops/(panel)/drivers/page.tsx");
  const table = source("components/ops/driver-table.tsx");
  const actions = source("lib/ops/partner-fleet-actions.ts");
  assert.match(list, /buildOpsDriverListQueryPlan/);
  assert.match(list, /JOIN partners p ON p.id = d.partner_id/);
  assert.match(list, /d.deleted_at IS NULL/);
  assert.match(plan, /COLLATE "tr-x-icu"/);
  assert.match(plan, /foldDriverSearchText/);
  assert.match(plan, /translate\(lower/);
  assert.match(plan, /period_year = \$1/);
  assert.match(plan, /period_month = \$2/);
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

test("ops driver list COUNT binds 0 params when search empty (period only on list)", () => {
  const { count, list } = buildOpsDriverListQueryPlan({
    query: "",
    dir: "asc",
    page: 1,
    pageSize: 25,
    period: { year: 2026, month: 9 },
  });
  assert.equal(sqlPlaceholderArity(count.sql), 0);
  assert.equal(count.values.length, 0);
  assertSqlBindArity(count);
  assert.equal(sqlPlaceholderArity(list.sql), 6); // current period, next period, limit/offset
  assert.equal(list.values.length, 6);
  assert.deepEqual(list.values.slice(0, 4), [2026, 9, 2026, 10]);
  assertSqlBindArity(list);
  assert.match(list.sql, /period_year = \$1/);
  assert.doesNotMatch(count.sql, /\$\d+/);
  assert.doesNotMatch(count.sql, /partner_driver_uetds_subscription_periods/);
});

test("ops driver list COUNT/list bind arity stays aligned with search", () => {
  const { count, list } = buildOpsDriverListQueryPlan({
    query: "recep",
    dir: "desc",
    page: 2,
    pageSize: 25,
    period: { year: 2026, month: 10 },
  });
  assertSqlBindArity(count);
  assertSqlBindArity(list);
  assert.ok(count.values.length >= 2);
  assert.ok(list.values.length >= 4);
  assert.equal(list.values[0], 2026);
  assert.equal(list.values[1], 10);
});

test("partner driver list subscription join bind arity includes the next month", () => {
  const plan = buildPartnerDriverListQueryPlan({
    partnerId: "00000000-0000-4000-8000-000000000001",
    period: { year: 2026, month: 9 },
  });
  assertSqlBindArity(plan);
  assert.equal(plan.values.length, 5);
  assert.equal(sqlPlaceholderArity(plan.sql), 5);
  assert.deepEqual(plan.values.slice(1), [2026, 9, 2026, 10]);
  assert.match(plan.sql, /next_per.period_year = \$4/);
});
