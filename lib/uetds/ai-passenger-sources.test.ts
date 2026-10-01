import test from "node:test";
import assert from "node:assert/strict";
import { mergeAiExtractedSources, mergeAiPassengerSources } from "@/lib/uetds/ai-passenger-sources";
import { mapAiUetdsExtraction } from "@/lib/uetds/ai-extraction-schema";
import { repairUetdsExtractedPersonNames } from "@/lib/uetds/passenger-name";

const empty = {
  origin: null, destination: null, startDate: null, startTime: null, endDate: null, endTime: null,
  tripKind: null, purpose: null, fare: null, flightCode: null, passengers: [],
};

function person(lastName: string, firstName: string, identityNumber: string, nationality: string, gender: "male" | "female") {
  return { firstName, lastName, identityNumber, nationality, gender };
}

test("three passports and one voucher merge to five passengers without overwrite", () => {
  const passports = [
    [person("SHIN", "DONGLEE", "M868P8841", "KR", "male")],
    [person("DUISHOEVA", "CHOLPON", "760892803", "RU", "female")],
    [person("ERGESHOVA", "TATTIGUL ZHUMABAEVNA", "KP0435673", "KG", "female")],
  ];
  const voucher = mapAiUetdsExtraction({
    ...empty,
    origin: "Hampton by Hilton Istanbul Zeytinburnu",
    passengers: [
      { firstName: "SUN/CHONG", lastName: null, nationality: "CN", identityNumber: "EC7094049", gender: "male" },
      { firstName: "CAI/YI", lastName: null, nationality: "CN", identityNumber: "EM8294320", gender: "female" },
    ],
  });
  assert.equal(voucher.passengers?.[0]?.lastName, "SUN");
  assert.equal(voucher.passengers?.[0]?.firstName, "CHONG");
  assert.equal(voucher.passengers?.[1]?.lastName, "CAI");
  assert.equal(voucher.passengers?.[1]?.firstName, "YI");
  const merged = mergeAiPassengerSources([
    ...passports,
    voucher.passengers ?? [],
  ]);
  const labels = merged.map((item) => `${item.lastName} ${item.firstName}`);
  assert.equal(merged.length, 5);
  assert.deepEqual(labels, [
    "SHIN DONGLEE",
    "DUISHOEVA CHOLPON",
    "ERGESHOVA TATTIGUL ZHUMABAEVNA",
    "SUN CHONG",
    "CAI YI",
  ]);
  assert.equal(labels.includes("SUN CHONG"), true);
  assert.equal(labels.includes("CAI YI"), true);
  const combined = mergeAiExtractedSources([
    { passengers: passports[0] },
    { passengers: passports[1] },
    { passengers: passports[2] },
    { passengers: voucher.passengers },
  ]);
  assert.equal(combined.passengers?.length, 5);
  assert.equal(combined.passengers?.[0]?.identityNumber, "M868P8841");
  assert.equal(combined.passengers?.[3]?.identityNumber, "EC7094049");
});

test("the same slash name and passport number stay one person, and a different name does not merge", () => {
  const merged = mergeAiPassengerSources([
    [person("SUN", "CHONG", "EC7094049", "KR", "male")],
    [person("SUN", "CHONG", "EC7094049", "CN", "male"), person("CAI", "YI", "EM8294320", "CN", "female")],
  ]);
  assert.equal(merged.length, 2);
  const differentDocuments = mergeAiPassengerSources([
    [person("SUN", "CHONG", "EC7094049", "CN", "male")],
    [person("SUN", "CHONG", "EM8294320", "CN", "male")],
  ]);
  assert.equal(differentDocuments.length, 2);
  assert.equal(merged[0]?.nationality, "KR");
  assert.equal(merged[0]?.identityNumber, "EC7094049");
  assert.equal(merged[1]?.lastName, "CAI");
  assert.equal(repairUetdsExtractedPersonNames({ firstName: "SUN/CHONG=EC7094049" }).lastName, "SUN");
  assert.equal(repairUetdsExtractedPersonNames({ firstName: "SUN/CHONG=EC7094049" }).firstName, "CHONG");
});
