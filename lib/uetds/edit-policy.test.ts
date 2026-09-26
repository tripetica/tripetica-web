import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { istanbulLocalToUtcMs } from "@/lib/booking/istanbul-time";
import {
  effectiveUetdsStartForNewPassenger,
  evaluateUetdsEditWindow,
  foldUetdsSearchPlate,
  formatUetdsSnapshotDateTime,
  isUetdsNewStartSafe,
  uetdsDateInputValue,
  uetdsTimeInputValue,
  UETDS_V15_PASSENGER_MUTATIONS,
} from "@/lib/uetds/edit-policy";
import { normalizeUetdsPersonName } from "@/lib/uetds/passenger-name";
import { parseMinistryLastPassengerNotify } from "@/lib/uetds/ministry-last-passenger";
import { uetdsFormCopy } from "@/lib/uetds/copy";
import { createEmptyDraft, createPassengerDraft } from "@/lib/uetds/draft";
import { describeUetdsEditChanges, diffUetdsEdit } from "@/lib/uetds/manage-diff";
import {
  applyUetdsPassengerCountWindow,
  classifyUetdsPassengers,
  expectedFinalPassengerCount,
  ministryListedActivePassengerCount,
  uetdsPassengerCountMismatch,
} from "@/lib/uetds/passenger-class";
import { parseUetdsBildirimOzetiXml } from "@/lib/uetds/ministry-ozet-parse";

function source(path: string) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

test("list dates come from final snapshot start/end not created_at UTC", () => {
  const list = source("components/uetds/uetds-notification-list.tsx");
  assert.match(list, /startLabel/);
  assert.match(list, /endLabel/);
  assert.doesNotMatch(list, /createdAt\.slice/);
  assert.match(source("lib/uetds/notifications.ts"), /formatUetdsSnapshotDateTime/);
  assert.match(source("lib/uetds/notifications.ts"), /snapshot->'trip'->>'startDate'/);
  assert.equal(formatUetdsSnapshotDateTime("2026-09-20", "05:00"), "20.09.2026 05:00");
});

test("plate search folds spaces so 34EGP847 matches 34 EGP 847", () => {
  assert.equal(foldUetdsSearchPlate("34 EGP 847"), "34EGP847");
  assert.equal(foldUetdsSearchPlate("34EGP847"), foldUetdsSearchPlate("34 egp 847"));
  assert.match(source("lib/uetds/notifications.ts"), /regexp_replace/);
});

test("edit window locks start and passenger count at 61 minutes or less", () => {
  const now = istanbulLocalToUtcMs("2026-09-20T10:00");
  const open = evaluateUetdsEditWindow("2026-09-20", "11:10", now);
  assert.equal(open.canAddNewPassenger, true);
  assert.equal(open.canRemoveExistingPassenger, true);
  assert.equal(open.canChangePassengerCount, true);
  assert.equal(open.canChangeStart, true);
  const closed = evaluateUetdsEditWindow("2026-09-20", "11:01", now);
  assert.equal(closed.canAddNewPassenger, false);
  assert.equal(closed.canRemoveExistingPassenger, false);
  assert.equal(closed.canChangePassengerCount, false);
  assert.equal(closed.canChangeStart, false);
  assert.equal(isUetdsNewStartSafe("2026-09-20", "11:01", now), false);
  assert.equal(isUetdsNewStartSafe("2026-09-20", "11:02", now), true);
});

test("V15 has no yolcuGuncelle; existing correction is cancel-by-ref then add", () => {
  assert.equal(UETDS_V15_PASSENGER_MUTATIONS.update, null);
  assert.deepEqual(UETDS_V15_PASSENGER_MUTATIONS.correctionSequence, [
    "yolcuIptalUetdsYolcuRefNoIle",
    "yolcuEkle",
  ]);
  const env = source("lib/uetds/ministry-env.ts");
  assert.doesNotMatch(env, /yolcuGuncelle/);
  assert.match(env, /yolcuIptalUetdsYolcuRefNoIle/);
  assert.match(env, /bildirimOzeti/);
  assert.match(env, /personelIptal/);
  assert.doesNotMatch(env, /personelGuncelle/);
  assert.match(source("lib/uetds/manage.ts"), /yolcuIptalUetdsYolcuRefNoIle/);
  assert.match(source("lib/uetds/manage.ts"), /passenger-count-mismatch/);
  assert.match(source("lib/uetds/manage.ts"), /new-passenger-blocked/);
  assert.match(source("lib/uetds/manage.ts"), /removed-passenger-blocked/);
  assert.match(source("lib/uetds/manage.ts"), /REMOVED_EXISTING/);
  assert.doesNotMatch(
    source("lib/uetds/manage.ts"),
    /if \(requested\.includes\("removedPassenger"\)\) \{\s*return \{ ok: false, error: "invalid" \}/,
  );
  assert.doesNotMatch(source("lib/uetds/manage.ts"), /adjustUetdsTripTimesForSubmit/);
  assert.match(source("lib/uetds/submit.ts"), /adjustUetdsTripTimesForSubmit/);
  const closed = evaluateUetdsEditWindow(
    "2026-09-20",
    "11:01",
    istanbulLocalToUtcMs("2026-09-20T10:00"),
  );
  assert.equal(closed.canCorrectExistingPassengerViaMinistry, true);
  assert.equal(closed.canAddNewPassenger, false);
  assert.equal(closed.canRemoveExistingPassenger, false);
});

test("last passenger notify is parsed from official PDF text only", () => {
  assert.equal(
    parseMinistryLastPassengerNotify("SEFER TARIHI 20/09/2026 01:30 SON YOLCU BİLDİRİM TARİHİ 20/09/2026 00:25:38"),
    "20/09/2026 00:25:38",
  );
  assert.equal(
    parseMinistryLastPassengerNotify("BELGE NO ANK.U-NET.D2.34.685 SON YOLCU BÝLDÝRÝM TARÝHÝ 20/09/2026 01:50:09 D2"),
    "20/09/2026 01:50:09",
  );
  assert.equal(parseMinistryLastPassengerNotify("no such field"), null);
  assert.match(source("components/uetds/uetds-notification-detail.tsx"), /ministry_pdf|ministry_ozet/);
  assert.doesNotMatch(source("components/uetds/uetds-notification-detail.tsx"), /createdAt/);
});

test("confirm summary shows human-readable field diffs", () => {
  const original = createEmptyDraft("manual", { applyTripDefaults: false });
  original.destination = "Şişli";
  original.passengers = [
    {
      ...original.passengers[0]!,
      firstName: "Ada",
      lastName: "Çelik",
      identityNumber: "1",
      nationality: "TR",
      gender: "female",
    },
  ];
  const edited = structuredClone(original);
  edited.destination = "Bakırköy";
  edited.passengers[0]!.lastName = "Çelikkan";
  const lines = describeUetdsEditChanges(original, edited, uetdsFormCopy.tr);
  assert.ok(lines.some((line) => line.includes("Bırakma Yeri") && line.includes("Şişli") && line.includes("Bakırköy")));
  assert.ok(lines.some((line) => line.includes("Soyad") && line.includes("Çelik") && line.includes("Çelikkan")));
});

test("3 existing edits classify as EDITED_EXISTING and expected count stays 3", () => {
  const original = createEmptyDraft("manual", { applyTripDefaults: false });
  original.passengers = [
    createPassengerDraft({ firstName: "Ada", lastName: "Yilmaz", identityNumber: "1", nationality: "TR", gender: "female", ministryReference: "r1" }),
    createPassengerDraft({ firstName: "Ege", lastName: "Kaya", identityNumber: "2", nationality: "TR", gender: "male", ministryReference: "r2" }),
    createPassengerDraft({ firstName: "Can", lastName: "Demir", identityNumber: "3", nationality: "DE", gender: "male", ministryReference: "r3" }),
  ];
  const edited = structuredClone(original);
  edited.passengers[0]!.firstName = "Ayse";
  edited.passengers[1]!.identityNumber = "22";
  edited.passengers[2]!.nationality = "TR";
  const classified = classifyUetdsPassengers(original, edited, ["r1", "r2", "r3"]);
  assert.deepEqual(
    classified.map((item) => item.kind),
    ["EDITED_EXISTING", "EDITED_EXISTING", "EDITED_EXISTING"],
  );
  assert.equal(expectedFinalPassengerCount(classified), 3);
  assert.equal(classified.filter((item) => item.kind === "GENUINELY_NEW").length, 0);
});

test("bildirimOzeti parser counts only Geçerli passengers", () => {
  const xml = `<return>
    <bildirilenYolcuSayisi>6</bildirilenYolcuSayisi>
    <iptalYolcuSayisi>3</iptalYolcuSayisi>
    <sonYolcuBildirimTarihi>20/09/2026 00:25:38</sonYolcuBildirimTarihi>
    <ariziYolcuListesi><adi>A</adi><soyadi>Bir</soyadi><durumAciklama>Geçerli</durumAciklama><uetdsBiletRefNo>1</uetdsBiletRefNo></ariziYolcuListesi>
    <ariziYolcuListesi><adi>Aold</adi><soyadi>Bir</soyadi><durumAciklama>İptal</durumAciklama><uetdsBiletRefNo>11</uetdsBiletRefNo></ariziYolcuListesi>
    <ariziYolcuListesi><adi>B</adi><soyadi>Iki</soyadi><durumAciklama>Geçerli</durumAciklama><uetdsBiletRefNo>2</uetdsBiletRefNo></ariziYolcuListesi>
    <ariziYolcuListesi><adi>Bold</adi><soyadi>Iki</soyadi><durumAciklama>İptal</durumAciklama><uetdsBiletRefNo>22</uetdsBiletRefNo></ariziYolcuListesi>
    <ariziYolcuListesi><adi>C</adi><soyadi>Uc</soyadi><durumAciklama>Geçerli</durumAciklama><uetdsBiletRefNo>3</uetdsBiletRefNo></ariziYolcuListesi>
    <ariziYolcuListesi><adi>Cold</adi><soyadi>Uc</soyadi><durumAciklama>İptal</durumAciklama><uetdsBiletRefNo>33</uetdsBiletRefNo></ariziYolcuListesi>
  </return>`;
  const parsed = parseUetdsBildirimOzetiXml(xml);
  assert.equal(parsed.bildirilenYolcuSayisi, 6);
  assert.equal(parsed.iptalYolcuSayisi, 3);
  assert.equal(parsed.activeCount, 3);
  assert.equal(parsed.sonYolcuBildirimTarihi, "20/09/2026 00:25:38");
});

test("diff treats extra passenger rows as newPassenger not existing correction", () => {
  const original = createEmptyDraft("manual", { applyTripDefaults: false });
  original.passengers = [
    { ...original.passengers[0]!, firstName: "Ada", lastName: "Yilmaz", identityNumber: "1", nationality: "TR", gender: "female" },
  ];
  const edited = structuredClone(original);
  edited.passengers.push({
    ...original.passengers[0]!,
    key: "new",
    firstName: "Ege",
    lastName: "Kaya",
    identityNumber: "2",
  });
  assert.deepEqual(diffUetdsEdit(original, edited), ["newPassenger"]);
  edited.passengers[0]!.lastName = "Celik";
  assert.ok(diffUetdsEdit(original, edited).includes("existingPassenger"));
});

test("edit window serialization never uses NaN and date/time inputs stay HH:mm", () => {
  const invalid = evaluateUetdsEditWindow("", "", 1);
  assert.equal(invalid.remainingMs, null);
  assert.equal(invalid.remainingMinutes, null);
  assert.equal(JSON.parse(JSON.stringify(invalid)).canChangeStart, false);
  assert.equal(uetdsDateInputValue("2026-09-20T05:00"), "2026-09-20");
  assert.equal(uetdsTimeInputValue("05:00:38"), "05:00");
});

test("new passenger 61-minute check uses final start unless seferGuncelle failed", () => {
  const now = istanbulLocalToUtcMs("2026-09-20T02:53");
  const final = effectiveUetdsStartForNewPassenger({
    originalStartDate: "2026-09-20",
    originalStartTime: "04:00",
    finalStartDate: "2026-09-20",
    finalStartTime: "05:00",
  });
  assert.equal(final.startTime, "05:00");
  assert.equal(evaluateUetdsEditWindow(final.startDate, final.startTime, now).canAddNewPassenger, true);
  const afterFailedStart = effectiveUetdsStartForNewPassenger({
    originalStartDate: "2026-09-20",
    originalStartTime: "03:50",
    finalStartDate: "2026-09-20",
    finalStartTime: "05:00",
    seferUpdateSonucKodu: 1,
  });
  assert.equal(afterFailedStart.startTime, "03:50");
  assert.equal(
    evaluateUetdsEditWindow(afterFailedStart.startDate, afterFailedStart.startTime, now).canAddNewPassenger,
    false,
  );
  const manage = source("lib/uetds/manage.ts");
  assert.match(manage, /effectiveUetdsStartForNewPassenger/);
  assert.match(manage, /intendedWindow/);
  assert.doesNotMatch(manage, /evaluateUetdsEditWindow\(\s*original\.startDate,\s*original\.startTime,\s*Date\.now\(\)/);
});

test("deleting a middle existing passenger classifies by Ministry ref not row index", () => {
  const original = createEmptyDraft("manual", { applyTripDefaults: false });
  original.passengers = [
    createPassengerDraft({ firstName: "Ada", lastName: "Yilmaz", identityNumber: "1", nationality: "TR", gender: "female", ministryReference: "r1" }),
    createPassengerDraft({ firstName: "Ege", lastName: "Kaya", identityNumber: "2", nationality: "TR", gender: "male", ministryReference: "r2" }),
    createPassengerDraft({ firstName: "Can", lastName: "Demir", identityNumber: "3", nationality: "DE", gender: "male", ministryReference: "r3" }),
    createPassengerDraft({ firstName: "Ela", lastName: "Kurt", identityNumber: "4", nationality: "TR", gender: "female", ministryReference: "r4" }),
    createPassengerDraft({ firstName: "Naz", lastName: "Polat", identityNumber: "5", nationality: "TR", gender: "female", ministryReference: "r5" }),
  ];
  const edited = structuredClone(original);
  edited.passengers.splice(2, 1);
  const classified = classifyUetdsPassengers(original, edited, ["r1", "r2", "r3", "r4", "r5"]);
  assert.deepEqual(
    classified.map((item) => item.kind),
    ["UNCHANGED_EXISTING", "UNCHANGED_EXISTING", "REMOVED_EXISTING", "UNCHANGED_EXISTING", "UNCHANGED_EXISTING"],
  );
  assert.equal(classified.find((item) => item.kind === "REMOVED_EXISTING")?.ministryReference, "r3");
  assert.equal(expectedFinalPassengerCount(classified), 4);
  assert.deepEqual(diffUetdsEdit(original, edited), ["removedPassenger"]);
});

test("mixed edit+delete+add expected count is original - removed + new", () => {
  const original = createEmptyDraft("manual", { applyTripDefaults: false });
  original.passengers = [
    createPassengerDraft({ firstName: "Ada", lastName: "Yilmaz", identityNumber: "1", nationality: "TR", gender: "female", ministryReference: "r1" }),
    createPassengerDraft({ firstName: "Ege", lastName: "Kaya", identityNumber: "2", nationality: "TR", gender: "male", ministryReference: "r2" }),
    createPassengerDraft({ firstName: "Can", lastName: "Demir", identityNumber: "3", nationality: "DE", gender: "male", ministryReference: "r3" }),
    createPassengerDraft({ firstName: "Ela", lastName: "Kurt", identityNumber: "4", nationality: "TR", gender: "female", ministryReference: "r4" }),
    createPassengerDraft({ firstName: "Naz", lastName: "Polat", identityNumber: "5", nationality: "TR", gender: "female", ministryReference: "r5" }),
  ];
  const edited = structuredClone(original);
  edited.passengers[0]!.firstName = "Ayse";
  edited.passengers = [
    edited.passengers[0]!,
    edited.passengers[3]!,
    edited.passengers[4]!,
    createPassengerDraft({ firstName: "Yeni", lastName: "Yolcu", identityNumber: "6", nationality: "TR", gender: "male" }),
  ];
  const classified = classifyUetdsPassengers(original, edited, ["r1", "r2", "r3", "r4", "r5"]);
  assert.deepEqual(
    classified.map((item) => item.kind),
    [
      "EDITED_EXISTING",
      "REMOVED_EXISTING",
      "REMOVED_EXISTING",
      "UNCHANGED_EXISTING",
      "UNCHANGED_EXISTING",
      "GENUINELY_NEW",
    ],
  );
  assert.equal(expectedFinalPassengerCount(classified), 4);
  const closed = applyUetdsPassengerCountWindow(original, edited, ["r1", "r2", "r3", "r4", "r5"], false);
  assert.equal(closed.length, 5);
  assert.equal(closed[0]!.firstName, "Ayse");
  assert.equal(closed[2]!.ministryReference, "r3");
  assert.ok(!closed.some((item) => item.firstName === "Yeni"));
});

test("<=61 window restores removed existing and drops genuinely new", () => {
  const original = createEmptyDraft("manual", { applyTripDefaults: false });
  original.passengers = [
    createPassengerDraft({ firstName: "Ada", lastName: "Yilmaz", identityNumber: "1", nationality: "TR", gender: "female", ministryReference: "r1" }),
    createPassengerDraft({ firstName: "Ege", lastName: "Kaya", identityNumber: "2", nationality: "TR", gender: "male", ministryReference: "r2" }),
    createPassengerDraft({ firstName: "Can", lastName: "Demir", identityNumber: "3", nationality: "DE", gender: "male", ministryReference: "r3" }),
  ];
  const edited = structuredClone(original);
  edited.passengers[0]!.lastName = "Celik";
  edited.passengers.splice(2, 1);
  edited.passengers.push(
    createPassengerDraft({ firstName: "Yeni", lastName: "Yolcu", identityNumber: "9", nationality: "TR", gender: "female" }),
  );
  const restored = applyUetdsPassengerCountWindow(original, edited, ["r1", "r2", "r3"], false);
  assert.equal(restored.length, 3);
  assert.equal(restored[0]!.lastName, "Celik");
  assert.equal(restored[2]!.ministryReference, "r3");
  const classified = classifyUetdsPassengers(original, { ...edited, passengers: restored }, ["r1", "r2", "r3"]);
  assert.deepEqual(
    classified.map((item) => item.kind),
    ["EDITED_EXISTING", "UNCHANGED_EXISTING", "UNCHANGED_EXISTING"],
  );
  assert.equal(expectedFinalPassengerCount(classified), 3);
});

test("3 existing + 1 genuinely new expected count is 4 not 6", () => {
  const original = createEmptyDraft("manual", { applyTripDefaults: false });
  original.passengers = [
    createPassengerDraft({ firstName: "Ada", lastName: "Yilmaz", identityNumber: "1", nationality: "TR", gender: "female", ministryReference: "r1" }),
    createPassengerDraft({ firstName: "Ege", lastName: "Kaya", identityNumber: "2", nationality: "TR", gender: "male", ministryReference: "r2" }),
    createPassengerDraft({ firstName: "Can", lastName: "Demir", identityNumber: "3", nationality: "DE", gender: "male", ministryReference: "r3" }),
  ];
  const edited = structuredClone(original);
  edited.passengers[0]!.firstName = "Ayse";
  edited.passengers.push(
    createPassengerDraft({ firstName: "Dort", lastName: "Yolcu", identityNumber: "4", nationality: "TR", gender: "female" }),
  );
  const classified = classifyUetdsPassengers(original, edited, ["r1", "r2", "r3"]);
  assert.deepEqual(
    classified.map((item) => item.kind),
    ["EDITED_EXISTING", "UNCHANGED_EXISTING", "UNCHANGED_EXISTING", "GENUINELY_NEW"],
  );
  assert.equal(expectedFinalPassengerCount(classified), 4);
});

test("edit form surfaces Ministry sonucMesaji instead of generic saveFailed", () => {
  const form = source("components/uetds/uetds-notification-edit-form.tsx");
  assert.match(form, /error === "ministry"/);
  assert.match(form, /ministryFailed/);
  assert.match(form, /manageMessage\(state\.error, copy, state\.message, ministryEnv\)/);
  assert.doesNotMatch(form, /suppressHydrationWarning/);
});

test("person names drop iOS invisible characters before Ministry", () => {
  assert.equal(normalizeUetdsPersonName("Çiğdem\u200B"), "Çiğdem");
  assert.equal(normalizeUetdsPersonName("Hakan\u00A0Kemal"), "Hakan Kemal");
  assert.equal(normalizeUetdsPersonName("  TESTDORT  YOLCU  "), "TESTDORT YOLCU");
  assert.equal(normalizeUetdsPersonName("Алексей"), "Aleksey");
  assert.match(source("lib/uetds/ministry-mutate.ts"), /normalizeUetdsPersonName/);
});

test("edit form first paint does not stringify the draft or use client Date.now", () => {
  const form = source("components/uetds/uetds-notification-edit-form.tsx");
  assert.match(form, /mounted \? JSON\.stringify\(draft\) : ""/);
  assert.match(form, /type=\{mounted \? "date" : "text"\}/);
  assert.match(form, /type=\{mounted \? "time" : "text"\}/);
  assert.match(form, /uetdsTimeInputValue\(event\.target\.value\)/);
  assert.match(form, /uetdsDateInputValue\(event\.target\.value\)/);
  assert.match(form, /canRemoveExistingPassenger/);
  assert.match(form, /isExistingMinistryPassenger/);
  assert.match(form, /editPassengerCountLocked/);
  assert.doesNotMatch(form, /Date\.now\(/);
  assert.doesNotMatch(form, /suppressHydrationWarning/);
  assert.match(source("app/[locale]/partner/(panel)/uetds/notifications/[id]/edit/page.tsx"), /Date\.now\(\)/);
});

test("<=61 two existing corrections keep expected active count 2", () => {
  const original = createEmptyDraft("manual", { applyTripDefaults: false });
  original.passengers = [
    createPassengerDraft({ firstName: "Ahmet", lastName: "Yilmaz", identityNumber: "123", nationality: "TR", gender: "male", ministryReference: "p1" }),
    createPassengerDraft({ firstName: "Mehmet", lastName: "Kaya", identityNumber: "456", nationality: "DE", gender: "male", ministryReference: "p2" }),
  ];
  const edited = structuredClone(original);
  edited.passengers[0]!.firstName = "Ahmet Can";
  edited.passengers[0]!.nationality = "TR";
  edited.passengers[1]!.lastName = "Kayaoglu";
  edited.passengers[1]!.identityNumber = "789";
  edited.passengers[1]!.nationality = "TR";
  const classified = classifyUetdsPassengers(original, edited, ["p1", "p2"]);
  assert.deepEqual(
    classified.map((item) => item.kind),
    ["EDITED_EXISTING", "EDITED_EXISTING"],
  );
  assert.equal(expectedFinalPassengerCount(classified), 2);
  assert.equal(
    uetdsPassengerCountMismatch({
      classified,
      ministryActiveCount: 2,
      editedExistingCorrectionsSucceeded: true,
    }),
    false,
  );
  const afterList = parseUetdsBildirimOzetiXml(`<return>
    <bildirilenYolcuSayisi>4</bildirilenYolcuSayisi>
    <iptalYolcuSayisi>2</iptalYolcuSayisi>
    <ariziYolcuListesi><adi>Ahmet</adi><soyadi>Yilmaz</soyadi><durumAciklama>İptal</durumAciklama></ariziYolcuListesi>
    <ariziYolcuListesi><adi>Mehmet</adi><soyadi>Kaya</soyadi><durumAciklama>İptal</durumAciklama></ariziYolcuListesi>
    <ariziYolcuListesi><adi>Ahmet Can</adi><soyadi>Yilmaz</soyadi><durumAciklama>Geçerli</durumAciklama></ariziYolcuListesi>
    <ariziYolcuListesi><adi>Mehmet</adi><soyadi>Kayaoglu</soyadi><durumAciklama>Geçerli</durumAciklama></ariziYolcuListesi>
  </return>`);
  assert.equal(afterList.bildirilenYolcuSayisi, 4);
  assert.equal(afterList.iptalYolcuSayisi, 2);
  assert.equal(ministryListedActivePassengerCount(afterList), 2);
  assert.equal(
    uetdsPassengerCountMismatch({
      classified,
      ministryActiveCount: ministryListedActivePassengerCount(afterList),
      editedExistingCorrectionsSucceeded: true,
    }),
    false,
  );
  assert.equal(
    uetdsPassengerCountMismatch({
      classified,
      ministryActiveCount: null,
      editedExistingCorrectionsSucceeded: true,
    }),
    false,
  );
});

test("reservation U-ETDS button and submit use one active sefer per reservation", () => {
  assert.equal(uetdsFormCopy.tr.notifyEditAction, "U-ETDS Bildirimini Düzenle");
  assert.match(source("lib/uetds/submit.ts"), /duplicate-reservation/);
  assert.match(source("lib/uetds/submit.ts"), /findActiveUetdsNotificationForReservation/);
  assert.match(source("lib/uetds/manage.ts"), /item\.kind === "GENUINELY_NEW"/);
  assert.match(source("lib/uetds/manage.ts"), /item\.kind === "REMOVED_EXISTING"/);
  assert.match(source("db/migrations/059_uetds_one_active_per_reservation.sql"), /uetds_notifications_one_active_per_reservation_idx/);
  assert.match(source("app/[locale]/ops/(panel)/reservations/[id]/page.tsx"), /notifyEditAction/);
  assert.match(source("app/[locale]/partner/(panel)/accepted/[id]/page.tsx"), /notifyEditAction/);
  assert.match(source("app/[locale]/ops/(panel)/uetds/notifications/new/page.tsx"), /redirect/);
  assert.match(source("app/[locale]/partner/(panel)/uetds/notifications/new/page.tsx"), /redirect/);
  assert.match(source("components/uetds/uetds-notification-form.tsx"), /duplicate-reservation/);
});

test("sticky action order is PDF, Edit, Cancel, Close", () => {
  const detail = source("components/uetds/uetds-notification-detail.tsx");
  const pdf = detail.indexOf("ministryPdfDownload");
  const edit = detail.indexOf("{copy.edit}");
  const cancel = detail.indexOf("cancelTrip");
  const close = detail.indexOf("backToList");
  assert.ok(pdf > 0 && pdf < edit && edit < cancel && cancel < close);
  assert.match(source("app/globals.css"), /\.uetds-sticky-actions \{[\s\S]*position:\s*sticky/);
});
