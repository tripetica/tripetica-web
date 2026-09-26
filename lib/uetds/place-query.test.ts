import assert from "node:assert/strict";
import test from "node:test";

import { preferUetdsPlaceQuery } from "@/lib/uetds/place-query";

test("preferUetdsPlaceQuery keeps airport / hotel head and ignores street tails", () => {
  assert.equal(
    preferUetdsPlaceQuery(
      "Istanbul Airport (IST), Tayakadın, Terminal Caddesi No:1, 34283 Arnavutköy/İstanbul, Türkiye",
    ),
    "Istanbul Airport (IST)",
  );
  assert.equal(
    preferUetdsPlaceQuery("Sabiha Gökçen Airport (SAW), Sanayi, Pendik/İstanbul"),
    "Sabiha Gökçen Airport (SAW)",
  );
  assert.equal(
    preferUetdsPlaceQuery(
      "Antusa Design Hotel, Alemdar, Divan Yolu Cd. No:38, 34110 Fatih/İstanbul, Turkey",
    ),
    "Antusa Design Hotel",
  );
  assert.equal(
    preferUetdsPlaceQuery(
      "The Conforium Hotel Istanbul, Gökalp, Mehmet Alpay Sok. No:21, Zeytinburnu/İstanbul",
    ),
    "The Conforium Hotel Istanbul",
  );
});

test("preferUetdsPlaceQuery does not invent a POI from street-only text", () => {
  assert.equal(
    preferUetdsPlaceQuery("Divanyolu Cd. No:38, 34110 Fatih/İstanbul"),
    "Divanyolu Cd. No:38, 34110 Fatih/İstanbul",
  );
  assert.equal(preferUetdsPlaceQuery("Terminal Caddesi No:1"), "Terminal Caddesi No:1");
  assert.equal(preferUetdsPlaceQuery("Hilton Hotel"), "Hilton Hotel");
});
