import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { mapAiUetdsExtraction, UETDS_AI_EXTRACTION_SCHEMA } from "@/lib/uetds/ai-extraction-schema";
import {
  normalizeUetdsPurposeText,
  purposeLooksForeign,
  UETDS_FORM_LANGUAGE_AI_RULES,
} from "@/lib/uetds/form-language";
import { normalizeUetdsPersonName } from "@/lib/uetds/passenger-name";

const empty = {
  origin: null, destination: null, startDate: null, startTime: null, endDate: null, endTime: null,
  tripKind: null, purpose: null, fare: null, flightCode: null, passengers: [],
};

function source(relative: string) {
  return readFileSync(join(process.cwd(), relative), "utf8");
}

test("mapAiUetdsExtraction prefers airport/hotel identity over address tails", () => {
  const mapped = mapAiUetdsExtraction({
    ...empty,
    origin: "Istanbul Airport (IST), Tayakadın, Terminal Caddesi No:1, 34283 Arnavutköy/İstanbul, Türkiye",
    destination:
      "Antusa Design Hotel, Alemdar, Divan Yolu Cd. No:38, 34110 Fatih/İstanbul, Turkey",
    passengers: [],
  });
  assert.equal(mapped.origin, "Istanbul Airport (IST)");
  assert.equal(mapped.destination, "Antusa Design Hotel");
});

test("Cyrillic and Arabic names transliterate; Turkish letters and Latin stay", () => {
  assert.equal(normalizeUetdsPersonName("Алексей Иванов"), "Aleksey Ivanov");
  assert.equal(normalizeUetdsPersonName("محمد علي"), "mhmd aly");
  assert.equal(normalizeUetdsPersonName("Çiğdem Yılmaz"), "Çiğdem Yılmaz");
  assert.equal(normalizeUetdsPersonName("John Smith"), "John Smith");
  // Do not invent Turkish translations of foreign Latin names.
  assert.equal(normalizeUetdsPersonName("Alexander"), "Alexander");
});

test("purpose phrases translate to Turkish; unknown text is not invented", () => {
  assert.equal(normalizeUetdsPurposeText("Airport Transfer"), "Havalimanı Transferi");
  assert.equal(normalizeUetdsPurposeText("Hotel Transfer"), "Otel Transferi");
  assert.equal(normalizeUetdsPurposeText("Hourly Chauffeur Service"), "Saatlik Şoförlü Araç Hizmeti");
  assert.equal(normalizeUetdsPurposeText("Трансфер"), "Transfer");
  assert.equal(normalizeUetdsPurposeText("Havalimanı Transferi"), "Havalimanı Transferi");
  assert.equal(normalizeUetdsPurposeText("Custom boutique city tour package"), "Custom boutique city tour package");
  assert.equal(purposeLooksForeign("Airport Transfer"), true);
  assert.equal(purposeLooksForeign("Havalimanı Transferi"), false);
});

test("AI mapping applies name transliteration and purpose Turkish without touching identifiers", () => {
  const mapped = mapAiUetdsExtraction({
    ...empty,
    purpose: "Airport Transfer",
    passengers: [{
      firstName: "Алексей",
      lastName: "Иванов",
      nationality: "RU",
      identityNumber: "N1234567",
      gender: "male",
    }],
  });
  assert.equal(mapped.purpose, "Havalimanı Transferi");
  assert.equal(mapped.passengers?.[0].firstName, "Aleksey");
  assert.equal(mapped.passengers?.[0].lastName, "Ivanov");
  assert.equal(mapped.passengers?.[0].identityNumber, "N1234567");
});

test("AI mapping folds accented Latin passenger names to English ASCII without touching identity", () => {
  const mapped = mapAiUetdsExtraction({
    ...empty,
    passengers: [{
      firstName: "Højris",
      lastName: "Louens",
      nationality: "DK",
      identityNumber: "PØ-99-KEEP",
      gender: "male",
    }],
  });
  assert.equal(mapped.passengers?.[0].firstName, "Hojris");
  assert.equal(mapped.passengers?.[0].lastName, "Louens");
  // Passport/identity must not be ASCII-folded by the name pipeline.
  assert.equal(mapped.passengers?.[0].identityNumber, "PØ-99-KEEP");
});

test("permanent AI language rules cover Ops+Partner fill paths and schema fields", () => {
  assert.match(UETDS_FORM_LANGUAGE_AI_RULES, /NEVER translate into Turkish/);
  assert.match(UETDS_FORM_LANGUAGE_AI_RULES, /transliterate/);
  assert.match(UETDS_FORM_LANGUAGE_AI_RULES, /TRANSLATE into natural Turkish/);
  assert.match(UETDS_FORM_LANGUAGE_AI_RULES, /Never invent ministry il\/ilçe/);
  assert.match(UETDS_FORM_LANGUAGE_AI_RULES, /Never alter TCKN/);
  assert.match(UETDS_FORM_LANGUAGE_AI_RULES, /Ops and Partner/);
  assert.match(UETDS_FORM_LANGUAGE_AI_RULES, /fill the form/);
  assert.match(UETDS_FORM_LANGUAGE_AI_RULES, /never reduce it to bare|primary place identity/);
  assert.match(source("lib/uetds/ai-extraction.ts"), /UETDS_FORM_LANGUAGE_AI_RULES/);
  assert.match(
    UETDS_AI_EXTRACTION_SCHEMA.properties.passengers.items.properties.firstName.description,
    /Never translate into Turkish/,
  );
  assert.match(
    UETDS_AI_EXTRACTION_SCHEMA.properties.passengers.items.properties.firstName.description,
    /English ASCII letters A-Z\/a-z/,
  );
  assert.match(
    UETDS_AI_EXTRACTION_SCHEMA.properties.passengers.items.properties.firstName.description,
    /Given name\(s\) ONLY/,
  );
  assert.match(UETDS_FORM_LANGUAGE_AI_RULES, /English ASCII letters A-Z\/a-z/);
  assert.match(UETDS_FORM_LANGUAGE_AI_RULES, /Højris→Hojris/);

  assert.match(
    UETDS_AI_EXTRACTION_SCHEMA.properties.passengers.items.properties.lastName.description,
    /surname particles/,
  );
  assert.match(UETDS_FORM_LANGUAGE_AI_RULES, /firstName = given name\(s\) only/);
  assert.match(source("lib/uetds/ai-extraction.ts"), /Prefer labeled passport GIVEN NAMES/);
  assert.match(source("lib/uetds/ai-extraction-schema.ts"), /repairUetdsExtractedPersonNames/);
  assert.match(
    UETDS_AI_EXTRACTION_SCHEMA.properties.purpose.description,
    /natural Turkish/,
  );
  assert.match(
    UETDS_AI_EXTRACTION_SCHEMA.properties.origin.description,
    /airport name \+ IATA/,
  );
  assert.match(
    UETDS_AI_EXTRACTION_SCHEMA.properties.origin.description,
    /never replace with a street\/terminal fragment/,
  );
  assert.match(
    UETDS_AI_EXTRACTION_SCHEMA.properties.origin.description,
    /do not invent missing address details or ministry il\/ilçe codes/,
  );
  assert.match(
    UETDS_AI_EXTRACTION_SCHEMA.properties.destination.description,
    /Antusa Design Hotel/,
  );
  assert.match(UETDS_FORM_LANGUAGE_AI_RULES, /primary place identity/);
  assert.match(UETDS_FORM_LANGUAGE_AI_RULES, /never Terminal Caddesi No:1/);
  assert.match(source("lib/uetds/ministry-submit.ts"), /normalizeUetdsPersonName/);
  assert.match(source("lib/uetds/ministry-submit.ts"), /normalizeUetdsPurposeText/);
  assert.match(source("lib/uetds/ministry-mutate.ts"), /normalizeUetdsPurposeText/);
  assert.match(source("lib/uetds/notification-actions.ts"), /extractAiUetdsDocument/);
  assert.match(source("lib/uetds/notification-actions.ts"), /\["ops", "partner"\]/);
});
