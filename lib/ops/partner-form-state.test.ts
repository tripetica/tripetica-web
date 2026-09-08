import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  partnerEditorValuesEqual,
  partnerProfileFieldsFromForm,
  type PartnerEditorValues,
} from "@/lib/ops/partner-form-state";

const base: PartnerEditorValues = {
  email: "partner@example.com",
  phoneCountry: "TR",
  phoneNational: "5321234567",
  contactName: "Recep YILDIRIM",
  businessType: "company",
  name: "ABC Turizm",
  addressLine: "Tesvikiye",
  countryCode: "TR",
  taxOffice: "Şişli",
  taxNumber: "1234567890",
  priorityLevel: "2",
};

test("dirty state clears when edited values return to the saved baseline", () => {
  assert.equal(partnerEditorValuesEqual(base, base), true);
  assert.equal(
    partnerEditorValuesEqual(base, { ...base, email: "other@example.com" }),
    false,
  );
  assert.equal(
    partnerEditorValuesEqual(base, { ...base, priorityLevel: "3" }),
    false,
  );
  assert.equal(
    partnerEditorValuesEqual(base, { ...base, email: "  partner@example.com  " }),
    true,
  );
  assert.equal(
    partnerEditorValuesEqual(base, { ...base, contactName: "Recep  YILDIRIM" }),
    true,
  );
});

test("save form data includes selected partner priority level", () => {
  const formData = new FormData();
  formData.set("email", "partner@example.com");
  formData.set("phoneCountryCode", "TR");
  formData.set("phoneNational", "5321234567");
  formData.set("contactName", "Recep YILDIRIM");
  formData.set("businessType", "company");
  formData.set("name", "ABC Turizm");
  formData.set("addressLine", "Tesvikiye");
  formData.set("countryCode", "TR");
  formData.set("taxOffice", "Şişli");
  formData.set("taxNumber", "1234567890");
  formData.set("priorityLevel", "1");
  assert.deepEqual(partnerProfileFieldsFromForm(formData), {
    email: "partner@example.com",
    phoneCountryCode: "TR",
    phoneNational: "5321234567",
    contactFirstName: "Recep",
    contactLastName: "YILDIRIM",
    businessType: "company",
    name: "ABC Turizm",
    addressLine: "Tesvikiye",
    countryCode: "TR",
    taxOffice: "Şişli",
    taxNumber: "1234567890",
    priorityLevel: "1",
  });
});

test("ops partner save writes priority_level and has no extra approval step", () => {
  const partners = readFileSync(new URL("./partners.ts", import.meta.url), "utf8");
  const actions = readFileSync(new URL("./partner-actions.ts", import.meta.url), "utf8");
  const form = readFileSync(
    new URL("../../components/ops/partner-info-form.tsx", import.meta.url),
    "utf8",
  );
  assert.match(actions, /partnerProfileFieldsFromForm/);
  assert.match(partners, /is_primary_partner = \$12/);
  assert.match(partners, /priority_level = \$13/);
  assert.match(partners, /updated_at = NOW\(\)/);
  assert.match(actions, /getOpsPartner\(partnerId\)/);
  assert.match(actions, /priority-not-persisted/);
  assert.match(actions, /status-not-active/);
  assert.match(form, /name="priorityLevel"/);
  assert.match(form, /copy\.primaryPartner/);
  assert.match(form, /type="submit"/);
  assert.doesNotMatch(form, /approval|onayla|approvePartner/i);
  assert.doesNotMatch(form, /type="checkbox"/);
});
