import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import {
  resolveVehicleDocumentPath,
  sniffVehicleDocument,
  writeVehicleDocumentBytes,
  removeVehicleDocumentFile,
} from "@/lib/gps/document-files";
import {
  VEHICLE_DOCUMENT_TYPES,
  cleanPolicyNumber,
  documentDaysLeft,
  documentReminderAudience,
  documentReminderClaimKey,
  documentReminderClock,
  documentReminderDue,
  documentReminderMessage,
  documentStatus,
  documentTypeName,
  fileToDeleteAfterCommit,
  istanbulDocumentDate,
  nextDocumentRecord,
  parseDocumentDate,
} from "@/lib/gps/documents";

const vehicleId = "11111111-1111-4111-8111-111111111111";
const otherId = "22222222-2222-4222-8222-222222222222";

test("document status uses the 20 day Istanbul boundary", () => {
  const today = "2026-11-06";
  assert.equal(documentStatus(null, today), "empty");
  assert.equal(documentStatus("2026-11-27", today), "valid");
  assert.equal(documentDaysLeft("2026-11-27", today), 21);
  assert.equal(documentStatus("2026-11-26", today), "approaching");
  assert.equal(documentDaysLeft("2026-11-26", today), 20);
  assert.equal(documentStatus("2026-11-06", today), "approaching");
  assert.equal(documentStatus("2026-11-05", today), "expired");
  assert.equal(documentDaysLeft("2026-11-05", today), -1);
  assert.equal(parseDocumentDate("2026-02-31"), null);
  assert.equal(parseDocumentDate("2027-09-22"), "2027-09-22");
  assert.equal(cleanPolicyNumber("  A  12\n"), "A 12");
});

test("reminder clocks are 10:00 for 20-8 days and both clocks from day 7", () => {
  const morning = new Date("2026-11-06T07:05:00Z");
  const afternoon = new Date("2026-11-06T11:10:00Z");
  const late = new Date("2026-11-06T07:21:00Z");
  assert.equal(istanbulDocumentDate(morning), "2026-11-06");
  assert.equal(documentReminderClock(morning), "10:00");
  assert.equal(documentReminderClock(afternoon), "14:00");
  assert.equal(documentReminderClock(late), null);
  assert.equal(documentReminderDue(20, "10:00"), true);
  assert.equal(documentReminderDue(20, "14:00"), false);
  assert.equal(documentReminderDue(8, "14:00"), false);
  assert.equal(documentReminderDue(7, "10:00"), true);
  assert.equal(documentReminderDue(7, "14:00"), true);
  assert.equal(documentReminderDue(0, "14:00"), true);
  assert.equal(documentReminderDue(-3, "10:00"), true);
  assert.equal(documentReminderDue(21, "10:00"), false);
});

test("renewal changes the reminder claim and does not keep a duplicate audience", () => {
  const first = documentReminderClaimKey({
    documentId: "doc",
    expiresOn: "2026-11-26",
    notifyOn: "2026-11-06",
    clock: "10:00",
    channel: "email",
    userId: "user-a",
  });
  const renewed = documentReminderClaimKey({
    documentId: "doc",
    expiresOn: "2027-11-26",
    notifyOn: "2026-11-06",
    clock: "10:00",
    channel: "email",
    userId: "user-a",
  });
  assert.notEqual(first, renewed);
  const audience = documentReminderAudience([
    { userId: "user-a", email: "A@Example.com" },
    { userId: "user-a", email: "a@example.com" },
    { userId: "user-b", email: "a@example.com" },
    { userId: "user-c", email: "c@example.com" },
  ]);
  assert.deepEqual(audience.emailTargets.map((item) => item.userId), ["user-a", "user-c"]);
  assert.deepEqual(audience.userIds, ["user-a", "user-b", "user-c"]);
  const message = documentReminderMessage({
    plate: "34 AN 9626",
    name: documentTypeName("ibb_route_permit", "tr"),
    expiresOn: "2027-09-22",
    daysLeft: 12,
  });
  assert.match(message.subject, /34 AN 9626/);
  assert.match(message.text, /İBB Yol Güzergâh İzin Belgesi/);
  assert.match(message.text, /22\.09\.2027/);
  assert.match(message.text, /Kalan gün: 12/);
});

test("renewal replaces the current row and drops the old file without a history record", () => {
  const existing = {
    expiresOn: "2027-09-22",
    policyNumber: "OLD",
    filePath: `${vehicleId}/ibb_route_permit/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.pdf`,
    fileMime: "application/pdf",
    fileName: "ibb_route_permit.pdf",
  };
  const renewed = nextDocumentRecord({
    mode: "renew",
    existing,
    expiresOn: "2028-09-22",
    policyNumber: null,
    upload: {
      path: `${vehicleId}/ibb_route_permit/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.pdf`,
      mime: "application/pdf",
      name: "ibb_route_permit.pdf",
    },
    removeFile: false,
  });
  assert.equal(renewed.ok, true);
  if (!renewed.ok) return;
  assert.equal(renewed.expiresOn, "2028-09-22");
  assert.equal(renewed.policyNumber, null);
  assert.equal(renewed.previousPath, existing.filePath);
  const cleared = nextDocumentRecord({
    mode: "renew",
    existing,
    expiresOn: "2028-09-22",
    policyNumber: null,
    upload: null,
    removeFile: false,
  });
  assert.equal(cleared.ok, true);
  if (!cleared.ok) return;
  assert.equal(cleared.filePath, null);
  assert.equal(cleared.previousPath, existing.filePath);
  const edited = nextDocumentRecord({
    mode: "edit",
    existing,
    expiresOn: "2027-09-23",
    policyNumber: "NEW",
    upload: null,
    removeFile: false,
  });
  assert.equal(edited.ok, true);
  if (!edited.ok) return;
  assert.equal(edited.filePath, existing.filePath);
  assert.equal(edited.previousPath, null);
  assert.equal(fileToDeleteAfterCommit({ previousPath: existing.filePath, referencedByOther: true }), null);
  assert.equal(fileToDeleteAfterCommit({ previousPath: existing.filePath, referencedByOther: false }), existing.filePath);
  assert.equal(nextDocumentRecord({
    mode: "create",
    existing,
    expiresOn: "2028-01-01",
    policyNumber: null,
    upload: null,
    removeFile: false,
  }).ok, false);
});

test("files are sniffed and a shared path is not a stored traversal", async () => {
  assert.equal(sniffVehicleDocument(Buffer.from("%PDF-1.7\ntrailer"))?.mime, "application/pdf");
  assert.equal(sniffVehicleDocument(Buffer.from([0xff, 0xd8, 0xff, 0x00, 0, 0, 0, 0, 0, 0, 0, 0]))?.mime, "image/jpeg");
  assert.equal(sniffVehicleDocument(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0, 0, 0, 0, 0]))?.mime, "image/png");
  const heic = Buffer.alloc(12);
  heic.write("ftypheic", 4, "latin1");
  assert.equal(sniffVehicleDocument(heic)?.mime, "image/heic");
  assert.equal(sniffVehicleDocument(Buffer.from("<html>not a file</html>")), null);
  const root = mkdtempSync(path.join(tmpdir(), "tripetica-docs-"));
  const previous = process.env.VEHICLE_DOCUMENT_DIR;
  process.env.VEHICLE_DOCUMENT_DIR = root;
  try {
    assert.equal(resolveVehicleDocumentPath("../etc/passwd"), null);
    assert.equal(resolveVehicleDocumentPath(`${vehicleId}/../${otherId}.pdf`), null);
    const stored = await writeVehicleDocumentBytes(vehicleId, "inspection", Buffer.from("%PDF-1.7\nobj"));
    assert.ok(stored);
    const full = resolveVehicleDocumentPath(stored.stored);
    assert.ok(full?.startsWith(root));
    assert.equal(existsSync(full ?? ""), true);
    await removeVehicleDocumentFile(stored.stored);
    assert.equal(existsSync(full ?? ""), false);
  } finally {
    if (previous === undefined) delete process.env.VEHICLE_DOCUMENT_DIR;
    else process.env.VEHICLE_DOCUMENT_DIR = previous;
    rmSync(root, { recursive: true, force: true });
  }
});

test("document tracking uses the selected vehicle and does not add a plate picker or history", () => {
  const live = readFileSync(new URL("../../components/gps/live-section.tsx", import.meta.url), "utf8");
  const panel = readFileSync(new URL("../../components/gps/documents-section.tsx", import.meta.url), "utf8");
  const store = readFileSync(new URL("./document-store.ts", import.meta.url), "utf8");
  const actions = readFileSync(new URL("./document-actions.ts", import.meta.url), "utf8");
  const reminders = readFileSync(new URL("./document-reminders.ts", import.meta.url), "utf8");
  const migration = readFileSync(new URL("../../db/migrations/119_vehicle_documents.sql", import.meta.url), "utf8");
  const driverPage = readFileSync(new URL("../../app/[locale]/(driver-portal)/driver/gps/page.tsx", import.meta.url), "utf8");
  const mobileRun = readFileSync(new URL("./mobile-reminder-run.ts", import.meta.url), "utf8");
  const permissions = readFileSync(new URL("../driver-portal/permissions.ts", import.meta.url), "utf8");
  const fleet = readFileSync(new URL("./fleet.ts", import.meta.url), "utf8");
  const historyAt = live.indexOf("copy.showHistory");
  const documentsAt = live.indexOf("copy.showDocuments");
  const maintenanceAt = live.indexOf("copy.showMaintenance");
  assert.ok(historyAt >= 0 && historyAt < documentsAt && documentsAt < maintenanceAt);
  assert.match(live, /selectedFleet\?\.vehicleId/);
  assert.match(live, /key=\{selectedFleet\.vehicleId\}/);
  assert.match(live, /plate=\{selectedFleet\.plate\}/);
  assert.match(live, /brand=\{selectedFleet\.brand\}/);
  assert.match(live, /model=\{selectedFleet\.model\}/);
  assert.match(panel, /GpsVehicleIdentity/);
  assert.doesNotMatch(panel, /name="plate"|plaka/i);
  const css = readFileSync(new URL("../../app/globals.css", import.meta.url), "utf8");
  const listRule = css.slice(css.indexOf(".gps-doc-list {"), css.indexOf(".gps-doc-card {"));
  assert.match(listRule, /flex-direction:\s*column/);
  assert.doesNotMatch(listRule, /scroll-snap|17\.5rem/);
  assert.doesNotMatch(css, /\.gps-doc-list \{[^}]*flex-direction:\s*row/);
  assert.match(css, /\.gps-doc-card \{[^}]*background:\s*#F5F7FB/);
  assert.match(css, /@media \(max-width: 719px\) \{[\s\S]*\.gps-doc-list \{[\s\S]*flex-direction:\s*column/);
  assert.match(panel, /gps-doc-file-button/);
  assert.match(panel, /gps-doc-save/);
  assert.match(panel, /gps-doc-cancel/);
  assert.match(panel, /copy\.filePick/);
  assert.doesNotMatch(panel, /capture=/);
  assert.match(panel, /name="documentType"/);
  assert.match(panel, /status === "empty"/);
  assert.match(panel, /available\.map/);
  assert.match(panel, /disabled=\{available\.length === 0\}/);
  assert.match(panel, /gps-doc-add/);
  assert.match(panel, /row\.status !== "empty"/);
  assert.match(panel, /target="_blank"/);
  assert.match(panel, /copy\.open/);
  assert.doesNotMatch(panel, /openTab|gps-doc-viewer/);
  assert.match(panel, /gps-doc-delete/);
  assert.match(panel, /copy\.deleteAsk/);
  assert.doesNotMatch(panel, /copy\.renew|mode: "renew"|Belgeyi Yenile/);
  assert.match(panel, /scrollIntoView\(\{ block: "start"/);
  assert.match(panel, /preventScroll: true/);
  assert.match(panel, /visualViewport/);
  assert.match(panel, /mode: "edit"/);
  assert.match(panel, /mode: "create"/);
  const save = store.slice(store.indexOf("export async function saveVehicleDocument"));
  assert.match(save, /writeVehicleDocumentBytes/);
  assert.match(save, /COMMIT/);
  assert.ok(save.indexOf("COMMIT") < save.indexOf("removeUnreferencedDocumentFile"));
  assert.match(save, /ROLLBACK/);
  assert.match(save, /removeVehicleDocumentFile\(uploaded\.stored\)/);
  assert.doesNotMatch(store, /vehicle_document_events|document_history/);
  assert.match(store, /file_path = \$1 AND id <> \$2/);
  assert.match(actions, /documentEditor/);
  assert.doesNotMatch(actions, /getDriverPortalActor/);
  assert.match(reminders, /sendPartnerMail/);
  assert.match(reminders, /sendPartnerPushToSubscriptions/);
  assert.match(reminders, /kind: "vehicle-document"/);
  assert.doesNotMatch(reminders, /Konum Paylaşımı|mobile-gps-reminder|reminderEmailHtml/);
  assert.match(migration, /UNIQUE \(vehicle_id, document_type\)/);
  assert.match(migration, /expires_on, notify_on, clock, channel, partner_user_id/);
  assert.doesNotMatch(migration, /vehicle_document_events|document_history/);
  assert.match(driverPage, /documents: permissions\.gpsDocuments/);
  assert.match(driverPage, /documentsCanEdit=\{false\}/);
  assert.match(driverPage, /documentsUrl="\/api\/driver\/gps\/documents"/);
  assert.match(permissions, /gpsDocuments/);
  const access = readFileSync(new URL("./document-access.ts", import.meta.url), "utf8");
  assert.match(access, /permissions\.gpsDocuments/);
  assert.doesNotMatch(access, /driverHasGpsAccess/);
  const removed = store.slice(store.indexOf("export async function deleteVehicleDocument"));
  assert.match(removed, /DELETE FROM vehicle_documents/);
  assert.ok(removed.indexOf("COMMIT") < removed.indexOf("removeUnreferencedDocumentFile"));
  assert.match(actions, /deleteVehicleDocumentAction/);
  assert.match(migration, /ON DELETE CASCADE/);
  assert.match(fleet, /vehicleIds\.length === 1/);
  assert.equal(VEHICLE_DOCUMENT_TYPES.length, 5);
  assert.doesNotMatch(mobileRun, /sendPartnerMail/);
});
