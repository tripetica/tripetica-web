import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  PARTNER_PRIMARY_FORM_VALUE,
  canOfferPrimaryPriority,
  parsePartnerPriorityFormValue,
  partnerPriorityFormValue,
  partnerPrioritySelectValues,
} from "@/lib/ops/partner-priority";

function source(path: string) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

test("Ana Partner is a selectable form value and maps to is_primary_partner", () => {
  assert.equal(PARTNER_PRIMARY_FORM_VALUE, "primary");
  assert.deepEqual(parsePartnerPriorityFormValue(""), {
    ok: true,
    isPrimary: false,
    level: null,
  });
  assert.deepEqual(parsePartnerPriorityFormValue("primary"), {
    ok: true,
    isPrimary: true,
    level: null,
  });
  assert.deepEqual(parsePartnerPriorityFormValue("1"), {
    ok: true,
    isPrimary: false,
    level: 1,
  });
  assert.equal(parsePartnerPriorityFormValue("10").ok, false);
  assert.equal(
    partnerPriorityFormValue({ isPrimaryPartner: true, priorityLevel: null }),
    "primary",
  );
  assert.equal(
    partnerPriorityFormValue({ isPrimaryPartner: false, priorityLevel: 2 }),
    "2",
  );
});

test("Ana Partner option is a single slot shared across partners", () => {
  const empty = { partnerId: "a", primaryPartnerId: null };
  const holder = { partnerId: "a", primaryPartnerId: "a" };
  const other = { partnerId: "b", primaryPartnerId: "a" };
  assert.equal(canOfferPrimaryPriority(empty), true);
  assert.equal(canOfferPrimaryPriority(holder), true);
  assert.equal(canOfferPrimaryPriority(other), false);
  assert.deepEqual(partnerPrioritySelectValues(empty), ["", "primary", "1", "2", "3"]);
  assert.deepEqual(partnerPrioritySelectValues(holder), ["", "primary", "1", "2", "3"]);
  assert.deepEqual(partnerPrioritySelectValues(other), ["", "1", "2", "3"]);
});

test("ops partner editor always exposes the priority dropdown including Ana Partner", () => {
  const form = source("components/ops/partner-info-form.tsx");
  const partners = source("lib/ops/partners.ts");
  const actions = source("lib/ops/partner-actions.ts");
  assert.match(form, /partnerPrioritySelectValues/);
  assert.match(form, /copy\.primaryPartner/);
  assert.match(form, /PARTNER_PRIMARY_FORM_VALUE/);
  assert.doesNotMatch(form, /!partner\.isPrimaryPartner \? \(/);
  assert.match(partners, /is_primary_partner = \$12/);
  assert.match(partners, /partners_one_primary_uidx/);
  assert.match(partners, /pg_advisory_xact_lock/);
  assert.match(actions, /primary-taken/);
  assert.match(actions, /primary-not-persisted/);
});
