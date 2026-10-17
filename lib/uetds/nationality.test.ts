import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  createEmptyDraft,
  createPassengerDraft,
  missingMandatoryFields,
  nationalityErrorsAfterSelection,
} from "@/lib/uetds/draft";
import { countryIso2FromName } from "@/lib/uetds/extract";
import { officialUetdsCountries, officialUetdsCountryByCode } from "@/lib/uetds/official-locations";

const NATIONALITY_MESSAGE = "Yolcu uyruğu zorunludur.";

function passenger(nationality: string, firstName: string) {
  return createPassengerDraft({
    firstName,
    lastName: "SVIRCEVIC",
    nationality,
    identityNumber: "11111111111",
    gender: "female",
  });
}

function draftWith(passengers: ReturnType<typeof passenger>[]) {
  return {
    ...createEmptyDraft("manual", { applyTripDefaults: false }),
    passengers,
  };
}

function nationalityKeys(draft: ReturnType<typeof draftWith>) {
  return missingMandatoryFields(draft).filter((key) => key.endsWith(".nationality"));
}

test("Serbia from Luna is the official U-ETDS country", () => {
  for (const value of ["Sırbistan", "RS", "Serbia", "XS"]) {
    const row = passenger(value, "ANJA");
    assert.equal(row.nationality, "XS");
    assert.equal(row.identityNumber, "11111111111");
    assert.equal(officialUetdsCountryByCode(row.nationality)?.name, "Sırbistan");
  }
  assert.deepEqual(nationalityKeys(draftWith([passenger("Sırbistan", "ANJA")])), []);
});

test("a manual official country is accepted and an empty nationality is not", () => {
  const selected = passenger("DE", "ANJA");
  assert.equal(selected.nationality, "DE");
  assert.deepEqual(nationalityKeys(draftWith([selected])), []);
  const cleared = passenger("", "ANJA");
  assert.equal(cleared.nationality, "");
  assert.deepEqual(nationalityKeys(draftWith([cleared])), ["passenger.0.nationality"]);
});

test("two passengers keep independent nationalities", () => {
  const draft = draftWith([passenger("Sırbistan", "ANJA"), passenger("", "SRDAN")]);
  assert.equal(draft.passengers[0]?.nationality, "XS");
  assert.equal(draft.passengers[1]?.nationality, "");
  assert.deepEqual(nationalityKeys(draft), ["passenger.1.nationality"]);
  draft.passengers[1] = passenger("TR", "SRDAN");
  assert.deepEqual(nationalityKeys(draft), []);
  assert.equal(draft.passengers[0]?.nationality, "XS");
});

test("England still maps to GB and colliding official names stay distinct", () => {
  assert.equal(countryIso2FromName("İngiltere"), "GB");
  assert.equal(countryIso2FromName("England"), "GB");
  assert.equal(countryIso2FromName("Libya"), "LY");
  assert.equal(countryIso2FromName("Türkiye"), "TR");
  assert.equal(countryIso2FromName("Narnia"), null);
  assert.equal(officialUetdsCountryByCode("GB")?.name, "İngiltere");
  assert.equal(countryIso2FromName("Karadağ"), "MW");
  assert.equal(countryIso2FromName("Malavi"), "MI");
  assert.equal(countryIso2FromName("Kosova"), "K");
  assert.equal(officialUetdsCountryByCode("MW")?.name, "Karadağ");
});

test("selecting a country clears the previous nationality error", () => {
  const before = [NATIONALITY_MESSAGE, "Yolcu adı zorunludur."];
  assert.deepEqual(
    nationalityErrorsAfterSelection(before, NATIONALITY_MESSAGE, [passenger("FR", "ANJA")]),
    ["Yolcu adı zorunludur."],
  );
  assert.deepEqual(
    nationalityErrorsAfterSelection(before, NATIONALITY_MESSAGE, [passenger("XS", "ANJA"), passenger("", "SRDAN")]),
    before,
  );
});

test("both notification forms offer official country codes", () => {
  const options = officialUetdsCountries();
  assert.equal(options.some((country) => country.code === "XS" && country.name === "Sırbistan"), true);
  assert.equal(options.some((country) => country.code === "RS"), false);
  for (const file of [
    "components/uetds/uetds-notification-form.tsx",
    "components/uetds/uetds-notification-edit-form.tsx",
  ]) {
    const source = readFileSync(file, "utf8");
    assert.match(source, /officialUetdsCountries\(\)/);
    assert.match(source, /SearchableSelect/);
    assert.equal(source.includes("countries()"), false);
  }
});
