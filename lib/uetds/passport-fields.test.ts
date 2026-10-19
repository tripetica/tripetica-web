import test from "node:test";
import assert from "node:assert/strict";
import { createEmptyDraft } from "@/lib/uetds/draft";
import { countryIso2FromName } from "@/lib/uetds/extract";
import { mapAiUetdsExtraction, mergeAiUetdsExtraction } from "@/lib/uetds/ai-extraction-schema";
import { officialUetdsCountryByCode } from "@/lib/uetds/official-locations";
import { applyPassportDocumentFacts, namesCompatible } from "@/lib/uetds/passport-fields";
import { buildTd3 } from "@/lib/uetds/mrz.test";

const EMPTY_TRIP = {
  origin: "Sultanahmet",
  destination: "Istanbul Airport",
  startDate: "2026-10-20",
  startTime: "14:30",
  endDate: null,
  endTime: null,
  tripKind: "transfer",
  purpose: "Transfer",
  fare: "50",
  flightCode: null,
};

function iraqMrz() {
  return buildTd3({
    issuing: "IRQ",
    lastName: "MOHAMMED ALI",
    firstName: "ESRAA TALAL MOHAMMEDALI",
    number: "A10928831",
    nationality: "IRQ",
    birth: "080129",
    sex: "F",
    expiry: "340128",
  });
}

test("IRQ, IRAQI and Republic of Iraq become official Irak", () => {
  for (const value of ["IRQ", "IRAQI", "Iraqi", "Republic of Iraq", "Irak", "IQ"]) {
    assert.equal(countryIso2FromName(value), "IQ", value);
  }
  assert.equal(officialUetdsCountryByCode("IQ")?.name, "Irak");
});

test("other ISO 3166-1 alpha-3 codes resolve", () => {
  assert.equal(countryIso2FromName("DEU"), "DE");
  assert.equal(countryIso2FromName("USA"), "US");
  assert.equal(countryIso2FromName("TUR"), "TR");
  assert.equal(countryIso2FromName("GBR"), "GB");
  assert.equal(countryIso2FromName("LBY"), "LY");
});

test("AI IRAQI nationality is not dropped on the form", () => {
  const mapped = mapAiUetdsExtraction({
    ...EMPTY_TRIP,
    visibleText: "Nationality: IRAQI\nGiven names: ESRAA TALAL MOHAMMEDALI\nSurname: MOHAMMED ALI\nSex: F",
    passengers: [{
      firstName: "EsraaTalal",
      lastName: "MohammedAllii",
      nationality: "IRAQI",
      identityNumber: "A10928831",
      gender: "female",
    }],
  });
  assert.equal(mapped.passengers?.[0]?.nationality, "IQ");
  assert.equal(mapped.passengers?.[0]?.firstName, "ESRAA TALAL MOHAMMEDALI");
  assert.equal(mapped.passengers?.[0]?.lastName, "MOHAMMED ALI");
  const merged = mergeAiUetdsExtraction(createEmptyDraft("manual"), mapped, Date.parse("2026-10-17T12:00:00Z"));
  assert.equal(merged.draft.passengers[0]?.nationality, "IQ");
  assert.equal(merged.draft.passengers[0]?.firstName, "ESRAA TALAL MOHAMMEDALI");
  assert.equal(merged.draft.passengers[0]?.lastName, "MOHAMMED ALI");
  assert.equal(merged.draft.passengers[0]?.gender, "female");
});

test("valid MRZ fills missing nationality and truncated given names", () => {
  const mrz = iraqMrz();
  const mapped = mapAiUetdsExtraction({
    ...EMPTY_TRIP,
    visibleText: `Passport image\n${mrz.line1}\n${mrz.line2}`,
    passengers: [{
      firstName: "EsraaTalal",
      lastName: "MohammedAli",
      nationality: "Narnia",
      identityNumber: "A10928831",
      gender: "female",
    }],
  });
  assert.equal(mapped.passengers?.[0]?.nationality, "IQ");
  assert.equal(mapped.passengers?.[0]?.firstName, "ESRAA TALAL MOHAMMEDALI");
  assert.equal(mapped.passengers?.[0]?.lastName, "MOHAMMED ALI");
});

test("labeled visual names win when MRZ given names disagree", () => {
  const mrz = buildTd3({
    issuing: "TUR",
    lastName: "YILMAZ",
    firstName: "AHMET",
    number: "U44556677",
    nationality: "TUR",
    birth: "910203",
    sex: "M",
    expiry: "310203",
  });
  const rows = applyPassportDocumentFacts([{
    firstName: "Mehmet",
    lastName: "Yilmaz",
    nationality: "TR",
    identityNumber: "U44556677",
    gender: "male" as const,
  }], `Surname: YILMAZ\nGiven names: MEHMET\nNationality: TURKISH\n${mrz.line1}\n${mrz.line2}`);
  assert.equal(rows[0]?.firstName, "MEHMET");
  assert.equal(rows[0]?.lastName, "YILMAZ");
  assert.equal(rows[0]?.nationality, "TR");
});

test("two MRZ blocks stay two passengers", () => {
  const first = buildTd3({
    issuing: "LBY",
    lastName: "HASSAN",
    firstName: "OMAR",
    number: "L20001122",
    nationality: "LBY",
    birth: "790101",
    sex: "M",
    expiry: "280101",
  });
  const second = buildTd3({
    issuing: "LBY",
    lastName: "HASSAN",
    firstName: "LAYLA",
    number: "L20003344",
    nationality: "LBY",
    birth: "820202",
    sex: "F",
    expiry: "280202",
  });
  const mapped = mapAiUetdsExtraction({
    ...EMPTY_TRIP,
    visibleText: `${first.line1}\n${first.line2}\n\n${second.line1}\n${second.line2}`,
    passengers: [
      { firstName: "Omar", lastName: "Hassan", nationality: "LY", identityNumber: "L20001122", gender: "male" },
      { firstName: "Layla", lastName: "Hassan", nationality: "LY", identityNumber: "L20003344", gender: "female" },
    ],
  });
  assert.equal(mapped.passengers?.length, 2);
  assert.equal(mapped.passengers?.[0]?.firstName, "OMAR");
  assert.equal(mapped.passengers?.[1]?.firstName, "LAYLA");
  assert.equal(mapped.passengers?.[0]?.identityNumber, "L20001122");
  assert.equal(mapped.passengers?.[1]?.identityNumber, "L20003344");
});

test("uncertain fields stay empty instead of being invented", () => {
  const rows = applyPassportDocumentFacts([{
    firstName: "Ada",
    lastName: "Lovelace",
    nationality: undefined,
    identityNumber: undefined,
    gender: undefined,
  }], "Hotel voucher. No passport page.");
  assert.equal(rows[0]?.nationality, undefined);
  assert.equal(rows[0]?.identityNumber, undefined);
  assert.equal(namesCompatible("EsraaTalal", "ESRAA TALAL MOHAMMEDALI"), true);
  assert.equal(namesCompatible("Mehmet", "Ahmet"), false);
});
