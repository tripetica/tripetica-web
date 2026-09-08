import assert from "node:assert/strict";
import { test } from "node:test";
import {
  resolveCheckoutContactInitial,
  resolveCheckoutMainPassengerInitial,
} from "@/lib/booking/checkout-account-prefill";

test("draft phone wins over account phone", () => {
  const result = resolveCheckoutContactInitial({
    locale: "tr",
    draftEmail: "draft@example.com",
    draftPhone: "+447700900123",
    draftPhoneCountryCode: "GB",
    account: {
      firstName: "Recep",
      lastName: "Yildirim",
      email: "account@example.com",
      phone: "+905551112233",
      phoneCountryCode: "TR",
      nationalityCode: "DE",
    },
  });
  assert.equal(result.email, "draft@example.com");
  assert.equal(result.phoneCountryIso2, "GB");
  assert.ok(result.phoneNational.length > 0);
});

test("account fills blank draft contact", () => {
  const result = resolveCheckoutContactInitial({
    locale: "tr",
    draftEmail: null,
    draftPhone: null,
    draftPhoneCountryCode: null,
    account: {
      firstName: "Recep",
      lastName: "Yildirim",
      email: "account@example.com",
      phone: "+905551112233",
      phoneCountryCode: "TR",
      nationalityCode: "DE",
    },
  });
  assert.equal(result.email, "account@example.com");
  assert.equal(result.phoneCountryIso2, "TR");
  assert.ok(result.phoneNational.length > 0);
});

test("draft main passenger name wins; account fills blanks", () => {
  const fromDraft = resolveCheckoutMainPassengerInitial({
    locale: "tr",
    passenger: {
      sequenceNo: 1,
      firstName: "Ali",
      lastName: "Veli",
      countryCode: "DE",
      identityNumber: "P123",
      gender: "male",
      isPrimaryPassenger: true,
    },
    account: {
      firstName: "Recep",
      lastName: "Yildirim",
      email: "a@b.com",
      phone: null,
      phoneCountryCode: "TR",
      nationalityCode: "GB",
    },
  });
  assert.equal(fromDraft.firstName, "Ali");
  assert.equal(fromDraft.countryCode, "DE");
  assert.equal(fromDraft.identityNumber, "P123");
  assert.equal(fromDraft.gender, "male");

  const fromAccount = resolveCheckoutMainPassengerInitial({
    locale: "tr",
    passenger: null,
    account: {
      firstName: "Recep",
      lastName: "Yildirim",
      email: "a@b.com",
      phone: null,
      phoneCountryCode: "TR",
      nationalityCode: "GB",
    },
  });
  assert.equal(fromAccount.firstName, "Recep");
  assert.equal(fromAccount.lastName, "Yildirim");
  assert.equal(fromAccount.countryCode, "GB");
  assert.equal(fromAccount.identityNumber, "");
});
