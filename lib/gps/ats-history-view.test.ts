import assert from "node:assert/strict";
import test from "node:test";
import { atsHistoryError, atsHistoryLocation } from "@/lib/gps/ats-history-view";

const esenyurt = {
  status: "succeeded",
  sonucKodu: 0,
  error: null,
  sentLatitude: null,
  sentLongitude: null,
  sentIlKodu: null,
  sentIlceMernisKodu: null,
  positionLatitude: "41.034",
  positionLongitude: "28.675",
};

test("a stored position keeps its precision and does not invent a district", () => {
  const row = atsHistoryLocation({
    ...esenyurt,
    positionLatitude: "41.01751239",
    positionLongitude: "28.94971234",
  });
  assert.equal(row.coordinates, "41.01751239, 28.94971234");
  assert.equal("mapsUrl" in row, false);
  assert.equal(row.place, null);
  const known = atsHistoryLocation(esenyurt);
  assert.equal(known.place, null);
  assert.equal(known.coordinates, "41.034, 28.675");
});

test("stored ministry codes are shown even when the coordinate no longer resolves", () => {
  const row = atsHistoryLocation({
    ...esenyurt,
    sentLatitude: "40.9",
    sentLongitude: "28.2",
    sentIlKodu: 34,
    sentIlceMernisKodu: 2053,
    positionLatitude: "41.2",
    positionLongitude: "29.2",
  });
  assert.equal(row.place, "İSTANBUL / ESENYURT");
  assert.equal(row.coordinates, "40.9, 28.2");
  const unnamed = atsHistoryLocation({
    ...esenyurt,
    sentLatitude: "41.034",
    sentLongitude: "28.675",
    sentIlKodu: 34,
    sentIlceMernisKodu: 99999,
  });
  assert.equal(unnamed.place, "34 / 99999");
});

test("an unresolved sent fix shows coordinates and no guessed district", () => {
  const row = atsHistoryLocation({
    ...esenyurt,
    positionLatitude: "40.9",
    positionLongitude: "28.2",
  });
  assert.equal(row.place, null);
  assert.equal(row.coordinates, "40.9, 28.2");
});

test("a failure before the ministry call does not show a position as sent", () => {
  const row = atsHistoryLocation({
    ...esenyurt,
    status: "failed",
    sonucKodu: null,
    error: "canlı kimlik yok",
  });
  assert.equal(row.place, null);
  assert.equal(row.coordinates, null);
  assert.equal("mapsUrl" in row, false);
});

test("a failed ministry call keeps the coordinates and the real error", () => {
  const row = atsHistoryLocation({
    ...esenyurt,
    status: "failed",
    sonucKodu: null,
    error: "U-ETDS servisine bağlanılamadı.",
  });
  assert.equal(row.place, null);
  assert.equal(row.coordinates, "41.034, 28.675");
  assert.equal(atsHistoryError("succeeded", "eski hata", "tamam"), null);
  assert.equal(atsHistoryError("failed", null, "U-ETDS servisine bağlanılamadı."), "U-ETDS servisine bağlanılamadı.");
  assert.equal(atsHistoryError("failed", "", ""), null);
});
