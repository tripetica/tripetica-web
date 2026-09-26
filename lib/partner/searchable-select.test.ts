import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  filterSearchableSelectOptions,
  foldSearchableSelectText,
  pointerGestureExceededSlop,
  shouldPreventDefaultOnOptionPointerDown,
} from "@/lib/partner/searchable-select";

function source(path: string) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

const ACTIVE_PARTNERS = [
  { id: "a1", name: "Ada Turizm", partnerCode: "PTR-0010" },
  { id: "b2", name: "Cebrail Kiymaz", partnerCode: "PTR-0006" },
  { id: "c3", name: "Mert Ulaşım", partnerCode: "PTR-0007" },
  { id: "d4", name: "TRIPETICA LTD. ŞTİ", partnerCode: "PTR-0001" },
  { id: "e5", name: "Zeynep Transfer", partnerCode: "PTR-0012" },
] as const;

function toOptions(partners: readonly { id: string; name: string; partnerCode: string }[]) {
  return partners.map((partner) => ({
    value: partner.id,
    label: partner.partnerCode
      ? `${partner.name} · ${partner.partnerCode}`
      : partner.name,
  }));
}

test("assignment partner options keep every active non-deleted partner 1:1", () => {
  const cells = source("components/ops/reservation-assignment-cells.tsx");
  assert.match(cells, /partners\.map\(\(partner\) =>/);
  assert.doesNotMatch(cells, /partners\.filter\(/);
  assert.doesNotMatch(cells, /partners\.slice\(/);
  assert.doesNotMatch(cells, /\.slice\(0,\s*\d+/);

  const options = toOptions(ACTIVE_PARTNERS);
  assert.equal(options.length, ACTIVE_PARTNERS.length);
  assert.equal(options[0]?.value, ACTIVE_PARTNERS[0].id);
  assert.equal(options[Math.floor(options.length / 2)]?.value, ACTIVE_PARTNERS[2].id);
  assert.equal(options[options.length - 1]?.value, ACTIVE_PARTNERS[4].id);
  assert.deepEqual(
    options.map((option) => option.value),
    ACTIVE_PARTNERS.map((partner) => partner.id),
  );
});

test("ops assignment partner query only excludes inactive or soft-deleted rows", () => {
  const store = source("lib/ops/reservation-assignment.ts");
  const listFn = store.slice(
    store.indexOf("export async function listActiveOpsAssignmentPartners"),
    store.indexOf("export async function loadOpsAssignmentFleets"),
  );
  assert.match(listFn, /deleted_at IS NULL/);
  assert.match(listFn, /status = 'active'/);
  assert.doesNotMatch(listFn, /is_primary_partner\s*=\s*FALSE/);
  assert.doesNotMatch(listFn, /LIMIT\s+\d+/);
  assert.doesNotMatch(listFn, /partners\.filter|slice\(0/);
});

test("search fold treats Turkish and ASCII I variants as the same letter", () => {
  assert.equal(foldSearchableSelectText("TRIPETICA"), foldSearchableSelectText("Tripetica"));
  assert.equal(foldSearchableSelectText("TRIPETICA"), foldSearchableSelectText("tripetica"));
  assert.equal(foldSearchableSelectText("İstanbul"), foldSearchableSelectText("istanbul"));
  assert.equal(foldSearchableSelectText("Iğdır"), foldSearchableSelectText("ığdır"));
  assert.ok(foldSearchableSelectText("TRIPETICA LTD. ŞTİ").includes("tripetica"));
});

test("filter keeps all options empty query and matches first/middle/last labels", () => {
  const options = toOptions(ACTIVE_PARTNERS);
  const all = filterSearchableSelectOptions(options, "");
  assert.equal(all.length, options.length);
  assert.equal(all[0]?.label, options[0]?.label);
  assert.equal(all[2]?.label, options[2]?.label);
  assert.equal(all[4]?.label, options[4]?.label);

  assert.equal(filterSearchableSelectOptions(options, "Ada").length, 1);
  assert.equal(filterSearchableSelectOptions(options, "Mert").length, 1);
  assert.equal(filterSearchableSelectOptions(options, "Zeynep").length, 1);
});

test("TRIPETICA / Tripetica / tripetica and partner code all match the same active partner", () => {
  const options = toOptions(ACTIVE_PARTNERS);
  for (const query of ["TRIPETICA", "Tripetica", "tripetica", "TrIpEtIcA", "PTR-0001"]) {
    const matches = filterSearchableSelectOptions(options, query);
    assert.equal(matches.length, 1, query);
    assert.equal(matches[0]?.value, "d4", query);
  }
});

test("inactive or deleted partners are not part of the active options fixture contract", () => {
  const active = toOptions(ACTIVE_PARTNERS);
  const withInactive = [
    ...active,
    { value: "dead", label: "Eski Partner · PTR-9999" },
  ];
  // UI receives only what the server query returns; inactive rows never enter options.
  const serverActiveOnly = active;
  assert.equal(serverActiveOnly.length, ACTIVE_PARTNERS.length);
  assert.ok(!serverActiveOnly.some((option) => option.value === "dead"));
  assert.equal(filterSearchableSelectOptions(withInactive, "Eski").length, 1);
  assert.equal(filterSearchableSelectOptions(serverActiveOnly, "Eski").length, 0);
});

test("touch pointerdown must not preventDefault; mouse may", () => {
  assert.equal(shouldPreventDefaultOnOptionPointerDown("touch"), false);
  assert.equal(shouldPreventDefaultOnOptionPointerDown("mouse"), true);
  assert.equal(shouldPreventDefaultOnOptionPointerDown("pen"), true);
});

test("pointer gesture slop distinguishes scroll from tap", () => {
  assert.equal(
    pointerGestureExceededSlop({ startX: 10, startY: 10, x: 12, y: 12 }),
    false,
  );
  assert.equal(
    pointerGestureExceededSlop({ startX: 10, startY: 10, x: 10, y: 40 }),
    true,
  );
});

test("SearchableSelect wires fold helper and does not select on raw pointerdown", () => {
  const select = source("components/partner/searchable-select.tsx");
  assert.match(select, /filterSearchableSelectOptions/);
  assert.match(select, /shouldPreventDefaultOnOptionPointerDown/);
  assert.match(select, /pointerGestureExceededSlop/);
  assert.match(select, /onPointerUp/);
  assert.match(select, /gesture\.moved/);
  assert.doesNotMatch(
    select,
    /onPointerDown=\{\(event\) => \{\s*event\.preventDefault\(\);\s*event\.stopPropagation\(\);\s*selectOption/,
  );
  assert.match(select, /pointerType !== "touch"|shouldPreventDefaultOnOptionPointerDown/);
});
