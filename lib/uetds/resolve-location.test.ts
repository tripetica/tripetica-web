import assert from "node:assert/strict";
import test from "node:test";

import { isOfficialUetdsLocationReady } from "@/lib/uetds/location";
import {
  applyUetdsPlaceDetails,
  enrichUetdsLocationFromText,
  pickAutoSelectedUetdsPlace,
  scoreUetdsPlaceCandidate,
  UETDS_PLACE_AUTO_SELECT_MIN_SCORE,
  UETDS_PLACE_AUTO_SELECT_SCORE_GAP,
  type UetdsPlacesLookup,
  type UetdsRankedPlaceCandidate,
} from "@/lib/uetds/resolve-location";

const SAW_DETAILS = {
  name: "İstanbul Sabiha Gökçen Uluslararası Havalimanı",
  formattedAddress: "Sanayi, 34906 Pendik/İstanbul, Türkiye",
  district: "Pendik",
  region: "İstanbul",
  countryCode: "TR",
  types: ["airport", "point_of_interest", "establishment"],
  placeId: "saw",
};

const IST_DETAILS = {
  name: "İstanbul Havalimanı",
  formattedAddress: "Tayakadın, Terminal Caddesi No:1, 34283 Arnavutköy/İstanbul, Türkiye",
  district: "Arnavutköy",
  region: "İstanbul",
  countryCode: "TR",
  types: ["airport", "point_of_interest", "establishment"],
  placeId: "ist",
};

function airportLookup(winner: "saw" | "ist", withCityNoise = true): UetdsPlacesLookup {
  const winnerDetails = winner === "saw" ? SAW_DETAILS : IST_DETAILS;
  const winnerPrimary =
    winner === "saw" ? "Sabiha Gökçen Havalimanı (SAW)" : "İstanbul Havalimanı (IST)";
  return {
    search: async () => {
      const rows: Array<{
        placeId: string;
        primaryText: string;
        secondaryText: string;
        types: string[];
      }> = [
        {
          placeId: winner,
          primaryText: winnerPrimary,
          secondaryText: winner === "saw" ? "Pendik/İstanbul" : "Arnavutköy/İstanbul",
          types: ["airport", "establishment"],
        },
      ];
      if (withCityNoise) {
        rows.push({
          placeId: "city",
          primaryText: "İstanbul",
          secondaryText: "Türkiye",
          types: ["locality", "political"],
        });
      }
      return rows;
    },
    details: async (placeId) => {
      if (placeId === "saw") return { ...SAW_DETAILS, placeId: "saw" };
      if (placeId === "ist") return { ...IST_DETAILS, placeId: "ist" };
      return {
        name: "İstanbul",
        formattedAddress: "İstanbul, Türkiye",
        region: "İstanbul",
        countryCode: "TR",
        types: ["locality", "political"],
        placeId: "city",
      };
    },
  };
}

test("auto-select Sabiha Havalimanı → SAW Place → official 99102", async () => {
  const location = await enrichUetdsLocationFromText("Sabiha Havalimanı", airportLookup("saw"));
  assert.equal(isOfficialUetdsLocationReady(location), true);
  assert.equal(location.locationType, "airport");
  assert.equal(location.districtOrAirportCode, "99102");
  assert.match(location.placeName, /Sabiha Gökçen/i);
  assert.match(location.formattedAddress, /Pendik/i);
  assert.equal(location.googlePlaceId, "saw");
  assert.equal(location.review, false);
});

test("auto-select SAW IATA → official 99102", async () => {
  const location = await enrichUetdsLocationFromText("SAW", airportLookup("saw"));
  assert.equal(location.districtOrAirportCode, "99102");
  assert.equal(location.googlePlaceId, "saw");
  assert.match(location.placeName, /Sabiha/i);
});

test("auto-select İstanbul Havalimanı → IST → 99157", async () => {
  const location = await enrichUetdsLocationFromText("İstanbul Havalimanı", airportLookup("ist"));
  assert.equal(location.districtOrAirportCode, "99157");
  assert.equal(location.locationType, "airport");
  assert.match(location.placeName, /İstanbul Havalimanı|Istanbul/i);
  assert.equal(location.googlePlaceId, "ist");
});

test("auto-select IST Airport → 99157", async () => {
  const location = await enrichUetdsLocationFromText("IST Airport", airportLookup("ist"));
  assert.equal(location.districtOrAirportCode, "99157");
  assert.equal(location.googlePlaceId, "ist");
});

test("auto-select Conforium hotel → Zeytinburnu 1739 with Google address", async () => {
  const location = await enrichUetdsLocationFromText("The Conforium Hotel İstanbul", {
    search: async () => [
      {
        placeId: "city",
        primaryText: "İstanbul",
        secondaryText: "Türkiye",
        types: ["locality", "political"],
      },
      {
        placeId: "hotel",
        primaryText: "The Conforium Hotel İstanbul",
        secondaryText: "Zeytinburnu/İstanbul",
        types: ["lodging", "establishment"],
      },
    ],
    details: async (placeId) =>
      placeId === "hotel"
        ? {
            name: "The Conforium Hotel İstanbul",
            formattedAddress: "Gökalp, Mehmet Alpay Sok. No:21, 34020 Zeytinburnu/İstanbul, Türkiye",
            district: "Zeytinburnu",
            region: "İstanbul",
            countryCode: "TR",
            types: ["lodging", "establishment"],
            placeId: "hotel",
          }
        : {
            name: "İstanbul",
            formattedAddress: "İstanbul, Türkiye",
            region: "İstanbul",
            countryCode: "TR",
            types: ["locality", "political"],
            placeId: "city",
          },
  });
  assert.equal(location.districtOrAirportCode, "1739");
  assert.equal(location.districtOrAirportName, "ZEYTİNBURNU");
  assert.match(location.placeName, /Conforium/i);
  assert.match(location.formattedAddress, /Zeytinburnu/i);
  assert.equal(location.googlePlaceId, "hotel");
});

test("ambiguous Hilton Hotel does not auto-select or invent official codes", async () => {
  const location = await enrichUetdsLocationFromText("Hilton Hotel", {
    search: async () => [
      { placeId: "a", primaryText: "Hilton Istanbul Bomonti", secondaryText: "Şişli", types: ["lodging"] },
      { placeId: "b", primaryText: "Hilton Istanbul Bosphorus", secondaryText: "Beyoğlu", types: ["lodging"] },
    ],
    details: async (placeId) =>
      placeId === "a"
        ? {
            name: "Hilton Istanbul Bomonti",
            formattedAddress: "Şişli/İstanbul",
            district: "Şişli",
            region: "İstanbul",
            countryCode: "TR",
            types: ["lodging"],
            placeId: "a",
          }
        : {
            name: "Hilton Istanbul Bosphorus",
            formattedAddress: "Beyoğlu/İstanbul",
            district: "Beyoğlu",
            region: "İstanbul",
            countryCode: "TR",
            types: ["lodging"],
            placeId: "b",
          },
  });
  assert.equal(location.review, true);
  assert.equal(isOfficialUetdsLocationReady(location), false);
  assert.equal(location.placeName, "Hilton Hotel");
  assert.equal(location.districtOrAirportCode, "");
  assert.equal(location.googlePlaceId, "");
});

test("manual Places selection and auto-select share applyUetdsPlaceDetails output shape", () => {
  const manual = applyUetdsPlaceDetails({
    details: SAW_DETAILS,
    primaryText: "Sabiha Gökçen Havalimanı (SAW)",
    secondaryText: "Pendik/İstanbul",
    suggestionTypes: ["airport"],
  });
  const scored = scoreUetdsPlaceCandidate({
    query: "Sabiha Havalimanı",
    suggestion: {
      placeId: "saw",
      primaryText: "Sabiha Gökçen Havalimanı (SAW)",
      secondaryText: "Pendik/İstanbul",
      types: ["airport"],
    },
    location: manual,
  });
  assert.ok(scored >= UETDS_PLACE_AUTO_SELECT_MIN_SCORE);
  assert.equal(manual.districtOrAirportCode, "99102");
  assert.equal(manual.googlePlaceId, "saw");
  assert.match(manual.placeName, /Sabiha Gökçen/i);
  assert.match(manual.formattedAddress, /Pendik/i);

  const ranked: UetdsRankedPlaceCandidate[] = [
    {
      suggestion: {
        placeId: "saw",
        primaryText: "Sabiha Gökçen Havalimanı (SAW)",
        types: ["airport"],
      },
      location: manual,
      score: scored,
    },
  ];
  const auto = pickAutoSelectedUetdsPlace(ranked, "Sabiha Havalimanı");
  assert.ok(auto);
  assert.deepEqual(
    {
      placeName: auto!.placeName,
      formattedAddress: auto!.formattedAddress,
      googlePlaceId: auto!.googlePlaceId,
      locationType: auto!.locationType,
      provinceCode: auto!.provinceCode,
      districtOrAirportCode: auto!.districtOrAirportCode,
      districtOrAirportName: auto!.districtOrAirportName,
      review: auto!.review,
    },
    {
      placeName: manual.placeName,
      formattedAddress: manual.formattedAddress,
      googlePlaceId: manual.googlePlaceId,
      locationType: manual.locationType,
      provinceCode: manual.provinceCode,
      districtOrAirportCode: manual.districtOrAirportCode,
      districtOrAirportName: manual.districtOrAirportName,
      review: manual.review,
    },
  );
});

test("full address lines prefer airport/hotel identity before Places enrich", async () => {
  const ist = await enrichUetdsLocationFromText(
    "Istanbul Airport (IST), Tayakadın, Terminal Caddesi No:1, 34283 Arnavutköy/İstanbul, Türkiye",
    airportLookup("ist"),
  );
  assert.equal(ist.districtOrAirportCode, "99157");
  assert.equal(ist.locationType, "airport");
  assert.notEqual(ist.districtOrAirportCode, "2048");
  assert.match(ist.placeName, /İstanbul Havalimanı|Istanbul Airport/i);

  const saw = await enrichUetdsLocationFromText(
    "Sabiha Gökçen Airport (SAW), Sanayi, Pendik/İstanbul",
    airportLookup("saw"),
  );
  assert.equal(saw.districtOrAirportCode, "99102");
  assert.notEqual(saw.districtOrAirportCode, "1835");

  const hotel = await enrichUetdsLocationFromText(
    "Antusa Design Hotel, Alemdar, Divan Yolu Cd. No:38, 34110 Fatih/İstanbul, Turkey",
    {
      search: async (query) => {
        assert.match(query, /Antusa Design Hotel/i);
        assert.doesNotMatch(query, /^Divan/i);
        return [
          {
            placeId: "antusa",
            primaryText: "Antusa Design Hotel",
            secondaryText: "Fatih/İstanbul",
            types: ["lodging", "establishment"],
          },
        ];
      },
      details: async () => ({
        name: "Antusa Design Hotel",
        formattedAddress: "Alemdar, Divan Yolu Cd. No:38, 34110 Fatih/İstanbul, Türkiye",
        district: "Fatih",
        region: "İstanbul",
        countryCode: "TR",
        types: ["lodging", "establishment"],
        placeId: "antusa",
      }),
    },
  );
  assert.equal(hotel.districtOrAirportCode, "1327");
  assert.equal(hotel.districtOrAirportName, "FATİH");
  assert.match(hotel.placeName, /Antusa Design Hotel/i);
  assert.match(hotel.formattedAddress, /Fatih/i);
});

test("street-only address does not invent a hotel/airport identity", async () => {
  const street = await enrichUetdsLocationFromText("Divanyolu Cd. No:38, 34110 Fatih/İstanbul", {
    search: async (query) => {
      assert.match(query, /Divanyolu/i);
      return [
        {
          placeId: "street",
          primaryText: "Divanyolu Caddesi",
          secondaryText: "Fatih/İstanbul",
          types: ["route"],
        },
      ];
    },
    details: async () => ({
      name: "Divanyolu Caddesi",
      formattedAddress: "Divanyolu Cd., 34110 Fatih/İstanbul, Türkiye",
      district: "Fatih",
      region: "İstanbul",
      countryCode: "TR",
      types: ["route"],
      placeId: "street",
    }),
  });
  assert.equal(street.districtOrAirportCode, "1327");
  assert.doesNotMatch(street.placeName, /Antusa|Hotel/i);
});

test("confidence gate rejects close rival official identities", () => {
  const left = applyUetdsPlaceDetails({
    details: {
      name: "Hilton Istanbul Bomonti",
      formattedAddress: "Şişli/İstanbul",
      district: "Şişli",
      region: "İstanbul",
      countryCode: "TR",
      types: ["lodging"],
      placeId: "a",
    },
  });
  const right = applyUetdsPlaceDetails({
    details: {
      name: "Hilton Istanbul Bosphorus",
      formattedAddress: "Beyoğlu/İstanbul",
      district: "Beyoğlu",
      region: "İstanbul",
      countryCode: "TR",
      types: ["lodging"],
      placeId: "b",
    },
  });
  const ranked: UetdsRankedPlaceCandidate[] = [
    {
      suggestion: { placeId: "a", primaryText: "Hilton Istanbul Bomonti", types: ["lodging"] },
      location: left,
      score: UETDS_PLACE_AUTO_SELECT_MIN_SCORE + 10,
    },
    {
      suggestion: { placeId: "b", primaryText: "Hilton Istanbul Bosphorus", types: ["lodging"] },
      location: right,
      score: UETDS_PLACE_AUTO_SELECT_MIN_SCORE + 10 - (UETDS_PLACE_AUTO_SELECT_SCORE_GAP - 1),
    },
  ];
  assert.equal(pickAutoSelectedUetdsPlace(ranked, "Hilton Hotel"), null);
});

test("location field uses shared applyUetdsPlaceDetails pipeline", async () => {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const source = fs.readFileSync(
    path.join(process.cwd(), "components/uetds/uetds-location-field.tsx"),
    "utf8",
  );
  assert.match(source, /applyUetdsPlaceDetails/);
  assert.doesNotMatch(source, /resolveOfficialUetdsLocation\(/);
});
