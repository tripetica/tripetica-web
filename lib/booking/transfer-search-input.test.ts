import assert from "node:assert/strict";
import test from "node:test";
import { parseTransferSearchBody } from "@/lib/booking/transfer-search-input";
import { emptyLocation, type TourId } from "@/lib/booking/types";

const PACKAGE_TOURS: TourId[] = [
  "istanbul-half-day",
  "istanbul-full-day",
  "sapanca",
  "bursa",
];

test("vehicle package tours retain pickup without requiring a dropoff", () => {
  const pickup = {
    ...emptyLocation(),
    source: "google" as const,
    name: "The Marmara Taksim",
    formattedAddress: "Taksim, Istanbul",
    placeId: "place-taksim",
    lat: 41.0369,
    lng: 28.985,
  };

  for (const tourId of PACKAGE_TOURS) {
    const parsed = parseTransferSearchBody({
      locale: "tr",
      serviceType: "tour",
      tourId,
      pickup,
      localDateTime: "2026-09-04T12:00:00",
    });

    assert.ok(!("status" in parsed), `${tourId} should parse`);
    assert.equal(parsed.pickup.placeId, pickup.placeId);
    assert.equal(parsed.dropoff.placeId, null);
    assert.equal(parsed.tourCode, tourId);
  }
});
