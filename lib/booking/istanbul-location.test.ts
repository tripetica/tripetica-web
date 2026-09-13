import assert from "node:assert/strict";
import test from "node:test";
import { isIstanbulLocationValue } from "@/lib/booking/istanbul-location";
import { bosphorusDinnerCopy } from "@/lib/booking/bosphorus-dinner-copy";
import { emptyLocation, type LocationValue } from "@/lib/booking/types";

function place(partial: Partial<LocationValue>): LocationValue {
  return {
    ...emptyLocation(),
    source: "google",
    name: "Test",
    formattedAddress: "Test",
    placeId: "p1",
    lat: 41.0,
    lng: 29.0,
    type: "place",
    ...partial,
  };
}

test("IST and SAW airport presets count as Istanbul for bosphorus boundaries", () => {
  assert.equal(
    isIstanbulLocationValue(
      place({
        airportCode: "IST",
        type: "airport",
        city: null,
        district: null,
        region: null,
      }),
    ),
    true,
  );
  assert.equal(
    isIstanbulLocationValue(
      place({
        airportCode: "SAW",
        type: "airport",
        city: null,
        district: null,
        region: null,
      }),
    ),
    true,
  );
});

test("non-Istanbul province locations are rejected by Istanbul boundary helper", () => {
  assert.equal(
    isIstanbulLocationValue(
      place({
        city: "Bursa",
        district: "Osmangazi",
        region: "Bursa",
        country: "Türkiye",
        countryCode: "TR",
      }),
    ),
    false,
  );
  assert.equal(
    isIstanbulLocationValue(
      place({
        airportCode: "AYT",
        type: "airport",
      }),
    ),
    false,
  );
});

test("bosphorus service info and outside-area copy cover TR EN RU without the old short asia-only line", () => {
  for (const locale of ["tr", "en", "ru", "ar"] as const) {
    const copy = bosphorusDinnerCopy[locale];
    assert.equal(copy.serviceInfoParagraphs.length, 2);
    assert.match(copy.serviceInfoParagraphs[1], /IST|SAW|ИСТ|САВ|Стамбул|İstanbul|Istanbul/i);
    assert.equal(copy.serviceInfoGroups.length, 3);
    assert.match(
      copy.serviceInfoGroups.map((group) => group.body).join(" "),
      /IST|SAW|ИСТ|САВ|Стамбул|İstanbul|Istanbul/i,
    );
    assert.ok(
      copy.serviceInfoGroups.every(
        (group) => group.title.length > 0 && group.body.length > 0,
      ),
    );
    assert.equal(copy.voucherServiceInfoItems.length, 2);
    assert.equal(copy.voucherServiceInfoItems[0], copy.serviceInfoParagraphs[0]);
    assert.equal(copy.voucherServiceInfoItems[1], copy.serviceInfoParagraphs[1]);
    assert.ok(copy.outsideServiceAreaTitle.length > 0);
    assert.ok(copy.outsideServiceAreaBody.includes("\n\n"));
    assert.doesNotMatch(
      copy.voucherServiceInfoItems.join(" "),
      /Kesin alış saati|exact pickup time|Точное время подачи/i,
    );
  }
  assert.equal(bosphorusDinnerCopy.tr.outsideServiceAreaTitle, "Hizmet bölgesi dışında");
  assert.equal(bosphorusDinnerCopy.tr.serviceInfoTitle, "Servis Bilgilendirmesi");
});
