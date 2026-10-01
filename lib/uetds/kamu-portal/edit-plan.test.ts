import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { groupListUrl, groupPageIsSameTrip, matchPortalGroups, parsePortalGroupRows, parsePortalPassengerRows, passengerSaveSucceeded, portalGroupNeedsWrite, portalPlaceShowsDistrict, resolvePortalGroupRow, runPortalUpdate, samePortalPlace } from "@/lib/uetds/kamu-portal/live-update";
import {
  diffPortalGroup,
  matchExistingPassenger,
  matchPortalTrip,
  mergePortalSeferRows,
  nextPassengerSyncStep,
  parsePortalSeferRows,
  planPassengerReplacements,
  portalDocumentNumber,
  type PortalPassengerIdentity,
  type PortalPassengerMatch,
  type PortalSeferRow,
  type PortalTripMatch,
} from "@/lib/uetds/kamu-portal/edit-plan";

function tripError(result: PortalTripMatch) {
  return result.ok ? "" : result.error;
}

function passengerError(result: PortalPassengerMatch) {
  return result.ok ? "" : result.error;
}

function row(index: number, start: string, end: string, plate: string, sefer = "ABC123") {
  return `<tr><td>${sefer}</td><td>${start}</td><td>${end}</td><td>${plate}</td><td>-</td><td>-</td><td>Geçerli</td><td><a href="/UAB_TARIFESIZ?asama=grupListesi&amp;index=${index}">Grup Listesi</a><a href="/UAB_TARIFESIZ?asama=personelListesi&amp;index=${index}">Personel Listesi</a></td></tr>`;
}

const HTML = [
  row(0, "01/10/2026 03:00", "01/10/2026 03:00", "34 MRA 890"),
  row(4, "30/09/2026 16:27", "30/09/2026 19:27", "34 EGP 847"),
  row(5, "30/09/2026 16:27", "30/09/2026 19:27", "34 EGP 847"),
  row(9, "30/09/2026 16:28", "30/09/2026 19:27", "34EGP847"),
].join("");

const TARGET = {
  startDate: "2026-09-30",
  startTime: "16:27:00",
  endDate: "30.09.2026",
  endTime: "19:27",
  plate: "34 EGP 847",
  seferNumber: "ABC123",
};

test("a sefer row is read from the observed start, end and plate cells", () => {
  const rows = parsePortalSeferRows(HTML);
  assert.equal(rows.length, 4);
  assert.equal(rows[1]?.plate, "34EGP847");
  assert.equal(rows[1]?.endTime, "19:27");
});

test("one exact schedule and plate match continues", () => {
  const rows = parsePortalSeferRows(row(4, "30/09/2026 16:27", "30/09/2026 19:27", "34 EGP 847"));
  const matched = matchPortalTrip(rows, TARGET);
  assert.equal(matched.ok, true);
  if (matched.ok) {
    assert.equal(matched.listPosition, 4);
    assert.equal(matched.identity.seferNumber, "ABC123");
    assert.equal(matched.identity.ministrySeferNumber, "ABC123");
  }
});

test("no match and more than one match stop", () => {
  const rows = parsePortalSeferRows(HTML);
  assert.equal(matchPortalTrip(rows, TARGET).ok, false);
  assert.equal(tripError(matchPortalTrip(rows, TARGET)), "ambiguous_trip_match");
  assert.equal(tripError(matchPortalTrip(rows, { ...TARGET, startTime: "16:00" })), "trip_not_found");
});

test("plate alone or a nearby time is not a match", () => {
  const rows: PortalSeferRow[] = [
    { index: 1, startDate: "30/09/2026", startTime: "16:27", endDate: "30/09/2026", endTime: "19:27", plate: "34AAA111", seferNumbers: ["ABC123"] },
    { index: 2, startDate: "30/09/2026", startTime: "16:27", endDate: "30/09/2026", endTime: "19:27", plate: "34EGP847", seferNumbers: ["ABC123"] },
    { index: 3, startDate: "30/09/2026", startTime: "16:28", endDate: "30/09/2026", endTime: "19:27", plate: "34EGP847", seferNumbers: ["ABC123"] },
  ];
  assert.equal(tripError(matchPortalTrip([rows[0]!], { ...TARGET, plate: "34 EGP 847" })), "trip_not_found");
  assert.equal(tripError(matchPortalTrip([rows[2]!], TARGET)), "trip_not_found");
  const plateMatch = matchPortalTrip([rows[1]!], TARGET);
  assert.equal(plateMatch.ok, true);
  if (plateMatch.ok) assert.equal(plateMatch.listPosition, 2);
});

test("only a changed dropoff is marked", () => {
  const diff = diffPortalGroup({
    oldPickup: { provinceName: "İstanbul", districtName: "Arnavutköy", placeName: "İstanbul Havalimanı" },
    newPickup: { provinceName: "İstanbul", districtName: "Arnavutköy", placeName: "İstanbul Havalimanı" },
    oldDropoff: { provinceName: "İstanbul", districtName: "Şişli", placeName: "Şişli" },
    newDropoff: { provinceName: "İstanbul", districtName: "Fatih", placeName: "Fatih" },
  });
  assert.equal(diff.pickup_changed, false);
  assert.equal(diff.dropoff_changed, true);
  assert.deepEqual(diff.changedFields, ["dropoff"]);
});

test("passenger replacement keeps index order and does not create extra rows", () => {
  const oldRows: PortalPassengerIdentity[] = [1, 2, 3, 4, 5, 6].map((index) => ({
    index,
    nationality: "Libya",
    documentNumber: "11111111111",
    firstName: `Old${index}`,
    lastName: "Elalam",
    gender: "male",
  }));
  const newRows: PortalPassengerIdentity[] = [
    { index: 1, nationality: "Güney Kore", documentNumber: "M868P8841", firstName: "Donglee", lastName: "Shin", gender: "male" },
    { index: 2, nationality: "Türkiye", documentNumber: "", firstName: "Ayşe", lastName: "Yılmaz", gender: "female" },
    { index: 3, nationality: "Türkiye", documentNumber: "123", firstName: "Ada", lastName: "Kaya", gender: "female" },
  ];
  const plan = planPassengerReplacements(oldRows, newRows);
  assert.equal(plan.length, 3);
  assert.equal(plan[0]?.match.nationality, "Libya");
  assert.equal(plan[0]?.next.nationality, "Güney Kore");
  assert.equal(plan[0]?.next.documentNumber, "M868P8841");
  assert.equal(plan[1]?.next.documentNumber, "11111111111");
  assert.equal(plan[1]?.match.documentNumber, "11111111111");
  assert.notEqual(plan[0]?.next.documentNumber, plan[0]?.match.documentNumber);
  assert.equal(portalDocumentNumber(""), "11111111111");
  assert.equal(planPassengerReplacements(oldRows.slice(0, 3), newRows.concat(newRows)).length, 3);
});

test("a unique real document identifies the portal row despite name split and country label", () => {
  const html = [
    `<tr><td>KR</td><td>M868P8841</td><td>DONGLEE SHIN</td><td>Erkek</td><td><a href="?asama=yeniYolcu&amp;yolcuIndex=0">Güncelle</a></td></tr>`,
    `<tr><td>KG</td><td>KP0435673</td><td>TATTIGUL ZHUMABAEVNA ERGESHOVA</td><td>Kadın</td><td><a href="?asama=yeniYolcu&amp;yolcuIndex=1">Güncelle</a></td></tr>`,
    `<tr><td>RU</td><td>760892803</td><td>CHOLPON ZHUNUSMAMATOVNA DUISHOEVA</td><td>Kadın</td><td><a href="?asama=yeniYolcu&amp;yolcuIndex=2">Güncelle</a></td></tr>`,
  ].join("");
  const listed = parsePortalPassengerRows(html);
  assert.equal(listed[1]?.firstName, "TATTIGUL");
  assert.equal(listed[1]?.lastName, "ZHUMABAEVNA ERGESHOVA");
  assert.deepEqual(matchExistingPassenger(listed, { index: 2, nationality: "Kırgızistan", documentNumber: "KP0435673", firstName: "Tattigul Zhumabaevna", lastName: "Ergeshova", gender: "female" }), { ok: true, index: 1 });
  assert.deepEqual(matchExistingPassenger(listed, { index: 1, nationality: "Güney Kore", documentNumber: "m868p8841", firstName: "Dong", lastName: "Lee", gender: "male" }), { ok: true, index: 0 });
  assert.deepEqual(matchExistingPassenger(listed, { index: 3, nationality: "RU", documentNumber: "760892803", firstName: "Cholpon Zhunusmamatovna", lastName: "Duishoeva", gender: "female" }), { ok: true, index: 2 });
  assert.equal(passengerError(matchExistingPassenger(listed, { index: 1, nationality: "KR", documentNumber: "EC7094049", firstName: "Chong", lastName: "Sun", gender: "male" })), "passenger_not_found");
  assert.equal(passengerError(matchExistingPassenger([listed[0]!, { ...listed[0]!, index: 4 }], { index: 1, nationality: "KR", documentNumber: "M868P8841", firstName: "DONGLEE", lastName: "SHIN", gender: "male" })), "ambiguous_passenger_match");
});

test("an existing passenger match needs more than the name", () => {
  const rows = [
    { index: 0, nationality: "Libya", documentNumber: "11111111111", firstName: "Ibrahim", lastName: "Elalam" },
    { index: 1, nationality: "Libya", documentNumber: "11111111111", firstName: "Iman", lastName: "Elmassalati" },
    { index: 2, nationality: "", documentNumber: "", firstName: "Ibrahim", lastName: "Elalam" },
  ];
  const oldRow = { index: 1, nationality: "Libya", documentNumber: "11111111111", firstName: "Ibrahim", lastName: "Elalam", gender: "male" };
  assert.deepEqual(matchExistingPassenger(rows, oldRow), { ok: true, index: 0 });
  assert.equal(passengerError(matchExistingPassenger([rows[2]!], oldRow)), "passenger_not_found");
  assert.equal(
    passengerError(matchExistingPassenger([rows[0]!, { ...rows[0]!, index: 4 }], oldRow)),
    "ambiguous_passenger_match",
  );
});

test("the 30/09/2026 20:52 sefer matches 34EGP847 and ignores sefer numbers", () => {
  const html = [
    row(2, "30/09/2026 20:51", "30/09/2026 23:52", "34EGP847"),
    row(9, "30/09/2026 20:52", "30/09/2026 23:52", "34EGP847"),
    row(11, "30/09/2026 20:53", "30/09/2026 23:52", "34 EGP 847"),
  ].join("");
  const rows = mergePortalSeferRows(parsePortalSeferRows(html).concat(parsePortalSeferRows(row(9, "30/09/2026 20:52", "30/09/2026 23:52", "34 EGP 847"))));
  const match = matchPortalTrip(rows, {
    startDate: "30.09.2026",
    startTime: "20:52",
    endDate: "2026-09-30",
    endTime: "23:52",
    plate: "34 EGP 847",
    seferNumber: "ABC123",
  });
  assert.equal(match.ok, true);
  if (match.ok) {
    assert.equal(match.listPosition, 9);
    assert.equal(match.identity.ministrySeferNumber, "ABC123");
  }
  assert.equal(rows.filter((item) => item.index === 9).length, 1);
  const oneMinute = matchPortalTrip(parsePortalSeferRows(row(9, "30/09/2026 20:52", "30/09/2026 23:52", "34EGP847", "ABC123")), { startDate: "30.09.2026", startTime: "20:51", endDate: "30.09.2026", endTime: "23:52", plate: "34EGP847", seferNumber: "ABC123" });
  assert.equal(tripError(oneMinute), "trip_not_found");
  assert.equal(tripError(matchPortalTrip(parsePortalSeferRows(row(9, "30/09/2026 20:52", "30/09/2026 23:52", "34EGP847")), { ...TARGET, startTime: "20:52" })), "trip_not_found");
});

test("group and passenger rows use the observed portal links and do not follow flush", () => {
  const groupHtml = `<tr><td>Transfer</td><td>ZEYTİNBURNU/İSTANBUL</td><td>Sabiha Gökçen Havalimanı/İSTANBUL</td><td><a href="/UAB_TARIFESIZ?asama=yeniGrup&amp;index=12&amp;grupIndex=0">Güncelle</a><a href="/UAB_TARIFESIZ?asama=yolcuListesi&amp;index=12&amp;grupIndex=0">Yolcu Listesi</a><a href="/UAB_TARIFESIZ?asama=yeniGrup&amp;index=12">Yeni Grup</a></td></tr>`;
  const groups = parsePortalGroupRows(groupHtml);
  assert.equal(groups.length, 1);
  assert.equal(groups[0]?.grupIndex, 0);
  assert.equal(samePortalPlace(groups[0]!.pickup, { provinceName: "İSTANBUL", districtName: "ZEYTİNBURNU", placeName: "" }), true);
  assert.equal(samePortalPlace(groups[0]!.dropoff, { provinceName: "İSTANBUL", districtName: "Sabiha Gökçen Havalimanı", placeName: "" }), true);
  const passengerHtml = `<tr><td>IQ</td><td>X1</td><td>DINA SAFAA</td><td>Kadın</td><td><a href="?asama=yeniYolcu&amp;yolcuIndex=0">Güncelle</a></td></tr><a href="?asama=yeniYolcu&amp;flush">Yeni Yolcu</a>`;
  const people = parsePortalPassengerRows(passengerHtml);
  assert.equal(people.length, 1);
  assert.equal(people[0]?.index, 0);
  assert.equal(people[0]?.nationality, "IQ");
  const target = { startDate: "2026-09-30", startTime: "20:52", endDate: "2026-09-30", endTime: "23:52", plate: "34 EGP 847", seferNumber: "ABC123" };
  assert.equal(groupPageIsSameTrip("Araç Plaka Numarası 34EGP847 Sefer Başlangıç Saati 20:52 Sefer Bitiş Saati 23:52 30/09/2026 ABC123", target), true);
  assert.equal(groupPageIsSameTrip("Araç Plaka Numarası 34EGP847 Sefer Başlangıç Saati 20:52 Sefer Bitiş Saati 23:52 30/09/2026 ABC124", target), false);
  const ministryTarget = { startDate: "2026-09-30", startTime: "23:08", endDate: "2026-10-01", endTime: "02:08", plate: "34 EGP 847", seferNumber: "2609307206518656" };
  assert.equal(groupPageIsSameTrip("34EGP847 30/09/2026 23:08 01/10/2026 02:08 TRP-1790794967102", ministryTarget), true);
  assert.equal(groupPageIsSameTrip("34 EGP 847 30.09.2026 23:08 01.10.2026 02:08 TRP-1790794967102", ministryTarget), true);
  assert.equal(groupPageIsSameTrip("34EGP847 30/09/2026 23:08 01/10/2026 02:08 2609307206519999", ministryTarget), false);
  const groupForm = [
    "<h1>Grup Bilgileri Giriş Formu</h1>",
    "<label>Sefer Başlangıç Tarihi</label><input value=\"30/09/2026\">",
    "<label>Sefer Başlangıç Saati</label><input value=\"23:08\">",
    "<label>Sefer Bitiş Tarihi</label><input value=\"01/10/2026\">",
    "<label>Sefer Bitiş Saati</label><input value=\"02:08\">",
    "<label>Araç Plaka Numarası</label><input value=\"34 EGP 847\">",
    "<label>Firma Sefer Numarası</label><input value=\"2609307206518656\">",
  ].join("");
  assert.equal(groupPageIsSameTrip(groupForm, ministryTarget), true);
  assert.equal(groupPageIsSameTrip(groupForm.replace("34 EGP 847", "34 FDN 767"), ministryTarget), false);
  assert.equal(groupPageIsSameTrip(groupForm.replace("2609307206518656", "2609307206519999"), ministryTarget), false);
  assert.equal(groupPageIsSameTrip(groupForm.replace("02:08", "02:09"), ministryTarget), false);
  assert.equal(groupPageIsSameTrip(`${groupForm}<p>2609307206519999</p>`, ministryTarget), true);
  assert.equal(groupPageIsSameTrip("Araç Plaka Numarası 34FDN767 Sefer Başlangıç Saati 21:10 30/09/2026 23:10", target), false);
  const liveRows = parsePortalPassengerRows(`<tr><td>CN</td><td>EC7094049</td><td>CHONG SUN</td><td>Erkek</td><td><a href="?asama=yeniYolcu&amp;yolcuIndex=0">Güncelle</a></td></tr><tr><td>CN</td><td>EM8294320</td><td>Yİ CAİ</td><td>Kadın</td><td><a href="?asama=yeniYolcu&amp;yolcuIndex=1">Güncelle</a></td></tr>`);
  assert.deepEqual(matchExistingPassenger(liveRows, { index: 1, nationality: "CN", documentNumber: "EC7094049", firstName: "Chong", lastName: "Sun", gender: "male" }), { ok: true, index: 0 });
  assert.deepEqual(matchExistingPassenger(liveRows, { index: 2, nationality: "CN", documentNumber: "EM8294320", firstName: "Yi", lastName: "Cai", gender: "female" }), { ok: true, index: 1 });
});

test("two-stage identity requires the exact sefer number and ignores a stale row index", () => {
  const clock = { startDate: "30.09.2026", startTime: "20:52", endDate: "30.09.2026", endTime: "23:52", plate: "34 EGP 847" };
  const matched = matchPortalTrip(parsePortalSeferRows(row(14, "30/09/2026 20:52", "30/09/2026 23:52", "34EGP847", "ABC123")), { ...clock, seferNumber: " abc 123 " });
  assert.equal(matched.ok, true);
  if (matched.ok) {
    assert.equal(matched.listPosition, 14);
    assert.equal(matched.identity.ministrySeferNumber, "ABC123");
    assert.notEqual(matched.identity.seferNumber, String(matched.listPosition));
  }
  const moved = matchPortalTrip(parsePortalSeferRows(row(9, "30/09/2026 20:52", "30/09/2026 23:52", "34 EGP 847", "ABC123")), { ...clock, seferNumber: "ABC123" });
  assert.equal(moved.ok, true);
  if (moved.ok) assert.equal(moved.listPosition, 9);
  const sameClock = parsePortalSeferRows([
    row(12, "30/09/2026 20:52", "30/09/2026 23:52", "34EGP847", "ABC124"),
    row(14, "30/09/2026 20:52", "30/09/2026 23:52", "34EGP847", "ABC123"),
  ].join(""));
  assert.equal(tripError(matchPortalTrip(sameClock, { ...clock, seferNumber: "ABC123" })), "ambiguous_trip_match");
  assert.equal(tripError(matchPortalTrip(parsePortalSeferRows(row(14, "30/09/2026 20:52", "30/09/2026 23:52", "34EGP847", "ABC123")), { ...clock, seferNumber: "ABC124" })), "trip_number_mismatch");
  const spaced = matchPortalTrip(parsePortalSeferRows(row(4, "30/09/2026 23:08", "01/10/2026 02:08", "34 EGP 847", "2609 3072 0651 8656")), { startDate: "30.09.2026", startTime: "23:08", endDate: "01.10.2026", endTime: "02:08", plate: "34EGP847", seferNumber: "2609307206518656" });
  assert.equal(spaced.ok, true);
  if (spaced.ok) assert.equal(spaced.identity.ministrySeferNumber, "2609307206518656");
  const firmaColumn = matchPortalTrip(parsePortalSeferRows(row(4, "30/09/2026 23:08", "01/10/2026 02:08", "34 EGP 847", "TRP-1790794967102")), { startDate: "30.09.2026", startTime: "23:08", endDate: "01.10.2026", endTime: "02:08", plate: "34 EGP 847", seferNumber: "2609307206518656" });
  assert.equal(firmaColumn.ok, true);
  if (firmaColumn.ok) assert.equal(firmaColumn.identity.ministrySeferNumber, "2609307206518656");
  assert.equal(tripError(matchPortalTrip(parsePortalSeferRows(row(4, "30/09/2026 23:08", "01/10/2026 02:08", "34 EGP 847", "2609307206519999")), { startDate: "30.09.2026", startTime: "23:08", endDate: "01.10.2026", endTime: "02:08", plate: "34 EGP 847", seferNumber: "2609307206518656" })), "trip_number_mismatch");
  assert.equal(tripError(matchPortalTrip(parsePortalSeferRows(row(14, "30/09/2026 20:52", "30/09/2026 23:52", "34EGP847", "ABC123")), { ...clock, seferNumber: "   " })), "trip_number_missing");
});

test("group rows match the labeled live airport cell and fail closed", () => {
  const live = [
    "<table>",
    "<tr><th>Grup Adı</th><th>Grup Açıklaması</th><th>Sefer Bitiş Yeri</th><th>Sefer Başlangıç Yeri</th><th></th></tr>",
    "<tr><td>1</td><td>Transfer</td><td>Sabiha Gökçen Havalimanı / BAKIRKÖY / İSTANBUL</td><td>ZEYTİNBURNU / İSTANBUL</td>",
    "<td><a href=\"/UAB_TARIFESIZ?asama=yeniGrup&amp;index=4&amp;grupIndex=0\">Güncelle</a>",
    "<a href=\"/UAB_TARIFESIZ?asama=yolcuListesi&amp;index=4&amp;grupIndex=0\">Yolcu Listesi</a></td></tr>",
    "</table>",
  ].join("");
  const shifted = parsePortalGroupRows(live);
  assert.equal(shifted.length, 1);
  assert.equal(shifted[0]?.name, "Transfer");
  assert.equal(shifted[0]?.pickup, "ZEYTİNBURNU / İSTANBUL");
  assert.equal(shifted[0]?.dropoff, "Sabiha Gökçen Havalimanı / BAKIRKÖY / İSTANBUL");
  assert.equal(shifted[0]?.grupIndex, 0);
  const unlabeled = parsePortalGroupRows(
    "<tr><td>Transfer</td><td>Transfer</td><td>  zeytinburnu  /  istanbul </td><td>Sabiha Gökçen Havalimanı/BAKIRKÖY/İSTANBUL</td><td><a href=\"?asama=yeniGrup&amp;grupIndex=7\">Güncelle</a><a href=\"?asama=yolcuListesi&amp;grupIndex=7\">Yolcu Listesi</a></td></tr>",
  );
  const pickup = { provinceName: "İstanbul", districtName: "Zeytinburnu", placeName: "Conforium" };
  const airport = { provinceName: "İSTANBUL", districtName: "Sabiha Gökçen Havalimanı", placeName: "İstanbul Sabiha Gökçen Uluslararası Havalimanı" };
  const found = matchPortalGroups(unlabeled, pickup, airport);
  assert.equal(found.ok, true);
  if (found.ok) assert.equal(found.group.grupIndex, 7);
  assert.equal(samePortalPlace(unlabeled[0]!.dropoff, { provinceName: "İstanbul", districtName: "Bakırköy", placeName: "" }), true);
  assert.equal(samePortalPlace(unlabeled[0]!.dropoff, { provinceName: "İSTANBUL", districtName: "FATİH", placeName: "Sultanahmet" }), false);
  assert.equal(samePortalPlace(unlabeled[0]!.dropoff, { provinceName: "ANKARA", districtName: "Sabiha Gökçen Havalimanı", placeName: "" }), false);
  assert.equal(portalPlaceShowsDistrict(unlabeled[0]!.dropoff, { provinceName: "İSTANBUL", districtName: "BAKIRKÖY", placeName: "" }), false);
  assert.equal(portalPlaceShowsDistrict(unlabeled[0]!.dropoff, airport), true);
  const wrongIndex = parsePortalGroupRows(
    "<tr><td>Transfer</td><td>FATİH / İSTANBUL</td><td>ŞİŞLİ / İSTANBUL</td><td><a href=\"?asama=yeniGrup&amp;grupIndex=0\">Güncelle</a><a href=\"?asama=yolcuListesi&amp;grupIndex=0\">Yolcu Listesi</a></td></tr>",
  );
  const missing = matchPortalGroups(wrongIndex, pickup, airport);
  assert.equal(missing.ok, false);
  if (!missing.ok) assert.equal(missing.error, "group_not_found");
  const second = unlabeled[0]!;
  const ambiguous = matchPortalGroups(
    [second, { ...second, grupIndex: 8, editHref: "?asama=yeniGrup&grupIndex=8", passengerHref: "?asama=yolcuListesi&grupIndex=8" }],
    pickup,
    airport,
  );
  assert.equal(ambiguous.ok, false);
  if (!ambiguous.ok) assert.equal(ambiguous.error, "ambiguous_group_match");
  const empty = matchPortalGroups([], pickup, airport);
  assert.equal(empty.ok, false);
  if (!empty.ok) assert.equal(empty.error, "group_not_found");
});

test("a successful passenger save survives navigation detach and the next old passenger is reread", async () => {
  const stamp = "34EGP847 01/10/2026 23:40 02/10/2026 02:40 2610017209433672";
  const target = { startDate: "01.10.2026", startTime: "23:40", endDate: "02.10.2026", endTime: "02:40", plate: "34 EGP 847", seferNumber: "2610017209433672" };
  const person = (index: number, nationality: string, documentNumber: string, name: string, gender: string) =>
    `<tr><td>${nationality}</td><td>${documentNumber}</td><td>${name}</td><td>${gender}</td><td><a href="?asama=yeniYolcu&amp;yolcuIndex=${index}">Güncelle</a></td></tr>`;
  const before = [
    person(0, "LY", "11111111111", "KHDIJA ELHODERI", "Kadın"),
    person(1, "LY", "11111111111", "SARAH ELHODERI", "Kadın"),
    person(2, "LY", "11111111111", "SAHAR ELHODERI", "Kadın"),
  ].join("");
  const afterFirst = [
    person(6, "LY", "11111111111", "SARAH ELHODERI", "Kadın"),
    person(2, "LY", "11111111111", "SAHAR ELHODERI", "Kadın"),
    person(8, "CN", "EC7094049", "CHONG SUN", "Erkek"),
  ].join("");
  const passengerUrl = "https://kamu.turkiye.gov.tr/UAB_TARIFESIZ?asama=yolcuListesi&index=4&grupIndex=0";
  const groupHtml = `<p>${stamp}</p><tr><th>Grup Açıklaması</th><th>Sefer Başlangıç Yeri</th><th>Sefer Bitiş Yeri</th></tr><tr><td>Transfer</td><td>BEYOĞLU / İSTANBUL</td><td>İstanbul Havalimanı / İSTANBUL</td><td><a href="?asama=yeniGrup&amp;grupIndex=0">Güncelle</a><a href="${passengerUrl}">Yolcu Listesi</a></td></tr>`;
  assert.equal(passengerSaveSucceeded({ url: passengerUrl, html: `<div>Yolcu Güncellenmiştir.</div>${afterFirst}`, firstName: "CHONG", lastName: "SUN" }), true);
  const reordered = parsePortalPassengerRows(afterFirst);
  assert.deepEqual(matchExistingPassenger(reordered, { index: 2, nationality: "LY", documentNumber: "11111111111", firstName: "SARAH", lastName: "ELHODERI", gender: "female" }), { ok: true, index: 6 });
  assert.equal(passengerError(matchExistingPassenger(reordered, { index: 2, nationality: "CN", documentNumber: "EM8294320", firstName: "YI", lastName: "CAI", gender: "female" })), "passenger_not_found");
  let url = "https://kamu.turkiye.gov.tr/start";
  let html = "";
  const savedIndexes: number[] = [];
  const result = await runPortalUpdate({
    tripIndex: 4,
    tripTarget: target,
    onPhase: () => undefined,
    plan: {
      oldPickup: { provinceName: "İSTANBUL", districtName: "BEYOĞLU", placeName: "" },
      newPickup: { provinceName: "İSTANBUL", districtName: "BEYOĞLU", placeName: "" },
      oldDropoff: { provinceName: "İSTANBUL", districtName: "İstanbul Havalimanı", placeName: "" },
      newDropoff: { provinceName: "İSTANBUL", districtName: "İstanbul Havalimanı", placeName: "" },
      oldPassengers: [
        { index: 1, nationality: "LY", documentNumber: "11111111111", firstName: "KHDIJA", lastName: "ELHODERI", gender: "female" },
        { index: 2, nationality: "LY", documentNumber: "11111111111", firstName: "SARAH", lastName: "ELHODERI", gender: "female" },
      ],
      newPassengers: [
        { index: 1, nationality: "CN", documentNumber: "EC7094049", firstName: "CHONG", lastName: "SUN", gender: "male" },
        { index: 2, nationality: "CN", documentNumber: "EM8294320", firstName: "YI", lastName: "CAI", gender: "female" },
      ],
    },
    page: {
      url: async () => url,
      html: async () => html,
      goto: async (next) => {
        url = next;
        if (/grupListesi/i.test(next)) html = groupHtml;
        else if (/yolcuListesi/i.test(next)) html = `${stamp}${savedIndexes.length === 0 ? before : afterFirst}`;
        else html = `<h1>Yolcu Bilgileri</h1>${stamp}`;
      },
      savePassengerForm: async (input) => {
        savedIndexes.push(input.yolcuIndex);
        url = passengerUrl;
        html = `${stamp}<div>Yolcu Güncellenmiştir.</div>${afterFirst}`;
        if (savedIndexes.length === 1) throw new Error("Execution context was destroyed, most likely because of a navigation");
        return true;
      },
    },
  });
  assert.deepEqual(savedIndexes, [0, 6]);
  assert.equal(result.error, null);
  assert.equal(result.phase, "update_flow_complete");
  assert.equal(url.startsWith(groupListUrl(4)) || /yolcuListesi/i.test(url), true);
});

test("a target passenger already on the ministry list is skipped even when the old passenger is gone", async () => {
  const stamp = "34EGP847 01/10/2026 23:40 02/10/2026 02:40 2610017209433672";
  const target = { startDate: "01.10.2026", startTime: "23:40", endDate: "02.10.2026", endTime: "02:40", plate: "34 EGP 847", seferNumber: "2610017209433672" };
  const person = (index: number, nationality: string, documentNumber: string, name: string, gender: string) =>
    `<tr><td>${nationality}</td><td>${documentNumber}</td><td>${name}</td><td>${gender}</td><td><a href="?asama=yeniYolcu&amp;yolcuIndex=${index}">Güncelle</a></td></tr>`;
  const current = [
    person(8, "CN", "EC7094049", "CHONG SUN", "Erkek"),
    person(6, "LY", "11111111111", "SARAH ELHODERI", "Kadın"),
  ].join("");
  const passengerUrl = "https://kamu.turkiye.gov.tr/UAB_TARIFESIZ?asama=yolcuListesi&index=4&grupIndex=0";
  const groupHtml = `<p>${stamp}</p><tr><th>Grup Açıklaması</th><th>Sefer Başlangıç Yeri</th><th>Sefer Bitiş Yeri</th></tr><tr><td>Transfer</td><td>BEYOĞLU / İSTANBUL</td><td>İstanbul Havalimanı / İSTANBUL</td><td><a href="?asama=yeniGrup&amp;grupIndex=0">Güncelle</a><a href="${passengerUrl}">Yolcu Listesi</a></td></tr>`;
  const listed = parsePortalPassengerRows(current);
  const [done, pending] = planPassengerReplacements(
    [
      { index: 1, nationality: "LY", documentNumber: "11111111111", firstName: "KHDIJA", lastName: "ELHODERI", gender: "female" },
      { index: 2, nationality: "LY", documentNumber: "11111111111", firstName: "SARAH", lastName: "ELHODERI", gender: "female" },
    ],
    [
      { index: 1, nationality: "CN", documentNumber: "EC7094049", firstName: "CHONG", lastName: "SUN", gender: "male" },
      { index: 2, nationality: "CN", documentNumber: "EM8294320", firstName: "YI", lastName: "CAI", gender: "female" },
    ],
  );
  assert.equal(nextPassengerSyncStep(done!, listed).action, "skip");
  assert.deepEqual(nextPassengerSyncStep(pending!, listed), { action: "update", yolcuIndex: 6 });
  let url = "https://kamu.turkiye.gov.tr/start";
  let html = "";
  const savedIndexes: number[] = [];
  const result = await runPortalUpdate({
    tripIndex: 4,
    tripTarget: target,
    onPhase: () => undefined,
    plan: {
      oldPickup: { provinceName: "İSTANBUL", districtName: "BEYOĞLU", placeName: "" },
      newPickup: { provinceName: "İSTANBUL", districtName: "BEYOĞLU", placeName: "" },
      oldDropoff: { provinceName: "İSTANBUL", districtName: "İstanbul Havalimanı", placeName: "" },
      newDropoff: { provinceName: "İSTANBUL", districtName: "İstanbul Havalimanı", placeName: "" },
      oldPassengers: [
        { index: 1, nationality: "LY", documentNumber: "11111111111", firstName: "KHDIJA", lastName: "ELHODERI", gender: "female" },
        { index: 2, nationality: "LY", documentNumber: "11111111111", firstName: "SARAH", lastName: "ELHODERI", gender: "female" },
      ],
      newPassengers: [
        { index: 1, nationality: "CN", documentNumber: "EC7094049", firstName: "CHONG", lastName: "SUN", gender: "male" },
        { index: 2, nationality: "CN", documentNumber: "EM8294320", firstName: "YI", lastName: "CAI", gender: "female" },
      ],
    },
    page: {
      url: async () => url,
      html: async () => html,
      goto: async (next) => {
        url = next;
        html = /yolcuListesi/i.test(next) ? `${stamp}${current}` : groupHtml;
      },
      savePassengerForm: async (input) => {
        savedIndexes.push(input.yolcuIndex);
        url = passengerUrl;
        html = `${stamp}<div>Yolcu Güncellenmiştir.</div>${current}`;
        return true;
      },
    },
  });
  assert.deepEqual(savedIndexes, [6]);
  assert.equal(result.error, null);
  assert.notEqual(result.error, "source_data_mismatch");
});

test("ministry group fields that already match the target are not written", () => {
  const row = {
    grupIndex: 0,
    name: "Transfer",
    pickup: "BEYOĞLU / İSTANBUL",
    dropoff: "İstanbul Havalimanı / İSTANBUL",
    editHref: "?asama=yeniGrup&grupIndex=0",
    passengerHref: "?asama=yolcuListesi&grupIndex=0",
  };
  const same = portalGroupNeedsWrite(
    row,
    { provinceName: "İSTANBUL", districtName: "BEYOĞLU", placeName: "" },
    { provinceName: "İSTANBUL", districtName: "İstanbul Havalimanı", placeName: "" },
  );
  assert.deepEqual(same, { pickup: false, dropoff: false });
  const partial = portalGroupNeedsWrite(
    row,
    { provinceName: "İSTANBUL", districtName: "KÜÇÜKÇEKMECE", placeName: "" },
    { provinceName: "İSTANBUL", districtName: "İstanbul Havalimanı", placeName: "" },
  );
  assert.deepEqual(partial, { pickup: true, dropoff: false });
  const sourceOnly = resolvePortalGroupRow(
    [row],
    { provinceName: "İSTANBUL", districtName: "BEYOĞLU", placeName: "" },
    { provinceName: "İSTANBUL", districtName: "İstanbul Havalimanı", placeName: "" },
  );
  assert.equal(sourceOnly.ok, true);
  if (sourceOnly.ok) assert.equal(sourceOnly.group.grupIndex, 0);
});

test("the only group on a verified trip is selected even when its places differ from the target", () => {
  const html = [
    "<tr><th>Grup Adı</th><th>Sefer Başlangıç Yeri</th><th>Sefer Bitiş Yeri</th><th>Grup Açıklaması</th></tr>",
    "<tr><td>Transfer</td><td>BÜYÜKÇEKMECE/İSTANBUL</td><td>Sabiha Gökçen Havalimanı/İSTANBUL</td><td>Transfer</td>",
    "<td><a href=\"?asama=yeniGrup&amp;grupIndex=0\">Güncelle</a><a href=\"?asama=yolcuListesi&amp;grupIndex=0\">Yolcu Listesi</a></td></tr>",
  ].join("");
  const rows = parsePortalGroupRows(html);
  assert.equal(rows.length, 1);
  const targetPickup = { provinceName: "İSTANBUL", districtName: "BAĞCILAR", placeName: "" };
  const targetDropoff = { provinceName: "İSTANBUL", districtName: "ZEYTİNBURNU", placeName: "" };
  const selected = resolvePortalGroupRow(
    rows,
    targetPickup,
    targetDropoff,
  );
  assert.equal(selected.ok, true);
  if (!selected.ok) return;
  assert.equal(selected.group.grupIndex, 0);
  assert.notEqual(selected.ok, false);
  const diff = portalGroupNeedsWrite(selected.group, targetPickup, targetDropoff);
  assert.deepEqual(diff, { pickup: true, dropoff: true });
  const buyuk = rows[0]!;
  const bagcilar = {
    ...buyuk,
    grupIndex: 3,
    pickup: "BAĞCILAR / İSTANBUL",
    dropoff: "ZEYTİNBURNU / İSTANBUL",
    editHref: "?asama=yeniGrup&grupIndex=3",
    passengerHref: "?asama=yolcuListesi&grupIndex=3",
  };
  const bySource = resolvePortalGroupRow(
    [buyuk, bagcilar],
    { provinceName: "İSTANBUL", districtName: "BÜYÜKÇEKMECE", placeName: "" },
    { provinceName: "İSTANBUL", districtName: "Sabiha Gökçen Havalimanı", placeName: "" },
  );
  assert.equal(bySource.ok, true);
  if (bySource.ok) assert.equal(bySource.group.grupIndex, 0);
  const ambiguous = resolvePortalGroupRow(
    [buyuk, bagcilar],
    { provinceName: "İSTANBUL", districtName: "FATİH", placeName: "" },
    { provinceName: "İSTANBUL", districtName: "ŞİŞLİ", placeName: "" },
  );
  assert.equal(ambiguous.ok, false);
  if (!ambiguous.ok) assert.equal(ambiguous.error, "ambiguous_group_match");
  const live = readFileSync("lib/uetds/kamu-portal/live-update.ts", "utf8");
  const tripMatch = live.indexOf("matchPortalTrip(");
  const groupSelect = live.indexOf("resolvePortalGroupRow(groups, plan.oldPickup, plan.oldDropoff)");
  assert.ok(tripMatch >= 0 && tripMatch < groupSelect);
  assert.doesNotMatch(live, /resolvePortalGroupRow\([^)]*newPickup/);
});

test("placeholder passengers match the full ministry name, not the first word or a stale index", () => {
  const person = (index: number, name: string, gender: string) =>
    `<tr><td>LY</td><td>11111111111</td><td>${name}</td><td>${gender}</td><td><a href="?asama=yeniYolcu&amp;yolcuIndex=${index}">Güncelle</a></td></tr>`;
  const listed = parsePortalPassengerRows([
    person(8, "IBRAHIM MUTFAH AHMED ELALAM", "Erkek"),
    person(3, "IMAN MOFTAH ELMASSALATI", "Kadın"),
    person(11, "MUFFTAH IBRAHIM ELALAM", "Erkek"),
    person(2, "OICE IBRAHIM ELALAM", "Erkek"),
    person(5, "ZAIANB MUTFAH ALMASALATI", "Kadın"),
    person(6, "AYHAM IBRAHIM ELALAM", "Erkek"),
  ].join(""));
  const source = (firstName: string, lastName: string, gender: string) =>
    ({ index: 1, nationality: "LY", documentNumber: "11111111111", firstName, lastName, gender });
  assert.deepEqual(matchExistingPassenger(listed, source("Ibrahim Mutfah Ahmed", "Elalam", "male")), { ok: true, index: 8 });
  assert.deepEqual(matchExistingPassenger(listed, source("Iman Moftah", "Elmassalati", "female")), { ok: true, index: 3 });
  assert.deepEqual(matchExistingPassenger(listed, source("Zaianb Mutfah", "Almasalati", "female")), { ok: true, index: 5 });
  const [ibrahim, oice] = planPassengerReplacements(
    [source("Ibrahim Mutfah Ahmed", "Elalam", "male"), source("Oice Ibrahim", "Elalam", "male")],
    [
      { index: 1, nationality: "KR", documentNumber: "M868P8841", firstName: "Donglee", lastName: "Shin", gender: "male" },
      { index: 4, nationality: "LY", documentNumber: "11111111111", firstName: "Oice Ibrahim", lastName: "Elalam", gender: "male" },
    ],
  );
  assert.deepEqual(nextPassengerSyncStep(ibrahim!, listed), { action: "update", yolcuIndex: 8 });
  assert.equal(nextPassengerSyncStep(oice!, listed).action, "skip");
  const twin = parsePortalPassengerRows([
    person(1, "IBRAHIM MUTFAH AHMED ELALAM", "Erkek"),
    person(2, "IBRAHIM MUTFAH AHMED ELALAM", "Erkek"),
  ].join(""));
  assert.equal(matchExistingPassenger(twin, source("Ibrahim Mutfah Ahmed", "Elalam", "male")).ok, false);
  assert.equal(passengerError(matchExistingPassenger(twin, source("Ibrahim Mutfah Ahmed", "Elalam", "male"))), "ambiguous_passenger_match");
  const byPassport = matchExistingPassenger(listed, { index: 9, nationality: "KR", documentNumber: "M868P8841", firstName: "Other", lastName: "Person", gender: "male" });
  assert.equal(byPassport.ok, false);
  const passportRows = parsePortalPassengerRows(`<tr><td>KR</td><td>M868P8841</td><td>DONGLEE SHIN</td><td>Erkek</td><td><a href="?asama=yeniYolcu&amp;yolcuIndex=4">Güncelle</a></td></tr>`);
  const [passportSwap] = planPassengerReplacements(
    [{ index: 1, nationality: "KR", documentNumber: "M868P8841", firstName: "Donglee", lastName: "Shin", gender: "male" }],
    [{ index: 1, nationality: "CN", documentNumber: "EC7094049", firstName: "Chong", lastName: "Sun", gender: "male" }],
  );
  assert.deepEqual(nextPassengerSyncStep(passportSwap!, passportRows), { action: "update", yolcuIndex: 4 });
  const [fallbackDoc] = planPassengerReplacements(
    [{ index: 1, nationality: "LY", documentNumber: "AB123456", firstName: "Ibrahim Mutfah Ahmed", lastName: "Elalam", gender: "male" }],
    [{ index: 1, nationality: "KR", documentNumber: "M868P8841", firstName: "Donglee", lastName: "Shin", gender: "male" }],
  );
  assert.deepEqual(nextPassengerSyncStep(fallbackDoc!, listed), { action: "update", yolcuIndex: 8 });
});
