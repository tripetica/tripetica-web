import test from "node:test";
import assert from "node:assert/strict";
import {
  BURSA_BASE_EUR,
  BURSA_BRIDGE_ROUTE_SURCHARGE_EUR,
  BURSA_PACKAGE_HOURS,
  BURSA_ROUTE_BRIDGE,
  BURSA_ROUTE_BRIDGE_ULUDAG,
  BURSA_ROUTE_FERRY,
  BURSA_ROUTE_FERRY_ULUDAG,
  BURSA_TOUR_CODE,
  BURSA_ULUDAG_ASCENT_SURCHARGE_EUR,
  bursaPaidOptionLabels,
  bursaRouteOptions,
  hasBursaUludagAscent,
  isBursaBridgeRoute,
  isBursaTour,
  normalizeBursaRoute,
  quoteBursaBase,
  withBursaBridgeRoute,
  withBursaUludagAscent,
} from "@/lib/booking/pricing/bursa-pricing";

const pickupGeo = {
  provinceCode: "istanbul" as const,
  districtCode: "besiktas",
};

test("bursa tour detection", () => {
  assert.equal(isBursaTour("tour", BURSA_TOUR_CODE), true);
  assert.equal(isBursaTour("tour", "sapanca"), false);
  assert.equal(isBursaTour("transfer", BURSA_TOUR_CODE), false);
});

test("bursa route normalizes to ferry by default", () => {
  assert.equal(normalizeBursaRoute(null), BURSA_ROUTE_FERRY);
  assert.equal(normalizeBursaRoute(""), BURSA_ROUTE_FERRY);
  assert.equal(normalizeBursaRoute(BURSA_ROUTE_BRIDGE), BURSA_ROUTE_BRIDGE);
  assert.equal(
    normalizeBursaRoute(BURSA_ROUTE_BRIDGE_ULUDAG),
    BURSA_ROUTE_BRIDGE_ULUDAG,
  );
  assert.equal(isBursaBridgeRoute(BURSA_ROUTE_BRIDGE), true);
  assert.equal(isBursaBridgeRoute(BURSA_ROUTE_BRIDGE_ULUDAG), true);
  assert.equal(isBursaBridgeRoute(BURSA_ROUTE_FERRY), false);
  assert.equal(hasBursaUludagAscent(BURSA_ROUTE_FERRY_ULUDAG), true);
  assert.equal(hasBursaUludagAscent(BURSA_ROUTE_BRIDGE_ULUDAG), true);
  assert.equal(hasBursaUludagAscent(BURSA_ROUTE_BRIDGE), false);
});

test("bursa toggles preserve the other selected option", () => {
  assert.equal(
    withBursaBridgeRoute(BURSA_ROUTE_FERRY_ULUDAG, true),
    BURSA_ROUTE_BRIDGE_ULUDAG,
  );
  assert.equal(
    withBursaBridgeRoute(BURSA_ROUTE_BRIDGE_ULUDAG, false),
    BURSA_ROUTE_FERRY_ULUDAG,
  );
  assert.equal(
    withBursaUludagAscent(BURSA_ROUTE_BRIDGE, true),
    BURSA_ROUTE_BRIDGE_ULUDAG,
  );
  assert.equal(
    withBursaUludagAscent(BURSA_ROUTE_BRIDGE_ULUDAG, false),
    BURSA_ROUTE_BRIDGE,
  );
});

test("bursa ferry base quote", () => {
  const quote = quoteBursaBase(pickupGeo, BURSA_ROUTE_FERRY);
  assert.equal(quote.baseTransferFeeEur, BURSA_BASE_EUR);
  assert.equal(quote.flatVehicleSurchargeEur, 0);
});

test("bursa bridge route adds flat surcharge", () => {
  const quote = quoteBursaBase(pickupGeo, BURSA_ROUTE_BRIDGE);
  assert.equal(quote.baseTransferFeeEur, BURSA_BASE_EUR);
  assert.equal(quote.flatVehicleSurchargeEur, BURSA_BRIDGE_ROUTE_SURCHARGE_EUR);
  assert.equal(BURSA_BRIDGE_ROUTE_SURCHARGE_EUR, 50);
});

test("bursa paid options add flat non-multiplied surcharges once", () => {
  assert.equal(
    quoteBursaBase(pickupGeo, BURSA_ROUTE_FERRY_ULUDAG)
      .flatVehicleSurchargeEur,
    BURSA_ULUDAG_ASCENT_SURCHARGE_EUR,
  );
  assert.equal(
    quoteBursaBase(pickupGeo, BURSA_ROUTE_BRIDGE_ULUDAG)
      .flatVehicleSurchargeEur,
    BURSA_BRIDGE_ROUTE_SURCHARGE_EUR +
      BURSA_ULUDAG_ASCENT_SURCHARGE_EUR,
  );
});

test("bursa route options localize labels from the shared surcharge", () => {
  assert.deepEqual(bursaRouteOptions("tr"), [
    {
      id: BURSA_ROUTE_FERRY,
      label: "Normal yol + feribot",
      priceLabel: "Ücrete dahil",
    },
    {
      id: BURSA_ROUTE_BRIDGE,
      label: "Köprü + otoyol",
      priceLabel: "+50 EUR",
    },
  ]);
  assert.deepEqual(bursaRouteOptions("en"), [
    {
      id: BURSA_ROUTE_FERRY,
      label: "Normal road + ferry",
      priceLabel: "Included",
    },
    {
      id: BURSA_ROUTE_BRIDGE,
      label: "Bridge + motorway",
      priceLabel: "+50 EUR",
    },
  ]);
  assert.equal(bursaRouteOptions("ru")[0]?.priceLabel, "Включено в стоимость");
  assert.deepEqual(bursaPaidOptionLabels("tr"), {
    bridge: "Köprü + otoyol",
    uludag: "Uludağ'a araçla çıkış",
    bridgePrice: "+50 EUR",
    uludagPrice: "+50 EUR",
  });
  assert.equal(bursaPaidOptionLabels("en").bridge, "Bridge + motorway");
  assert.equal(
    bursaPaidOptionLabels("ru").uludag,
    "Подъём на Улудаг на автомобиле",
  );
});

test("bursa package is 12 hours", () => {
  assert.equal(BURSA_PACKAGE_HOURS, 12);
});
