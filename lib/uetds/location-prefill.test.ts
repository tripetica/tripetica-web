import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { UetdsLocationField } from "../../components/uetds/uetds-location-field";
import { uetdsFormCopy } from "./copy";
import { mapAiUetdsExtraction, mergeAiUetdsExtraction } from "./ai-extraction-schema";
import { createEmptyDraft } from "./draft";
import { enrichUetdsDraftLocationsFromText } from "./resolve-location";

const empty = {
  origin: null, destination: null, startDate: null, startTime: null, endDate: null, endTime: null,
  tripKind: null, purpose: null, fare: "100", flightCode: null, passengers: [],
};
for (const ambiguous of ["Aksaray", "Hilton"]) {
  for (const pickupAmbiguous of [false, true]) {
    test(`${ambiguous}: ${pickupAmbiguous ? "pickup" : "dropoff"} keeps clean text and opens its own suggestions`, async () => {
      const origin = pickupAmbiguous ? ambiguous : "İstanbul havalimanı";
      const destination = pickupAmbiguous ? "İstanbul havalimanı" : ambiguous;
      const description = `Alış yeri ${origin} bırakma yeri ${destination} ücret 100`;
      for (const raw of [empty, { ...empty, origin: `${origin} bırakma yeri ${destination} ücret 100` }]) {
        const extracted = mapAiUetdsExtraction(raw, description);
        assert.equal(extracted.origin, origin);
        assert.equal(extracted.destination, destination);
        assert.equal(extracted.fare, "100");
        const queries: string[] = [];
        const draft = await enrichUetdsDraftLocationsFromText(
          mergeAiUetdsExtraction(createEmptyDraft("manual"), extracted).draft,
          {
            search: async (query) => {
              queries.push(query);
              return query === ambiguous ? [
                { placeId: "a", primaryText: ambiguous, types: ["establishment"] },
                { placeId: "b", primaryText: ambiguous, types: ["establishment"] },
              ] : [];
            },
            details: async (placeId) => ({ name: ambiguous, placeId, countryCode: "TR", region: "İstanbul", district: placeId === "a" ? "Fatih" : "Beyoğlu" }),
          },
        );
        assert.deepEqual(queries, [origin, destination]);
        for (const key of ["origin", "destination"] as const) {
          const value = draft[key === "origin" ? "originLocation" : "destinationLocation"];
          const unresolved = (key === "origin") === pickupAmbiguous;
          assert.equal(value.placeName, key === "origin" ? origin : destination);
          assert.equal(value.review, unresolved);
          if (!unresolved) assert.equal(value.locationType, "airport");
          else assert.equal(value.googlePlaceId, "");
          const html = renderToStaticMarkup(createElement(UetdsLocationField, {
            locale: "tr", copy: uetdsFormCopy.tr, label: key, fieldId: `uetds-${key}`,
            value, suggestOnMount: true, onChange: () => {},
          }));
          assert.ok(html.includes(`value="${value.placeName}"`));
          assert.ok(html.includes(`aria-expanded="${unresolved}"`));
          assert.equal(html.includes('role="listbox"'), unresolved);
        }
      }
    });
  }
}
test("location ends at supported next field labels without changing their parsing", () => {
  for (const label of ["ücret", "bırakma saati", "alış saati", "tarih", "uçuş kodu", "amaç", "ad soyad", "cinsiyet", "uyruk", "pickup time", "dropoff time"]) {
    const extracted = mapAiUetdsExtraction(empty, `Alış yeri Hilton ${label}: 100`);
    assert.equal(extracted.origin, "Hilton", label);
    assert.equal(extracted.destination, undefined, label);
  }
});
