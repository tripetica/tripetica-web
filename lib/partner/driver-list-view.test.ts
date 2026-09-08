import test from "node:test";
import assert from "node:assert/strict";
import {
  compareDriverFullName,
  driverMatchesSearch,
  filterAndSortPartnerDrivers,
  foldDriverSearchText,
  nextDriverNameSortDir,
  vehicleMatchesSearch,
} from "@/lib/partner/driver-list-view";

const sample = [
  { id: "4", fullName: "Yıldırım Test", phone: "+905551111111" },
  { id: "2", fullName: "Mehmet Kaya", phone: "+905552222222" },
  { id: "1", fullName: "Ahmet Yılmaz", phone: "+905553333333" },
  { id: "3", fullName: "Recep Yıldırım", phone: "+905554444444" },
];

test("default driver name sort is locale-aware A to Z", () => {
  assert.equal(nextDriverNameSortDir("asc"), "desc");
  assert.equal(nextDriverNameSortDir("desc"), "asc");
  assert.ok(compareDriverFullName("Ahmet Yılmaz", "Yıldırım Test") < 0);
  assert.ok(compareDriverFullName("Recep Yıldırım", "Yıldırım Test") < 0);
  assert.deepEqual(
    filterAndSortPartnerDrivers(sample, "", "asc").map((item) => item.fullName),
    ["Ahmet Yılmaz", "Mehmet Kaya", "Recep Yıldırım", "Yıldırım Test"],
  );
  assert.deepEqual(
    filterAndSortPartnerDrivers(sample, "", "desc").map((item) => item.fullName),
    ["Yıldırım Test", "Recep Yıldırım", "Mehmet Kaya", "Ahmet Yılmaz"],
  );
});

test("live driver search matches name and phone and keeps active name sort", () => {
  assert.equal(foldDriverSearchText("YILDIRIM"), "yildirim");
  assert.equal(true, driverMatchesSearch(sample[3], "rec"));
  assert.equal(true, driverMatchesSearch(sample[0], "yildirim"));
  assert.equal(true, driverMatchesSearch(sample[1], "555222"));
  assert.equal(false, driverMatchesSearch(sample[1], "recep"));
  assert.deepEqual(
    filterAndSortPartnerDrivers(sample, "yil", "asc").map((item) => item.fullName),
    ["Ahmet Yılmaz", "Recep Yıldırım", "Yıldırım Test"],
  );
  assert.deepEqual(
    filterAndSortPartnerDrivers(sample, "yil", "desc").map((item) => item.fullName),
    ["Yıldırım Test", "Recep Yıldırım", "Ahmet Yılmaz"],
  );
  assert.deepEqual(
    filterAndSortPartnerDrivers(sample, "", "asc").map((item) => item.id),
    ["1", "2", "3", "4"],
  );
  assert.equal(
    true,
    driverMatchesSearch(
      { fullName: "Ahmet Kaya", phone: "+90555", partnerName: "Yıldırım Ulaştırma Ltd. Şti." },
      "yildirim ulastirma",
    ),
  );
  assert.equal(true, vehicleMatchesSearch({ plate: "34ABC123", brand: "Mercedes", model: "Vito" }, "vito"));
  assert.equal(false, vehicleMatchesSearch({ plate: "34ABC123", brand: "Mercedes", model: "Vito" }, "recep"));
});
