import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";
import { asPanelLocale } from "@/lib/i18n/config";
import {
  contactDisplayNumbers,
  contactLinks,
  tripeticaPhoneE164,
} from "@/lib/contact/links";
import { assignmentCustomerNotificationCopy } from "@/lib/mail/assignment-customer-notification-copy";
import { buildAssignmentCustomerNotificationBodies } from "@/lib/mail/assignment-customer-notification-body";
import { reservationMailCopy } from "@/lib/mail/reservation-copy";
import {
  buildAssignmentNotifySummaryRows,
  resolveAssignmentNotifyFirstPassengerName,
  resolveAssignmentNotifyVehicleClassLabel,
} from "@/lib/mail/assignment-customer-notification-summary";
import { bookingCopy } from "@/lib/booking/copy";
import { localizedTourName } from "@/lib/booking/tour-display";
import { STANDARD_MINIVAN_CODE } from "@/lib/booking/pricing/vehicle-quote";
import {
  sendAssignmentCustomerNotification,
  type AssignmentNotifyReservationRow,
  type AssignmentNotifyStore,
} from "@/lib/ops/assignment-customer-notification-core";
import {
  assignmentNotifyChangeKind,
  assignmentNotifyUiState,
  buildAssignmentNotifyOutgoing,
  isAssignmentNotifyNoChange,
  mapAssignmentCustomerNotificationRow,
  type AssignmentCustomerNotificationSent,
  type AssignmentNotifyOutgoing,
} from "@/lib/ops/assignment-customer-notification-view";
import { opsCopy } from "@/lib/ops/copy";
import {
  emptyDriverAssignment,
  emptyVehicleAssignment,
  resolveDriverAssignment,
  resolveVehicleAssignment,
  type JobDriverAssignmentView,
  type JobVehicleAssignmentView,
} from "@/lib/partner/job-assignment-view";

const ACTOR = "11111111-1111-4111-8111-111111111111";
const RESERVATION = "22222222-2222-4222-8222-222222222222";
const VEHICLE = "33333333-3333-4333-8333-333333333333";
const DRIVER = "44444444-4444-4444-8444-444444444444";
const VEHICLE_B = "55555555-5555-4555-8555-555555555555";
const DRIVER_B = "66666666-6666-4666-8666-666666666666";

function source(path: string) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

function vehicleView(
  overrides: Partial<JobVehicleAssignmentView> = {},
): JobVehicleAssignmentView {
  return {
    ...emptyVehicleAssignment(),
    kind: "registered",
    vehicleId: VEHICLE,
    plate: "34 BGN 938",
    brand: "Volkswagen",
    model: "Caravelle",
    selection: VEHICLE,
    ...overrides,
  };
}

function driverView(
  overrides: Partial<JobDriverAssignmentView> = {},
): JobDriverAssignmentView {
  return {
    ...emptyDriverAssignment(),
    kind: "registered",
    driverId: DRIVER,
    firstName: "Ramazan",
    lastName: "Rizelioğlu",
    fullName: "Ramazan Rizelioğlu",
    phone: "+905331112233",
    selection: DRIVER,
    ...overrides,
  };
}

function sentFromOutgoing(
  outgoing: AssignmentNotifyOutgoing,
  extras: Partial<AssignmentCustomerNotificationSent> = {},
): AssignmentCustomerNotificationSent {
  return {
    id: extras.id ?? "sent-1",
    sentAt: extras.sentAt ?? new Date().toISOString(),
    sentByUserId: extras.sentByUserId ?? ACTOR,
    scope: outgoing.scope,
    locale: extras.locale ?? "tr",
    vehicleKind: outgoing.vehicleKind,
    vehicleId: outgoing.vehicleId,
    vehiclePlate: outgoing.vehiclePlate,
    vehicleName: outgoing.vehicleName,
    driverKind: outgoing.driverKind,
    driverId: outgoing.driverId,
    driverName: outgoing.driverName,
    driverPhone: outgoing.driverPhone,
    fingerprint: outgoing.fingerprint,
  };
}

type CapturedMail = {
  to: string;
  subject: string;
  text: string;
  html: string;
  messageId: string;
};

function captureMail() {
  const mails: CapturedMail[] = [];
  return {
    mails,
    mailer: async (mail: CapturedMail) => {
      mails.push(mail);
      return { ok: true as const };
    },
  };
}

function reservationRow(
  overrides: Partial<AssignmentNotifyReservationRow> = {},
): AssignmentNotifyReservationRow {
  return {
    id: RESERVATION,
    reservation_code: "TRP-DEV-1",
    locale: "tr",
    status: "confirmed",
    customer_email: "guest@example.com",
    customer_first_name: null,
    customer_last_name: null,
    pickup_at: new Date("2026-09-20T08:00:00.000Z"),
    service_type: null,
    tour_code: null,
    duration_hours: null,
    pickup_name_customer: null,
    pickup_name_tr: null,
    dropoff_name_customer: null,
    dropoff_name_tr: null,
    vehicle_label_customer: null,
    vehicle_label_tr: null,
    vehicle_code: null,
    passengers: [],
    assigned_driver_kind: "registered",
    assigned_driver_id: DRIVER,
    assigned_driver_snapshot: null,
    assigned_vehicle_kind: "registered",
    assigned_vehicle_id: VEHICLE,
    assigned_vehicle_snapshot: null,
    assigned_driver_first_name: "Ramazan",
    assigned_driver_last_name: "Rizelioğlu",
    assigned_driver_phone: "+905331112233",
    assigned_driver_phone_country: "TR",
    assigned_driver_languages: ["tr"],
    assigned_driver_national_id: null,
    assigned_vehicle_plate: "34 BGN 938",
    assigned_vehicle_brand: "Volkswagen",
    assigned_vehicle_model: "Caravelle",
    assigned_vehicle_year: 2022,
    assigned_vehicle_class: null,
    assigned_vehicle_passengers: 7,
    assigned_vehicle_luggage: 6,
    assigned_vehicle_color: null,
    assigned_vehicle_features: null,
    ...overrides,
  };
}

function createMemory(row: AssignmentNotifyReservationRow) {
  const attempts: Array<Parameters<AssignmentNotifyStore["insertAttempt"]>[0]> = [];
  let current = row;
  let lastSent: AssignmentCustomerNotificationSent | null = null;
  const store: AssignmentNotifyStore = {
    async loadReservation() {
      return current;
    },
    async loadLastSuccessful() {
      return lastSent;
    },
    async insertAttempt(input) {
      attempts.push(input);
      if (input.status === "sent") {
        lastSent = sentFromOutgoing(input.outgoing, {
          id: input.id,
          sentByUserId: input.sentByUserId,
          locale: input.locale as AssignmentCustomerNotificationSent["locale"],
        });
      }
    },
  };
  return {
    attempts,
    store,
    get lastSent() {
      return lastSent;
    },
    setRow(next: AssignmentNotifyReservationRow) {
      current = next;
    },
  };
}

test("ops passenger notify copy exists in all panel locales", () => {
  for (const locale of ["tr", "en", "ru"] as const) {
    const copy = opsCopy[asPanelLocale(locale)];
    assert.ok(copy.passengerNotify);
    assert.ok(copy.passengerNotifySend);
    assert.ok(copy.passengerNotifyResend);
    assert.ok(copy.passengerNotifyVehicle);
    assert.ok(copy.passengerNotifyDriver);
    assert.ok(copy.passengerNotifySubmit);
  }
  assert.equal(opsCopy.tr.passengerNotifySend, "Bilgi gönder");
  assert.match(opsCopy.tr.passengerNotifyResend, /Bilgiler değişti/);
});

test("mail copy covers TR EN RU AR without hardcoded contact numbers", () => {
  for (const locale of ["tr", "en", "ru", "ar"] as const) {
    const copy = assignmentCustomerNotificationCopy[locale];
    assert.ok(copy.firstVehicleSubject);
    assert.ok(copy.firstBothSubject);
    assert.ok(copy.updateVehicleSubject);
    assert.ok(copy.updateDriverSubject);
    assert.ok(copy.updateBothSubject);
    assert.equal(copy.brand, "Tripetica");
  }
  const copySource = source("lib/mail/assignment-customer-notification-copy.ts");
  assert.doesNotMatch(copySource, /\+90\s*5/);
  assert.doesNotMatch(copySource, /wa\.me/);
  assert.doesNotMatch(copySource, /t\.me/);
  assert.doesNotMatch(copySource, /viber:\/\//);
});

test("UI needs vehicle, then allows vehicle_only or both, and blocks no-change", () => {
  const vehicle = vehicleView();
  const driver = driverView();
  const needVehicle = assignmentNotifyUiState({
    vehicle: emptyVehicleAssignment(),
    driver,
    lastSent: null,
    customerEmail: "guest@example.com",
    locked: false,
    canAssign: true,
  });
  assert.equal(needVehicle.kind, "need-vehicle");
  assert.equal(needVehicle.canOpen, false);

  const first = assignmentNotifyUiState({
    vehicle,
    driver: emptyDriverAssignment(),
    lastSent: null,
    customerEmail: "guest@example.com",
    locked: false,
    canAssign: true,
  });
  assert.equal(first.kind, "send");
  assert.equal(first.driverReady, false);

  const bothReady = assignmentNotifyUiState({
    vehicle,
    driver,
    lastSent: null,
    customerEmail: "guest@example.com",
    locked: false,
    canAssign: true,
  });
  assert.equal(bothReady.kind, "send");
  assert.equal(bothReady.driverReady, true);

  const outgoing = buildAssignmentNotifyOutgoing({
    vehicle,
    driver,
    scope: "vehicle_and_driver",
  });
  assert.ok(!("error" in outgoing));
  const sent = assignmentNotifyUiState({
    vehicle,
    driver,
    lastSent: sentFromOutgoing(outgoing),
    customerEmail: "guest@example.com",
    locked: false,
    canAssign: true,
  });
  assert.equal(sent.kind, "sent");
  assert.equal(sent.canOpen, false);

  const vehicleChanged = assignmentNotifyUiState({
    vehicle: vehicleView({ vehicleId: VEHICLE_B, plate: "34 ABC 123", selection: VEHICLE_B }),
    driver,
    lastSent: sentFromOutgoing(outgoing),
    customerEmail: "guest@example.com",
    locked: false,
    canAssign: true,
  });
  assert.equal(vehicleChanged.kind, "resend");

  const driverChanged = assignmentNotifyUiState({
    vehicle,
    driver: driverView({
      driverId: DRIVER_B,
      fullName: "Ali Yılmaz",
      firstName: "Ali",
      lastName: "Yılmaz",
      phone: "+905559990011",
      selection: DRIVER_B,
    }),
    lastSent: sentFromOutgoing(outgoing),
    customerEmail: "guest@example.com",
    locked: false,
    canAssign: true,
  });
  assert.equal(driverChanged.kind, "resend");

  const bothChanged = assignmentNotifyUiState({
    vehicle: vehicleView({ plate: "06 XYZ 1" }),
    driver: driverView({ fullName: "Yeni Şoför", phone: "+905550000001" }),
    lastSent: sentFromOutgoing(outgoing),
    customerEmail: "guest@example.com",
    locked: false,
    canAssign: true,
  });
  assert.equal(bothChanged.kind, "resend");
});

test("previously vehicle_only becomes resend when driver is later assigned", () => {
  const vehicle = vehicleView();
  const vehicleOnly = buildAssignmentNotifyOutgoing({
    vehicle,
    driver: emptyDriverAssignment(),
    scope: "vehicle_only",
  });
  assert.ok(!("error" in vehicleOnly));
  const afterDriver = assignmentNotifyUiState({
    vehicle,
    driver: driverView(),
    lastSent: sentFromOutgoing(vehicleOnly),
    customerEmail: "guest@example.com",
    locked: false,
    canAssign: true,
  });
  assert.equal(afterDriver.kind, "resend");
  const sameVehicleOnly = buildAssignmentNotifyOutgoing({
    vehicle,
    driver: driverView(),
    scope: "vehicle_only",
  });
  assert.ok(!("error" in sameVehicleOnly));
  assert.equal(isAssignmentNotifyNoChange(sentFromOutgoing(vehicleOnly), sameVehicleOnly), true);
});

test("partner-style assignment change flips Ops resend against last sent snapshot", () => {
  const last = buildAssignmentNotifyOutgoing({
    vehicle: vehicleView(),
    driver: driverView(),
    scope: "vehicle_and_driver",
  });
  assert.ok(!("error" in last));
  const partnerUpdated = resolveVehicleAssignment({
    kind: "non_trp",
    vehicleId: null,
    snapshot: { plate: "07 TRP 11", brandModel: "Mercedes Vito" },
    live: null,
  });
  const ui = assignmentNotifyUiState({
    vehicle: partnerUpdated,
    driver: driverView(),
    lastSent: sentFromOutgoing(last),
    customerEmail: "guest@example.com",
    locked: false,
    canAssign: true,
  });
  assert.equal(ui.kind, "resend");
});

test("send uses reservation locale and current assignment, never client payload", async () => {
  const cases = [
    { locale: "ru", subject: assignmentCustomerNotificationCopy.ru.firstBothSubject },
    { locale: "en", subject: assignmentCustomerNotificationCopy.en.firstBothSubject },
    { locale: "tr", subject: assignmentCustomerNotificationCopy.tr.firstBothSubject },
    { locale: "ar", subject: assignmentCustomerNotificationCopy.ar.firstBothSubject },
  ] as const;
  for (const item of cases) {
    const memory = createMemory(reservationRow({ locale: item.locale }));
    const captured = captureMail();
    const sent = await sendAssignmentCustomerNotification({
      actorId: ACTOR,
      reservationId: RESERVATION,
      scope: "vehicle_and_driver",
      store: memory.store,
      mailer: captured.mailer,
    });
    assert.equal(sent.ok, true);
    const mail = captured.mails[0];
    assert.ok(mail);
    assert.equal(mail.to, "guest@example.com");
    assert.equal(mail.subject, item.subject);
    assert.match(mail.text, /Volkswagen Caravelle/);
    assert.match(mail.text, /34 BGN 938/);
    assert.match(mail.text, /Ramazan Rizelioğlu/);
  }
});

test("vehicle_only send succeeds and does not leak driver details", async () => {
  const memory = createMemory(reservationRow());
  const captured = captureMail();
  const sent = await sendAssignmentCustomerNotification({
    actorId: ACTOR,
    reservationId: RESERVATION,
    scope: "vehicle_only",
    store: memory.store,
    mailer: captured.mailer,
  });
  assert.equal(sent.ok, true);
  const mail = captured.mails[0];
  assert.ok(mail);
  assert.equal(
    mail.subject,
    assignmentCustomerNotificationCopy.tr.firstVehicleSubject,
  );
  assert.match(mail.text, /Volkswagen Caravelle/);
  assert.doesNotMatch(mail.text, /Ramazan/);
  assert.doesNotMatch(mail.html, /Ramazan/);
  assert.doesNotMatch(mail.text, /\+905331112233/);
  assert.doesNotMatch(mail.html, /Şoför|Driver|Водитель|السائق/);
  assert.equal(memory.lastSent?.scope, "vehicle_only");
  assert.equal(memory.lastSent?.driverName, null);
});

test("vehicle_and_driver send succeeds including registered driver phone", async () => {
  const memory = createMemory(reservationRow());
  const captured = captureMail();
  const sent = await sendAssignmentCustomerNotification({
    actorId: ACTOR,
    reservationId: RESERVATION,
    scope: "vehicle_and_driver",
    store: memory.store,
    mailer: captured.mailer,
  });
  assert.equal(sent.ok, true);
  const mail = captured.mails[0];
  assert.ok(mail);
  assert.match(mail.text, /Ramazan Rizelioğlu/);
  assert.match(mail.text, /33 111 22 33|533 111 22 33|\+90/);
});

test("NON-TRP driver and vehicle values are used in the customer mail", async () => {
  const memory = createMemory(
    reservationRow({
      assigned_driver_kind: "non_trp",
      assigned_driver_id: null,
      assigned_driver_snapshot: {
        firstName: "Ahmet",
        lastName: "Kaya",
        phone: "+905559998877",
        phoneCountryCode: "TR",
        languageCodes: ["tr"],
      },
      assigned_driver_first_name: null,
      assigned_driver_last_name: null,
      assigned_driver_phone: null,
      assigned_vehicle_kind: "non_trp",
      assigned_vehicle_id: null,
      assigned_vehicle_snapshot: {
        plate: "07 NON 12",
        brandModel: "Mercedes Vito",
      },
      assigned_vehicle_plate: null,
      assigned_vehicle_brand: null,
      assigned_vehicle_model: null,
    }),
  );
  const captured = captureMail();
  const sent = await sendAssignmentCustomerNotification({
    actorId: ACTOR,
    reservationId: RESERVATION,
    scope: "vehicle_and_driver",
    store: memory.store,
    mailer: captured.mailer,
  });
  assert.equal(sent.ok, true);
  const mail = captured.mails[0];
  assert.ok(mail);
  assert.match(mail.text, /Mercedes Vito/);
  assert.match(mail.text, /07 NON 12/);
  assert.match(mail.text, /Ahmet Kaya/);
});

test("successful send then unchanged assignment is rejected and stays sent in UI", async () => {
  const memory = createMemory(reservationRow());
  const first = await sendAssignmentCustomerNotification({
    actorId: ACTOR,
    reservationId: RESERVATION,
    scope: "vehicle_and_driver",
    store: memory.store,
    mailer: async () => ({ ok: true }),
  });
  assert.equal(first.ok, true);
  const second = await sendAssignmentCustomerNotification({
    actorId: ACTOR,
    reservationId: RESERVATION,
    scope: "vehicle_and_driver",
    store: memory.store,
    mailer: async () => {
      throw new Error("should not send");
    },
  });
  assert.deepEqual(second, { ok: false, error: "no-change" });
  const ui = assignmentNotifyUiState({
    vehicle: vehicleView(),
    driver: driverView(),
    lastSent: memory.lastSent,
    customerEmail: "guest@example.com",
    locked: false,
    canAssign: true,
  });
  assert.equal(ui.kind, "sent");
});

test("second successful send uses the update template", async () => {
  const memory = createMemory(reservationRow());
  await sendAssignmentCustomerNotification({
    actorId: ACTOR,
    reservationId: RESERVATION,
    scope: "vehicle_and_driver",
    store: memory.store,
    mailer: async () => ({ ok: true }),
  });
  memory.setRow(
    reservationRow({
      assigned_vehicle_id: VEHICLE_B,
      assigned_vehicle_plate: "34 ABC 123",
      assigned_vehicle_brand: "Ford",
      assigned_vehicle_model: "Transit",
    }),
  );
  const captured = captureMail();
  const second = await sendAssignmentCustomerNotification({
    actorId: ACTOR,
    reservationId: RESERVATION,
    scope: "vehicle_and_driver",
    store: memory.store,
    mailer: captured.mailer,
  });
  assert.equal(second.ok, true);
  const mail = captured.mails[0];
  assert.ok(mail);
  assert.equal(
    mail.subject,
    assignmentCustomerNotificationCopy.tr.updateVehicleSubject,
  );
  assert.match(mail.text, /değişiklik yapılmıştır/);
  assert.match(mail.text, /Ford Transit/);
  assert.doesNotMatch(mail.subject, /hazır/);
});

test("mail failure keeps last successful snapshot and allows retry", async () => {
  const memory = createMemory(reservationRow());
  await sendAssignmentCustomerNotification({
    actorId: ACTOR,
    reservationId: RESERVATION,
    scope: "vehicle_only",
    store: memory.store,
    mailer: async () => ({ ok: true }),
  });
  const firstId = memory.lastSent?.id;
  memory.setRow(
    reservationRow({
      assigned_vehicle_plate: "34 NEW 1",
    }),
  );
  const failed = await sendAssignmentCustomerNotification({
    actorId: ACTOR,
    reservationId: RESERVATION,
    scope: "vehicle_only",
    store: memory.store,
    mailer: async () => ({ ok: false, error: "smtp_down" }),
  });
  assert.deepEqual(failed, { ok: false, error: "send-failed" });
  assert.equal(memory.lastSent?.id, firstId);
  assert.equal(memory.attempts.at(-1)?.status, "failed");
  const retried = await sendAssignmentCustomerNotification({
    actorId: ACTOR,
    reservationId: RESERVATION,
    scope: "vehicle_only",
    store: memory.store,
    mailer: async () => ({ ok: true }),
  });
  assert.equal(retried.ok, true);
  assert.notEqual(memory.lastSent?.id, firstId);
  assert.equal(memory.lastSent?.vehiclePlate, "34 NEW 1");
});

test("contact CTAs reuse the shared reservation contact config", () => {
  const bodies = buildAssignmentCustomerNotificationBodies({
    locale: "en",
    reservationCode: "TRP-DEV-1",
    pickupAt: new Date("2026-09-20T08:00:00.000Z"),
    scope: "vehicle_only",
    isUpdate: false,
    changeKind: null,
    vehicleName: "Volkswagen Caravelle",
    vehiclePlate: "34 BGN 938",
    driverName: null,
    driverPhoneDisplay: null,
  });
  assert.ok(bodies.html.includes(contactLinks.phone));
  assert.match(bodies.html, /wa\.me/);
  assert.match(bodies.html, /t\.me\/Tripetica/);
  assert.match(bodies.html, /\/go\/viber/);
  assert.ok(bodies.text.includes(contactDisplayNumbers.phone));
  assert.equal(contactLinks.phone, `tel:${tripeticaPhoneE164}`);
  const bodySource = source("lib/mail/assignment-customer-notification-body.ts");
  assert.match(bodySource, /buildReservationMailContactSectionHtml/);
  assert.match(bodySource, /buildReservationMailContactSectionText/);
  assert.doesNotMatch(bodySource, /tel:\+90/);
});

test("change kind stays vehicle-only in copy when scope omits driver", () => {
  const last = buildAssignmentNotifyOutgoing({
    vehicle: vehicleView(),
    driver: driverView(),
    scope: "vehicle_and_driver",
  });
  assert.ok(!("error" in last));
  const next = buildAssignmentNotifyOutgoing({
    vehicle: vehicleView({ plate: "34 NEW 9" }),
    driver: driverView(),
    scope: "vehicle_only",
  });
  assert.ok(!("error" in next));
  assert.equal(assignmentNotifyChangeKind(sentFromOutgoing(last), next), "vehicle");
});

test("unauthorized or invalid send is rejected before mail", async () => {
  const memory = createMemory(reservationRow());
  const badActor = await sendAssignmentCustomerNotification({
    actorId: "not-a-user",
    reservationId: RESERVATION,
    scope: "vehicle_only",
    store: memory.store,
    mailer: async () => {
      throw new Error("should not send");
    },
  });
  assert.deepEqual(badActor, { ok: false, error: "not-found" });
  const missing = await sendAssignmentCustomerNotification({
    actorId: ACTOR,
    reservationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    scope: "vehicle_only",
    store: {
      ...memory.store,
      async loadReservation() {
        return null;
      },
    },
    mailer: async () => {
      throw new Error("should not send");
    },
  });
  assert.deepEqual(missing, { ok: false, error: "not-found" });
  const badScope = await sendAssignmentCustomerNotification({
    actorId: ACTOR,
    reservationId: RESERVATION,
    scope: "driver_only",
    store: memory.store,
    mailer: async () => {
      throw new Error("should not send");
    },
  });
  assert.deepEqual(badScope, { ok: false, error: "invalid-scope" });
});

test("send core ignores client names and reads assignment from the reservation row", () => {
  const core = source("lib/ops/assignment-customer-notification-core.ts");
  assert.match(core, /customer_email/);
  assert.match(core, /resolveReservationCustomerLocale\(row\.locale/);
  assert.match(core, /resolveVehicleAssignment/);
  assert.match(core, /resolveDriverAssignment/);
  assert.doesNotMatch(core, /formData\.get\("email"\)/);
  assert.doesNotMatch(core, /formData\.get\("plate"\)/);
  assert.doesNotMatch(core, /input\.recipient/);
  assert.doesNotMatch(core, /input\.vehiclePlate/);
});

test("ops action is the only send entry and requires reservations.manage", () => {
  const actions = source("lib/ops/assignment-customer-notification-actions.ts");
  assert.match(actions, /reservations\.manage/);
  assert.match(actions, /getOpsActor/);
  assert.match(actions, /includeDriver/);
  assert.match(actions, /vehicle_and_driver/);
  assert.match(actions, /vehicle_only/);
  assert.doesNotMatch(actions, /formData\.get\("email"\)/);
  assert.doesNotMatch(actions, /formData\.get\("locale"\).*customer/);
  assert.doesNotMatch(actions, /formData\.get\("plate"\)/);
  assert.doesNotMatch(actions, /formData\.get\("phone"\)/);

  const partnerActions = source("lib/partner/assignment-actions.ts");
  assert.doesNotMatch(partnerActions, /assignment-customer-notification/);
  assert.doesNotMatch(partnerActions, /opsSendAssignmentCustomerNotificationAction/);

  const partnerUi = source("components/partner/job-assignment.tsx");
  assert.doesNotMatch(partnerUi, /passengerNotify/);
  assert.doesNotMatch(partnerUi, /Yolcuya Gönder/);

  const assignmentStore = source("lib/ops/reservation-assignment.ts");
  assert.doesNotMatch(assignmentStore, /sendAssignmentCustomerNotification/);
  assert.doesNotMatch(assignmentStore, /sendReservationSmtpMail/);

  const apiDir = readdirSync(new URL("../../app/api", import.meta.url), {
    recursive: true,
  }) as string[];
  for (const file of apiDir) {
    if (!file.endsWith(".ts")) {
      continue;
    }
    const contents = source(`app/api/${file}`);
    assert.doesNotMatch(contents, /sendAssignmentCustomerNotification/);
    assert.doesNotMatch(contents, /opsSendAssignmentCustomerNotificationAction/);
  }
});

test("050 migration is append-only history for assignment customer mail", () => {
  const sql = source("db/migrations/050_assignment_customer_notification.sql");
  assert.match(sql, /CREATE TABLE IF NOT EXISTS reservation_assignment_customer_notifications/);
  assert.match(sql, /notification_scope/);
  assert.match(sql, /vehicle_and_driver/);
  assert.match(sql, /fingerprint/);
  assert.match(sql, /smtp_message_id/);
  assert.doesNotMatch(sql, /DROP TABLE/);
  assert.doesNotMatch(sql, /db:migrate:prod/);
});

test("last-sent mapping and snapshot fingerprint stay stable", () => {
  const mapped = mapAssignmentCustomerNotificationRow({
    id: "n1",
    sent_at: new Date("2026-09-14T12:00:00.000Z"),
    sent_by_ops_user_id: ACTOR,
    notification_scope: "vehicle_only",
    reservation_locale: "ru",
    vehicle_kind: "non_trp",
    vehicle_id: null,
    vehicle_plate: "07 NON 12",
    vehicle_name: "Mercedes Vito",
    driver_kind: null,
    driver_id: null,
    driver_name: null,
    driver_phone: null,
  });
  assert.ok(mapped);
  assert.equal(mapped.locale, "ru");
  assert.equal(mapped.scope, "vehicle_only");
  const outgoing = buildAssignmentNotifyOutgoing({
    vehicle: resolveVehicleAssignment({
      kind: "non_trp",
      vehicleId: null,
      snapshot: { plate: "07 non 12", brandModel: "Mercedes Vito" },
      live: null,
    }),
    driver: emptyDriverAssignment(),
    scope: "vehicle_only",
  });
  assert.ok(!("error" in outgoing));
  assert.equal(isAssignmentNotifyNoChange(mapped, outgoing), true);
});

function transferSummarySource(
  overrides: Partial<Parameters<typeof buildAssignmentNotifySummaryRows>[0]> = {},
) {
  return {
    reservationCode: "TRP-20260913-0004",
    pickupAt: new Date("2026-09-15T09:00:00.000Z"),
    serviceType: "transfer",
    tourCode: null,
    durationHours: null,
    customerFirstName: "ALI",
    customerLastName: "MOHAMMED",
    pickupNameCustomer: "Wish More Hotel Şişli",
    pickupNameTr: "Wish More Hotel Şişli",
    dropoffNameCustomer: "İstanbul Havalimanı (IST)",
    dropoffNameTr: "İstanbul Havalimanı (IST)",
    vehicleLabelCustomer: null,
    vehicleLabelTr: null,
    vehicleCode: STANDARD_MINIVAN_CODE,
    passengers: [
      {
        sequence_no: 1,
        first_name: "ALI",
        last_name: "MOHAMMED",
        is_primary_passenger: true,
      },
    ],
    ...overrides,
  };
}

test("transfer summary shows first passenger, service, vehicle class, pickup and dropoff", () => {
  const rows = buildAssignmentNotifySummaryRows(transferSummarySource(), "tr");
  const byLabel = Object.fromEntries(rows.map((row) => [row.label, row.value]));
  assert.equal(byLabel["Rezervasyon kodu"], "TRP-20260913-0004");
  assert.equal(byLabel.Yolcu, "ALI MOHAMMED");
  assert.match(byLabel["Tarih & Saat"], /15 Eylül 2026/);
  assert.match(byLabel["Tarih & Saat"], /12:00/);
  assert.equal(byLabel.Hizmet, bookingCopy.tr.services.transfer);
  assert.equal(byLabel["Araç Sınıfı"], "Standart Minivan");
  assert.equal(byLabel["Alış Yeri"], "Wish More Hotel Şişli");
  assert.equal(byLabel["Bırakma Yeri"], "İstanbul Havalimanı (IST)");
  assert.equal(
    rows.map((row) => row.label).join("|").includes(assignmentCustomerNotificationCopy.tr.duration),
    false,
  );
});

test("hourly summary includes duration and omits empty dropoff", () => {
  const rows = buildAssignmentNotifySummaryRows(
    transferSummarySource({
      reservationCode: "TRP-20260915-0012",
      serviceType: "hourly",
      durationHours: 5,
      customerFirstName: "JOHN",
      customerLastName: "SMITH",
      pickupNameCustomer: "İstanbul Havalimanı (IST)",
      dropoffNameCustomer: null,
      dropoffNameTr: null,
      vehicleCode: "business-minivan",
      passengers: [
        {
          sequence_no: 1,
          first_name: "JOHN",
          last_name: "SMITH",
          is_primary_passenger: true,
        },
      ],
    }),
    "tr",
  );
  const byLabel = Object.fromEntries(rows.map((row) => [row.label, row.value]));
  assert.equal(byLabel.Hizmet, bookingCopy.tr.services.hourly);
  assert.equal(byLabel.Süre, "5 saat");
  assert.equal(byLabel["Alış Yeri"], "İstanbul Havalimanı (IST)");
  assert.equal(byLabel["Bırakma Yeri"], undefined);
  assert.doesNotMatch(rows.map((row) => `${row.label}: ${row.value}`).join("\n"), /Bırakma Yeri:\s*—/);
});

test("tour summary reuses canonical tour name and duration", () => {
  const rows = buildAssignmentNotifySummaryRows(
    transferSummarySource({
      serviceType: "tour",
      tourCode: "istanbul-layover",
      durationHours: 6,
      dropoffNameCustomer: null,
      dropoffNameTr: null,
    }),
    "tr",
  );
  const byLabel = Object.fromEntries(rows.map((row) => [row.label, row.value]));
  assert.equal(byLabel.Hizmet, bookingCopy.tr.services.tour);
  assert.equal(byLabel.Tur, localizedTourName("istanbul-layover", "tr"));
  assert.equal(byLabel.Süre, "6 saat");
  assert.equal(byLabel["Başlangıç Yeri"], "Wish More Hotel Şişli");
  assert.equal(byLabel["Bırakma Yeri"], undefined);
  assert.equal(byLabel["Bitiş Yeri"], undefined);
});

test("multiple passengers only show the first passenger", () => {
  const source = transferSummarySource({
    passengers: [
      {
        sequence_no: 1,
        first_name: "ALI",
        last_name: "MOHAMMED",
        is_primary_passenger: true,
      },
      {
        sequence_no: 2,
        first_name: "SARA",
        last_name: "MOHAMMED",
        is_primary_passenger: false,
      },
    ],
  });
  assert.equal(resolveAssignmentNotifyFirstPassengerName(source), "ALI MOHAMMED");
  const rows = buildAssignmentNotifySummaryRows(source, "tr");
  const values = rows.map((row) => row.value).join(" ");
  assert.match(values, /ALI MOHAMMED/);
  assert.doesNotMatch(values, /SARA/);
});

test("missing passenger name omits the passenger row", () => {
  const rows = buildAssignmentNotifySummaryRows(
    transferSummarySource({
      customerFirstName: null,
      customerLastName: null,
      passengers: [
        {
          sequence_no: 1,
          first_name: "  ",
          last_name: null,
          is_primary_passenger: true,
        },
      ],
    }),
    "tr",
  );
  assert.equal(
    rows.some((row) => row.label === assignmentCustomerNotificationCopy.tr.passenger),
    false,
  );
});

test("internal vehicle and service enums stay out of customer summary", () => {
  const rows = buildAssignmentNotifySummaryRows(transferSummarySource(), "en");
  const blob = rows.map((row) => `${row.label}:${row.value}`).join("|");
  assert.doesNotMatch(blob, /standard-minivan/);
  assert.doesNotMatch(blob, /:transfer\b/);
  assert.doesNotMatch(blob, /:hourly\b/);
  assert.equal(
    resolveAssignmentNotifyVehicleClassLabel(
      { vehicleLabelCustomer: "standard-minivan", vehicleLabelTr: null, vehicleCode: "standard-minivan" },
      "en",
    ),
    "Standard Minivan",
  );
});

test("summary labels and service text follow reservation locale including AR RTL", () => {
  const cases = [
    { locale: "tr" as const, service: bookingCopy.tr.services.transfer, title: "Rezervasyon Özeti" },
    { locale: "en" as const, service: bookingCopy.en.services.transfer, title: "Reservation summary" },
    { locale: "ru" as const, service: bookingCopy.ru.services.transfer, title: "Сводка бронирования" },
    { locale: "ar" as const, service: bookingCopy.ar.services.transfer, title: "ملخص الحجز" },
  ];
  for (const item of cases) {
    const rows = buildAssignmentNotifySummaryRows(transferSummarySource(), item.locale);
    assert.ok(rows.some((row) => row.value === item.service));
    const bodies = buildAssignmentCustomerNotificationBodies({
      locale: item.locale,
      reservationCode: "TRP-20260913-0004",
      pickupAt: new Date("2026-09-15T09:00:00.000Z"),
      scope: "vehicle_and_driver",
      isUpdate: false,
      changeKind: null,
      vehicleName: "Mercedes-Benz Vito",
      vehiclePlate: "34 EGP 848",
      driverName: "RECEP YILDIRIM",
      driverPhoneDisplay: "+90 533 205 82 19",
      summary: transferSummarySource(),
    });
    assert.match(bodies.html, new RegExp(item.title));
    assert.match(bodies.text, new RegExp(item.title));
    if (item.locale === "ar") {
      assert.match(bodies.html, /dir="rtl"/);
    }
  }
});

test("vehicle_only mail keeps summary and does not leak driver details", () => {
  const bodies = buildAssignmentCustomerNotificationBodies({
    locale: "tr",
    reservationCode: "TRP-20260913-0004",
    pickupAt: new Date("2026-09-15T09:00:00.000Z"),
    scope: "vehicle_only",
    isUpdate: false,
    changeKind: null,
    vehicleName: "Mercedes-Benz Vito",
    vehiclePlate: "34 EGP 848",
    driverName: "RECEP YILDIRIM",
    driverPhoneDisplay: "+90 533 205 82 19",
    summary: transferSummarySource(),
  });
  assert.match(bodies.text, /Rezervasyon Özeti/);
  assert.match(bodies.text, /ALI MOHAMMED/);
  assert.match(bodies.text, /Araç Bilgileri/);
  assert.doesNotMatch(bodies.text, /RECEP/);
  assert.doesNotMatch(bodies.html, /RECEP/);
  assert.doesNotMatch(bodies.text, /Şoför/);
  assert.doesNotMatch(bodies.html, /Şoför/);
});

test("vehicle_and_driver mail includes summary plus assignment details", () => {
  const bodies = buildAssignmentCustomerNotificationBodies({
    locale: "tr",
    reservationCode: "TRP-20260913-0004",
    pickupAt: new Date("2026-09-15T09:00:00.000Z"),
    scope: "vehicle_and_driver",
    isUpdate: false,
    changeKind: null,
    vehicleName: "Mercedes-Benz Vito",
    vehiclePlate: "34 EGP 848",
    driverName: "RECEP YILDIRIM",
    driverPhoneDisplay: "+90 533 205 82 19",
    summary: transferSummarySource(),
  });
  assert.match(bodies.html, /charset="utf-8"/);
  assert.match(bodies.text, /Rezervasyon Özeti/);
  assert.match(bodies.text, /Wish More Hotel/);
  assert.match(bodies.text, /Araç ve Şoför Bilgileri/);
  assert.match(bodies.text, /RECEP YILDIRIM/);
  assert.match(bodies.text, /Aşağıda özeti bulunan rezervasyonunuz/);
});

test("update mail still includes the reservation summary", () => {
  const bodies = buildAssignmentCustomerNotificationBodies({
    locale: "tr",
    reservationCode: "TRP-20260913-0004",
    pickupAt: new Date("2026-09-15T09:00:00.000Z"),
    scope: "vehicle_and_driver",
    isUpdate: true,
    changeKind: "both",
    vehicleName: "Ford Transit",
    vehiclePlate: "34 ABC 123",
    driverName: "RECEP YILDIRIM",
    driverPhoneDisplay: "+90 533 205 82 19",
    summary: transferSummarySource(),
  });
  assert.match(bodies.text, /Rezervasyon Özeti/);
  assert.match(bodies.text, /TRP-20260913-0004/);
  assert.match(bodies.text, /değişiklik yapılmıştır/);
  assert.doesNotMatch(bodies.subject, /TRP-20260913-0004/);
});

function assertSequential(haystack: string, needles: readonly string[]) {
  let from = 0;
  for (const needle of needles) {
    const index = haystack.indexOf(needle, from);
    assert.ok(index >= 0, `expected ${JSON.stringify(needle)} in order`);
    from = index + needle.length;
  }
}

test("vehicle_and_driver mail renders assignment details before the reservation summary", () => {
  const copy = assignmentCustomerNotificationCopy.tr;
  const bodies = buildAssignmentCustomerNotificationBodies({
    locale: "tr",
    reservationCode: "TRP-20260913-0004",
    pickupAt: new Date("2026-09-15T09:00:00.000Z"),
    scope: "vehicle_and_driver",
    isUpdate: false,
    changeKind: null,
    vehicleName: "Mercedes-Benz Vito",
    vehiclePlate: "34 EGP 848",
    driverName: "RECEP YILDIRIM",
    driverPhoneDisplay: "+90 533 205 82 19",
    summary: transferSummarySource(),
  });
  for (const haystack of [bodies.text, bodies.html]) {
    assertSequential(haystack, [
      copy.greeting,
      copy.firstBothIntro,
      copy.assignmentBothTitle,
      "Mercedes-Benz Vito",
      "34 EGP 848",
      "RECEP YILDIRIM",
      "+90 533 205 82 19",
      copy.summaryTitle,
      "TRP-20260913-0004",
      copy.help,
      reservationMailCopy.tr.contactIntro,
    ]);
  }
});

test("vehicle_only mail order keeps vehicle details first and hides driver fields", () => {
  const copy = assignmentCustomerNotificationCopy.tr;
  const bodies = buildAssignmentCustomerNotificationBodies({
    locale: "tr",
    reservationCode: "TRP-20260913-0004",
    pickupAt: new Date("2026-09-15T09:00:00.000Z"),
    scope: "vehicle_only",
    isUpdate: false,
    changeKind: null,
    vehicleName: "Mercedes-Benz Vito",
    vehiclePlate: "34 EGP 848",
    driverName: "RECEP YILDIRIM",
    driverPhoneDisplay: "+90 533 205 82 19",
    summary: transferSummarySource(),
  });
  for (const haystack of [bodies.text, bodies.html]) {
    assertSequential(haystack, [
      copy.greeting,
      copy.firstVehicleIntro,
      copy.assignmentVehicleTitle,
      "Mercedes-Benz Vito",
      copy.summaryTitle,
      reservationMailCopy.tr.contactIntro,
    ]);
  }
  assert.doesNotMatch(bodies.text, /RECEP/);
  assert.doesNotMatch(bodies.html, /RECEP/);
  assert.doesNotMatch(bodies.text, /Şoför/);
  assert.doesNotMatch(bodies.html, /Şoför/);
});

test("update mail shows current assignment details before the reservation summary", () => {
  const copy = assignmentCustomerNotificationCopy.tr;
  const bodies = buildAssignmentCustomerNotificationBodies({
    locale: "tr",
    reservationCode: "TRP-20260913-0004",
    pickupAt: new Date("2026-09-15T09:00:00.000Z"),
    scope: "vehicle_and_driver",
    isUpdate: true,
    changeKind: "both",
    vehicleName: "Ford Transit",
    vehiclePlate: "34 ABC 123",
    driverName: "RECEP YILDIRIM",
    driverPhoneDisplay: "+90 533 205 82 19",
    summary: transferSummarySource(),
  });
  for (const haystack of [bodies.text, bodies.html]) {
    assertSequential(haystack, [
      copy.greeting,
      copy.updateBothIntro,
      copy.updateBothCurrent,
      copy.assignmentBothTitle,
      "Ford Transit",
      copy.summaryTitle,
      "TRP-20260913-0004",
      copy.updateBothPlease,
      copy.help,
      reservationMailCopy.tr.contactIntro,
    ]);
  }
});

test("TR EN RU AR assignment mails use the same semantic content order", () => {
  for (const locale of ["tr", "en", "ru", "ar"] as const) {
    const copy = assignmentCustomerNotificationCopy[locale];
    const bodies = buildAssignmentCustomerNotificationBodies({
      locale,
      reservationCode: "TRP-20260913-0004",
      pickupAt: new Date("2026-09-15T09:00:00.000Z"),
      scope: "vehicle_and_driver",
      isUpdate: false,
      changeKind: null,
      vehicleName: "Mercedes-Benz Vito",
      vehiclePlate: "34 EGP 848",
      driverName: "RECEP YILDIRIM",
      driverPhoneDisplay: "+90 533 205 82 19",
      summary: transferSummarySource(),
    });
    for (const haystack of [bodies.text, bodies.html]) {
      assertSequential(haystack, [
        copy.greeting,
        copy.firstBothIntro,
        copy.assignmentBothTitle,
        copy.summaryTitle,
        copy.help,
        reservationMailCopy[locale].contactIntro,
      ]);
    }
    if (locale === "ar") {
      assert.match(bodies.html, /dir="rtl"/);
    }
  }
});

test("shared contact section stays after reservation summary", () => {
  const bodies = buildAssignmentCustomerNotificationBodies({
    locale: "en",
    reservationCode: "TRP-20260913-0004",
    pickupAt: new Date("2026-09-15T09:00:00.000Z"),
    scope: "vehicle_and_driver",
    isUpdate: false,
    changeKind: null,
    vehicleName: "Mercedes-Benz Vito",
    vehiclePlate: "34 EGP 848",
    driverName: "RECEP YILDIRIM",
    driverPhoneDisplay: "+90 533 205 82 19",
    summary: transferSummarySource(),
  });
  assertSequential(bodies.html, [
    assignmentCustomerNotificationCopy.en.assignmentBothTitle,
    assignmentCustomerNotificationCopy.en.summaryTitle,
    reservationMailCopy.en.contactIntro,
    contactLinks.phone,
    "wa.me",
    "t.me/Tripetica",
    "/go/viber",
  ]);
});
