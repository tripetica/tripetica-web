import test from "node:test";
import assert from "node:assert/strict";
import {
  joinPartnerContactName,
  partnerContactNamesFromForm,
  splitPartnerContactName,
} from "@/lib/partner/contact-name";

test("split maps a single full name onto first and last columns", () => {
  assert.deepEqual(splitPartnerContactName("  Recep   YILDIRIM "), {
    contactFirstName: "Recep",
    contactLastName: "YILDIRIM",
  });
  assert.deepEqual(splitPartnerContactName("Ayşe Nur Yılmaz"), {
    contactFirstName: "Ayşe Nur",
    contactLastName: "Yılmaz",
  });
  assert.equal(splitPartnerContactName("Recep"), null);
  assert.equal(splitPartnerContactName("   "), null);
});

test("unchanged ops contact name keeps the stored first/last split", () => {
  const formData = new FormData();
  formData.set("contactName", "Ayşe Nur Yılmaz");
  formData.set("contactFirstName", "Ayşe Nur");
  formData.set("contactLastName", "Yılmaz");
  assert.deepEqual(partnerContactNamesFromForm(formData), {
    contactFirstName: "Ayşe Nur",
    contactLastName: "Yılmaz",
  });
});

test("edited contact name is split onto first and last columns", () => {
  const formData = new FormData();
  formData.set("contactName", "Recep YILDIRIM");
  formData.set("contactFirstName", "Ayşe Nur");
  formData.set("contactLastName", "Yılmaz");
  assert.deepEqual(partnerContactNamesFromForm(formData), {
    contactFirstName: "Recep",
    contactLastName: "YILDIRIM",
  });
});

test("register form with only contactName still maps to both columns", () => {
  const formData = new FormData();
  formData.set("contactName", "Recep YILDIRIM");
  assert.deepEqual(partnerContactNamesFromForm(formData), {
    contactFirstName: "Recep",
    contactLastName: "YILDIRIM",
  });
});

test("join is the inverse of a two-part stored name", () => {
  assert.equal(joinPartnerContactName("Recep", "YILDIRIM"), "Recep YILDIRIM");
  assert.equal(joinPartnerContactName("Recep", null), "Recep");
});
