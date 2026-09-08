import test from "node:test";
import assert from "node:assert/strict";
import {
  isPartnerTaxNumberValid,
  parsePartnerApplicationInput,
  partnerRegisterTaxIdMaxLength,
} from "@/lib/partner/application-fields";

const valid = {
  email: "partner@example.com",
  phoneCountryCode: "TR",
  phoneNational: "532 123 45 67",
  contactFirstName: "Ahmet",
  contactLastName: "Yılmaz",
  businessType: "company",
  name: "ABC Turizm",
  addressLine: "Tesvikiye Mah. Test Sok. No:1 Şişli / İstanbul",
  countryCode: "DE",
  taxOffice: "Şişli",
  taxNumber: "1234567890",
  password: "12345678",
  confirmPassword: "12345678",
  lockCountryToDefault: true,
  strictRegisterTaxId: true,
};

test("register application locks country to TR and accepts 8-char password", () => {
  const parsed = parsePartnerApplicationInput(valid);
  assert.equal(parsed.ok, true);
  if (parsed.ok) {
    assert.equal(parsed.value.countryCode, "TR");
    assert.equal(parsed.value.phoneCountryCode, "TR");
    assert.match(parsed.value.phone, /^\+90/);
  }
});

test("7-character password is rejected and 8 is accepted", () => {
  assert.equal(
    parsePartnerApplicationInput({ ...valid, password: "1234567", confirmPassword: "1234567" }).ok,
    false,
  );
  assert.equal(
    parsePartnerApplicationInput({ ...valid, password: "12345678", confirmPassword: "12345678" }).ok,
    true,
  );
});

test("Turkey tax numbers accept 10-11 digits without blocking foreign formats later", () => {
  assert.equal(isPartnerTaxNumberValid("TR", "1234567890"), true);
  assert.equal(isPartnerTaxNumberValid("TR", "12345678901"), true);
  assert.equal(isPartnerTaxNumberValid("TR", "12345"), false);
  assert.equal(isPartnerTaxNumberValid("DE", "DE123456789"), true);
});

test("register tax id is exactly 11 digits for individual and 10 for company", () => {
  assert.equal(isPartnerTaxNumberValid("TR", "12345678901", "individual"), true);
  assert.equal(isPartnerTaxNumberValid("TR", "1234567890", "individual"), false);
  assert.equal(isPartnerTaxNumberValid("TR", "123456789012", "individual"), false);
  assert.equal(isPartnerTaxNumberValid("TR", "1234567890a", "individual"), false);
  assert.equal(isPartnerTaxNumberValid("TR", "1234567890", "company"), true);
  assert.equal(isPartnerTaxNumberValid("TR", "123456789", "company"), false);
  assert.equal(isPartnerTaxNumberValid("TR", "12345678901", "company"), false);
  assert.equal(isPartnerTaxNumberValid("TR", "123456789a", "company"), false);

  const shortCompany = parsePartnerApplicationInput({
    ...valid,
    taxNumber: "123456789",
  });
  assert.equal(shortCompany.ok, false);
  if (!shortCompany.ok) {
    assert.equal(shortCompany.error, "invalid-tax-number");
  }

  const shortIndividual = parsePartnerApplicationInput({
    ...valid,
    businessType: "individual",
    taxNumber: "1234567890",
  });
  assert.equal(shortIndividual.ok, false);
  if (!shortIndividual.ok) {
    assert.equal(shortIndividual.error, "invalid-national-id");
  }

  const validIndividual = parsePartnerApplicationInput({
    ...valid,
    businessType: "individual",
    taxNumber: "12345678901",
  });
  assert.equal(validIndividual.ok, true);
  if (validIndividual.ok) {
    assert.equal(validIndividual.value.taxNumber, "12345678901");
  }

  assert.equal(partnerRegisterTaxIdMaxLength("individual"), 11);
  assert.equal(partnerRegisterTaxIdMaxLength("company"), 10);
  assert.equal(partnerRegisterTaxIdMaxLength(""), 11);

  const opsIndividualTen = parsePartnerApplicationInput({
    ...valid,
    businessType: "individual",
    taxNumber: "1234567890",
    strictRegisterTaxId: false,
  });
  assert.equal(opsIndividualTen.ok, true);
});
