import test from "node:test";
import assert from "node:assert/strict";
import { loadHomepageTransferDraftForSession } from "@/lib/booking/transfer-draft-hydration";

const SESSION_A = "11111111-1111-4111-8111-111111111111";
const SESSION_B = "22222222-2222-4222-8222-222222222222";

function activeDraft() {
  return {
    serviceType: "transfer",
    tourCode: null,
    currency: "RUB",
    editingOriginal: null,
    applied: {
      pickup: {
        locationType: "airport",
        airportCode: "IST",
        nameCustomer: "Istanbul Airport",
        addressCustomer: "Istanbul Airport, Türkiye",
        placeId: "ist-place",
        latitude: 41.2753,
        longitude: 28.7519,
        provinceCode: "istanbul",
        districtCode: "arnavutkoy",
      },
      dropoff: {
        locationType: "place",
        airportCode: null,
        nameCustomer: "Taksim",
        addressCustomer: "Taksim, Istanbul",
        placeId: "taksim-place",
        latitude: 41.0369,
        longitude: 28.985,
        provinceCode: "istanbul",
        districtCode: "beyoglu",
      },
      pickupAt: new Date("2026-09-10T09:30:00.000Z"),
      durationHours: null,
      passengerCount: 3,
      luggageCount: 2,
      babySeatCount: 1,
      meetAndGreet: true,
      flightCode: "TK123",
    },
  };
}

test("homepage draft hydration preserves the persisted applied fields", async () => {
  const result = await loadHomepageTransferDraftForSession(
    SESSION_A,
    "en",
    async (sessionId) => (sessionId === SESSION_A ? activeDraft() as never : null),
  );

  assert.equal(result?.pickup.airportCode, "IST");
  assert.equal(result?.dropoff.name, "Taksim");
  assert.equal(result?.passengerCount, 3);
  assert.equal(result?.luggageCount, 2);
  assert.equal(result?.babySeatCount, 1);
  assert.equal(result?.currency, "RUB");
});

test("homepage hydration never reads another browser session's draft", async () => {
  const findDraft = async (sessionId: string) =>
    sessionId === SESSION_A ? activeDraft() as never : null;

  assert.ok(await loadHomepageTransferDraftForSession(SESSION_A, "tr", findDraft));
  assert.equal(
    await loadHomepageTransferDraftForSession(SESSION_B, "tr", findDraft),
    null,
  );
});

test("invalid, missing, and failed homepage draft lookups fall back safely", async () => {
  let called = false;
  assert.equal(
    await loadHomepageTransferDraftForSession("not-a-session", "ru", async () => {
      called = true;
      return activeDraft() as never;
    }),
    null,
  );
  assert.equal(called, false);
  assert.equal(
    await loadHomepageTransferDraftForSession(SESSION_A, "ru", async () => null),
    null,
  );
  assert.equal(
    await loadHomepageTransferDraftForSession(SESSION_A, "ru", async () => {
      throw new Error("database unavailable");
    }),
    null,
  );
});
