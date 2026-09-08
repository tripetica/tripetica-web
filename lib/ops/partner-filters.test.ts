import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { opsCopy } from "@/lib/ops/copy";
import {
  nextPartnerSortDir,
  parsePartnerListFilters,
  partnerLevelRankSql,
  partnerOrderBy,
  partnerQueryRecord,
  partnerStatusRankSql,
} from "@/lib/ops/partner-filters";
import { partnerLevelLabel } from "@/lib/ops/partner-labels";

test("sort params parse and default dir to asc when sort is set", () => {
  assert.equal(parsePartnerListFilters({ sort: "code", dir: "desc" }).sort, "code");
  assert.equal(parsePartnerListFilters({ sort: "code", dir: "desc" }).dir, "desc");
  assert.equal(parsePartnerListFilters({ sort: "name" }).dir, "asc");
  assert.equal(parsePartnerListFilters({ sort: "nope" }).sort, "");
});

test("next sort dir starts at asc then toggles", () => {
  assert.equal(nextPartnerSortDir("", "", "status"), "asc");
  assert.equal(nextPartnerSortDir("status", "asc", "status"), "desc");
  assert.equal(nextPartnerSortDir("status", "desc", "status"), "asc");
  assert.equal(nextPartnerSortDir("code", "desc", "name"), "asc");
});

test("default order keeps primary partner first", () => {
  const sql = partnerOrderBy(
    { query: "", status: "", sort: "", dir: "" },
    "tr",
  );
  assert.match(sql, /is_primary_partner DESC/);
  assert.match(sql, /partner_code ASC/);
});

test("status and level order by canonical rank, not display strings", () => {
  const status = partnerOrderBy(
    { query: "", status: "", sort: "status", dir: "asc" },
    "tr",
  );
  const level = partnerOrderBy(
    { query: "", status: "", sort: "level", dir: "desc" },
    "tr",
  );
  assert.match(status, /WHEN 'pending' THEN 0/);
  assert.match(status, /WHEN 'active' THEN 1/);
  assert.match(status, /WHEN 'inactive' THEN 2/);
  assert.doesNotMatch(status, /Onay Bekliyor|Aktif|Пас/);
  assert.match(level, /is_primary_partner THEN 0/);
  assert.match(level, /priority_level = 1 THEN 1/);
  assert.match(level, /priority_level = 3 THEN 3/);
  assert.match(level, /DESC/);
  assert.doesNotMatch(level, /Ana Partner|Seviye|алфавит/);
  assert.match(partnerStatusRankSql(), /pending/);
  assert.match(partnerLevelRankSql(), /is_primary_partner/);
});

test("name order uses locale ICU collation", () => {
  assert.match(partnerOrderBy({ query: "", status: "", sort: "name", dir: "asc" }, "tr"), /tr-x-icu/);
  assert.match(partnerOrderBy({ query: "", status: "", sort: "name", dir: "asc" }, "en"), /en-x-icu/);
  assert.match(partnerOrderBy({ query: "", status: "", sort: "name", dir: "asc" }, "ru"), /ru-x-icu/);
});

test("code order uses numeric partner sequence", () => {
  const sql = partnerOrderBy(
    { query: "", status: "", sort: "code", dir: "asc" },
    "tr",
  );
  assert.match(sql, /substring\(p\.partner_code from/);
});

test("partner level label merges primary into one column", () => {
  const copy = opsCopy.tr;
  assert.equal(copy.partnerLevel, "Partner Seviyesi");
  assert.equal(
    partnerLevelLabel({ isPrimaryPartner: true, priorityLevel: null }, copy),
    "Ana Partner",
  );
  assert.equal(
    partnerLevelLabel({ isPrimaryPartner: false, priorityLevel: 2 }, copy),
    "2. Seviye",
  );
  assert.equal(
    partnerLevelLabel({ isPrimaryPartner: false, priorityLevel: null }, copy),
    "—",
  );
  assert.doesNotMatch(
    partnerLevelLabel({ isPrimaryPartner: false, priorityLevel: 1 }, copy),
    /Hayır|Ana Partner/,
  );
});

test("partner info form does not import the server-only partners module", () => {
  const form = readFileSync(
    new URL("../../components/ops/partner-info-form.tsx", import.meta.url),
    "utf8",
  );
  const view = readFileSync(new URL("./partner-view.ts", import.meta.url), "utf8");
  const detail = readFileSync(
    new URL("../../components/ops/partner-detail.tsx", import.meta.url),
    "utf8",
  );
  assert.match(form, /@\/lib\/ops\/partner-view/);
  assert.doesNotMatch(form, /@\/lib\/ops\/partners/);
  assert.doesNotMatch(view, /server-only|postgres|getPool/);
  assert.match(form, /ops-partner-sticky/);
  assert.match(form, /type="submit"/);
  assert.match(form, /formAction=\{activateAction\}/);
  assert.match(form, /copy\.deletePartner/);
  assert.match(form, /deletePartnerConfirm/);
  assert.match(form, /partnerEditorValuesEqual/);
  assert.match(form, /copy\.back/);
  assert.match(form, /PartnerFleetTable/);
  assert.doesNotMatch(form, /ops-partner-status-actions/);
  assert.doesNotMatch(form, /form="partner-profile-form"/);
  assert.match(detail, /ops-partner-detail/);
  assert.doesNotMatch(detail, /copy\.partnerCode/);
  assert.doesNotMatch(detail, /copy\.status/);
  assert.doesNotMatch(detail, /ops-partner-summary/);
  assert.doesNotMatch(detail, /ops-partner-identity/);
  assert.match(form, /ops-partner-code/);
  assert.match(form, /ops-partner-title/);
  assert.match(form, /key=\{partnerServerStamp\(props\.partner\)\}/);
  assert.doesNotMatch(form, /syncedStamp !== serverStamp/);
  assert.doesNotMatch(form, /setSyncedStamp|setBaseline\(/);
  const css = readFileSync(new URL("../../app/globals.css", import.meta.url), "utf8");
  assert.match(css, /\.ops-partner-sticky \{[\s\S]*?position: sticky/);
  assert.match(css, /\.ops-partner-tabs \{[\s\S]*?justify-content: center/);
  assert.match(css, /\.ops-partner-info \.ops-user-form,[\s\S]*?margin-inline: auto/);
});

test("partners list merges level into one sortable column", () => {
  const table = readFileSync(new URL("../../components/ops/partner-table.tsx", import.meta.url), "utf8");
  assert.match(table, /copy\.partnerLevel/);
  assert.match(table, /field="code"/);
  assert.match(table, /field="name"/);
  assert.match(table, /field="status"/);
  assert.match(table, /field="level"/);
  assert.match(table, /partnerLevelLabel/);
  assert.doesNotMatch(table, /copy\.primaryPartner/);
  assert.doesNotMatch(table, /copy\.yes/);
});

test("query record keeps search, status, and sort for pagination", () => {
  assert.deepEqual(
    partnerQueryRecord({
      query: "abc",
      status: "pending",
      sort: "level",
      dir: "desc",
    }),
    { q: "abc", status: "pending", sort: "level", dir: "desc" },
  );
});
