import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { bookingCopy } from "@/lib/booking/copy";
import { BUSINESS_MINIVAN_CODE, PREMIUM_ECONOMY_SEDAN_CODE } from "@/lib/booking/pricing/vehicle-quote";
import { localizedTourName } from "@/lib/booking/tour-display";
import { vehicleCardCopyFor } from "@/lib/booking/vehicles/copy";
import {
  contactDisplayNumbers,
  contactLinks,
} from "@/lib/contact/links";
import { type Locale } from "@/lib/i18n/config";
import { assignmentCustomerNotificationCopy } from "@/lib/mail/assignment-customer-notification-copy";
import { buildCancellationCustomerNotificationBodies } from "@/lib/mail/cancellation-customer-notification-body";
import { cancellationCustomerNotificationCopy } from "@/lib/mail/cancellation-customer-notification-copy";
import { reservationMailCopy } from "@/lib/mail/reservation-copy";
import {
  sendCancellationCustomerNotification,
  sendCancellationCustomerNotificationSafely,
  shouldSendCancellationCustomerNotification,
  type CancellationNotifyMailer,
  type CancellationNotifyReservationRow,
  type CancellationNotifyStore,
} from "@/lib/ops/cancellation-customer-notification-core";

const RESERVATION = "22222222-2222-4222-8222-222222222222";
const REAL_EMAIL = "guest@example.com";
const FORGED_EMAIL = "attacker@evil.example";

function source(path: string) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

function transferRow(
  overrides: Partial<CancellationNotifyReservationRow> = {},
): CancellationNotifyReservationRow {
  return {
    id: RESERVATION,
    reservation_code: "TRP-20260915-0004",
    locale: "tr",
    status: "cancelled",
    customer_email: REAL_EMAIL,
    customer_first_name: "AYŞE",
    customer_last_name: "YILMAZ",
    pickup_at: new Date("2026-09-16T11:30:00.000Z"),
    service_type: "transfer",
    tour_code: null,
    duration_hours: null,
    pickup_name_customer: "Antalya Havalimanı (AYT)",
    pickup_name_tr: "Antalya Havalimanı (AYT)",
    dropoff_name_customer: "Kemer, Antalya",
    dropoff_name_tr: "Kemer, Antalya",
    vehicle_label_customer: null,
    vehicle_label_tr: null,
    vehicle_code: PREMIUM_ECONOMY_SEDAN_CODE,
    passengers: [
      {
        sequence_no: 1,
        first_name: "AYŞE",
        last_name: "YILMAZ",
        is_primary_passenger: true,
      },
    ],
    ...overrides,
  };
}

function hourlyRow(
  overrides: Partial<CancellationNotifyReservationRow> = {},
): CancellationNotifyReservationRow {
  return transferRow({
    reservation_code: "TRP-20260915-0012",
    service_type: "hourly",
    duration_hours: 5,
    pickup_at: new Date("2026-09-18T07:00:00.000Z"),
    pickup_name_customer: "Beşiktaş, İstanbul",
    pickup_name_tr: "Beşiktaş, İstanbul",
    dropoff_name_customer: null,
    dropoff_name_tr: null,
    vehicle_code: BUSINESS_MINIVAN_CODE,
    customer_first_name: "JOHN",
    customer_last_name: "SMITH",
    passengers: [
      {
        sequence_no: 1,
        first_name: "JOHN",
        last_name: "SMITH",
        is_primary_passenger: true,
      },
    ],
    ...overrides,
  });
}

function memoryStore(row: CancellationNotifyReservationRow | null): CancellationNotifyStore {
  return {
    async loadReservation() {
      return row;
    },
  };
}

function capturingMailer(sent: Array<Parameters<CancellationNotifyMailer>[0]>): CancellationNotifyMailer {
  return async (input) => {
    sent.push(input);
    return { ok: true };
  };
}

async function sendOnce(row: CancellationNotifyReservationRow | null) {
  const sent: Array<Parameters<CancellationNotifyMailer>[0]> = [];
  const result = await sendCancellationCustomerNotification({
    reservationId: RESERVATION,
    store: memoryStore(row),
    mailer: capturingMailer(sent),
  });
  return { result, sent };
}

test("successful cancellation trigger prepares exactly one customer notification", async () => {
  assert.equal(
    shouldSendCancellationCustomerNotification({ ok: true, status: "cancelled" }),
    true,
  );
  const { result, sent } = await sendOnce(transferRow());
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.to, REAL_EMAIL);
    assert.equal(result.locale, "tr");
  }
  assert.equal(sent.length, 1);
  assert.match(sent[0].subject, /Rezervasyonunuz İptal Edildi – TRP-20260915-0004/);
  assert.match(sent[0].text, /Aşağıda bilgileri bulunan rezervasyonunuz iptal edilmiştir/);
  assert.match(sent[0].html, /Aşağıda bilgileri bulunan rezervasyonunuz iptal edilmiştir/);
});

test("failed and incomplete cancellations do not send mail", async () => {
  assert.equal(
    shouldSendCancellationCustomerNotification({ ok: false, reason: "failed" }),
    false,
  );
  assert.equal(
    shouldSendCancellationCustomerNotification({ ok: false, reason: "not-found" }),
    false,
  );
  assert.equal(
    shouldSendCancellationCustomerNotification({ ok: false, reason: "deleted" }),
    false,
  );
  assert.equal(
    shouldSendCancellationCustomerNotification({ ok: false, reason: "invalid" }),
    false,
  );
  const confirmed = await sendOnce(transferRow({ status: "confirmed" }));
  assert.equal(confirmed.result.ok, false);
  if (!confirmed.result.ok) {
    assert.equal(confirmed.result.reason, "not-cancelled");
  }
  assert.equal(confirmed.sent.length, 0);
  const missing = await sendOnce(null);
  assert.equal(missing.result.ok, false);
  assert.equal(missing.sent.length, 0);
});

test("retry of an already cancelled reservation does not send a second mail at the trigger", async () => {
  const sent: Array<Parameters<CancellationNotifyMailer>[0]> = [];
  const mailer = capturingMailer(sent);
  const store = memoryStore(transferRow());
  const firstTrigger = { ok: true as const, status: "cancelled" as const };
  const retryTrigger = { ok: false as const, reason: "unchanged" as const };
  assert.equal(shouldSendCancellationCustomerNotification(firstTrigger), true);
  assert.equal(shouldSendCancellationCustomerNotification(retryTrigger), false);
  await sendCancellationCustomerNotification({
    reservationId: RESERVATION,
    store,
    mailer,
  });
  if (shouldSendCancellationCustomerNotification(retryTrigger)) {
    await sendCancellationCustomerNotification({
      reservationId: RESERVATION,
      store,
      mailer,
    });
  }
  assert.equal(sent.length, 1);
});

test("recipient is the reservation customer email, never a client-supplied address", async () => {
  const { result, sent } = await sendOnce(transferRow({ customer_email: ` ${REAL_EMAIL} ` }));
  assert.equal(result.ok, true);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, REAL_EMAIL);
  assert.notEqual(sent[0].to, FORGED_EMAIL);
  const sendSource = source("lib/ops/cancellation-customer-notification-core.ts");
  assert.doesNotMatch(sendSource, /recipientEmail|clientEmail|forged|opsEmail/);
  assert.match(sendSource, /row\.customer_email/);
});

test("customer locale comes from the reservation, not the ops panel", async () => {
  const cases: Array<{ stored: string; expected: Locale }> = [
    { stored: "tr", expected: "tr" },
    { stored: "en", expected: "en" },
    { stored: "ru", expected: "ru" },
    { stored: "ar", expected: "ar" },
  ];
  for (const item of cases) {
    const { result, sent } = await sendOnce(transferRow({ locale: item.stored }));
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.locale, item.expected);
    }
    const copy = cancellationCustomerNotificationCopy[item.expected];
    assert.equal(sent[0].subject, copy.subject("TRP-20260915-0004"));
    assert.match(sent[0].text, new RegExp(copy.intro.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(sent[0].html, new RegExp(`lang="${item.expected}"`));
    if (item.expected === "ar") {
      assert.match(sent[0].html, /dir="rtl"/);
    } else {
      assert.match(sent[0].html, /dir="ltr"/);
    }
  }
  const core = source("lib/ops/cancellation-customer-notification-core.ts");
  assert.match(core, /resolveReservationCustomerLocale\(row\.locale\)/);
  assert.doesNotMatch(core, /resolveReservationCustomerLocale\(row\.locale,\s*/);
});

test("transfer summary shows pickup and meaningful dropoff from live reservation data", async () => {
  const { sent } = await sendOnce(transferRow());
  const text = sent[0].text;
  assert.match(text, /Rezervasyon kodu: TRP-20260915-0004/);
  assert.match(text, new RegExp(`Hizmet: ${bookingCopy.tr.services.transfer}`));
  assert.match(text, /16 Eylül 2026/);
  assert.match(text, /14:30/);
  assert.match(
    text,
    new RegExp(`Araç Sınıfı: ${vehicleCardCopyFor(PREMIUM_ECONOMY_SEDAN_CODE, "tr").title}`),
  );
  assert.match(text, /Alış Yeri: Antalya Havalimanı \(AYT\)/);
  assert.match(text, /Bırakma Yeri: Kemer, Antalya/);
  assert.doesNotMatch(text, /premium-economy-sedan/);
});

test("hourly chauffeur summary includes duration and omits meaningless dropoff", async () => {
  const { sent } = await sendOnce(hourlyRow());
  const text = sent[0].text;
  assert.match(text, new RegExp(`Hizmet: ${bookingCopy.tr.services.hourly}`));
  assert.match(text, /Süre: 5 saat/);
  assert.match(text, /Alış Yeri: Beşiktaş, İstanbul/);
  assert.doesNotMatch(text, /Bırakma Yeri/);
  assert.doesNotMatch(text, /Bırakma Yeri:\s*—/);
  const placeholderDropoff = await sendOnce(
    hourlyRow({ dropoff_name_customer: "—", dropoff_name_tr: "-" }),
  );
  assert.doesNotMatch(placeholderDropoff.sent[0].text, /Bırakma Yeri/);
});

test("tour summary keeps customer-facing localized labels", async () => {
  const { sent } = await sendOnce(
    transferRow({
      service_type: "tour",
      tour_code: "istanbul-layover",
      duration_hours: 6,
      dropoff_name_customer: null,
      dropoff_name_tr: null,
    }),
  );
  const text = sent[0].text;
  assert.match(text, new RegExp(`Hizmet: ${bookingCopy.tr.services.tour}`));
  assert.match(text, new RegExp(`Tur: ${localizedTourName("istanbul-layover", "tr")}`));
  assert.match(text, /Süre: 6 saat/);
  assert.doesNotMatch(text, /istanbul-layover/);
  assert.doesNotMatch(text, /\btour\b/);
});

test("cancellation mail does not make payment or refund claims", async () => {
  const { sent } = await sendOnce(transferRow());
  const combined = `${sent[0].subject}\n${sent[0].text}\n${sent[0].html}`;
  assert.doesNotMatch(combined, /iade|refund|ödeme durumu|payment status|ücret alınmay/i);
  assert.doesNotMatch(combined, /Toplam tutar|Ödeme yöntemi/);
});

test("support copy is about a new reservation, not the cancellation itself", async () => {
  const { sent } = await sendOnce(transferRow());
  const combined = `${sent[0].text}\n${sent[0].html}`;
  assert.match(
    combined,
    /Yeni bir rezervasyon konusunda desteğe ihtiyaç duymanız halinde, aşağıdaki iletişim kanallarımızdan bizimle 7\/24 iletişime geçebilirsiniz/,
  );
  assert.doesNotMatch(combined, /İptal işlemi konusunda/);
  assert.doesNotMatch(combined, /araç veya şoför yönlendirmesi/);
  for (const locale of ["en", "ru", "ar"] as const) {
    const bodies = buildCancellationCustomerNotificationBodies({
      locale,
      summary: {
        reservationCode: "TRP-20260915-0004",
        pickupAt: new Date("2026-09-16T11:30:00.000Z"),
        serviceType: "transfer",
        tourCode: null,
        durationHours: null,
        customerFirstName: "AYŞE",
        customerLastName: "YILMAZ",
        pickupNameCustomer: "Antalya Havalimanı (AYT)",
        pickupNameTr: "Antalya Havalimanı (AYT)",
        dropoffNameCustomer: "Kemer, Antalya",
        dropoffNameTr: "Kemer, Antalya",
        vehicleLabelCustomer: null,
        vehicleLabelTr: null,
        vehicleCode: PREMIUM_ECONOMY_SEDAN_CODE,
        passengers: [],
      },
    });
    assert.equal(bodies.subject, cancellationCustomerNotificationCopy[locale].subject("TRP-20260915-0004"));
    assert.match(bodies.text, new RegExp(cancellationCustomerNotificationCopy[locale].help.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.doesNotMatch(bodies.text, /İptal işlemi konusunda|cancellation process|отмен[еы] операции/i);
  }
});

test("cancellation mail reuses the shared Tripetica contact block and footer", async () => {
  const { sent } = await sendOnce(transferRow());
  const copy = reservationMailCopy.tr;
  assert.match(sent[0].text, new RegExp(copy.contactIntro.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(sent[0].text, new RegExp(copy.contactPhoneLabel));
  assert.match(sent[0].html, new RegExp(contactDisplayNumbers.phone.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(sent[0].html, new RegExp(contactLinks.whatsapp.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.equal(sent[0].text.includes(assignmentCustomerNotificationCopy.tr.signOff), true);
  assert.equal(sent[0].text.includes(assignmentCustomerNotificationCopy.tr.brand), true);
  const bodySource = source("lib/mail/cancellation-customer-notification-body.ts");
  assert.match(bodySource, /buildReservationMailContactSectionHtml/);
  assert.match(bodySource, /buildReservationMailContactSectionText/);
  assert.doesNotMatch(bodySource, /\+90\s*533/);
});

test("mail send failure does not throw back to the cancellation caller", async () => {
  const failed = await sendCancellationCustomerNotification({
    reservationId: RESERVATION,
    store: memoryStore(transferRow()),
    mailer: async () => ({ ok: false, error: "smtp_down" }),
  });
  assert.equal(failed.ok, false);
  if (!failed.ok) {
    assert.equal(failed.reason, "send-failed");
  }
  const thrown = await sendCancellationCustomerNotificationSafely({
    reservationId: RESERVATION,
    store: memoryStore(transferRow()),
    mailer: async () => {
      throw new Error("smtp exploded");
    },
  });
  assert.equal(thrown.ok, false);
  if (!thrown.ok) {
    assert.equal(thrown.reason, "failed");
  }
});

test("ops cancel action schedules mail only after a real cancelled transition", () => {
  const actions = source("lib/ops/actions.ts");
  const status = source("lib/ops/reservation-status.ts");
  const wrapper = source("lib/ops/cancellation-customer-notification.ts");
  const customerCancel = source("lib/account/customer-cancel.ts");
  assert.match(status, /FOR UPDATE/);
  assert.match(status, /reason: "unchanged"/);
  assert.doesNotMatch(status, /cancellation-customer-notify|sendReservationSmtpMail|after\(/);
  assert.match(
    actions,
    /maybeScheduleCancellationCustomerNotification\(result, id\)/,
  );
  assert.match(wrapper, /after\(\(\) => \{/);
  assert.match(wrapper, /shouldSendCancellationCustomerNotification\(result\)/);
  assert.doesNotMatch(customerCancel, /cancellation-customer-notification/);
});

test("greeting uses the customer name and existing footer structure", () => {
  const bodies = buildCancellationCustomerNotificationBodies({
    locale: "tr",
    summary: {
      reservationCode: "TRP-20260915-0004",
      pickupAt: new Date("2026-09-16T11:30:00.000Z"),
      serviceType: "transfer",
      tourCode: null,
      durationHours: null,
      customerFirstName: "AYŞE",
      customerLastName: "YILMAZ",
      pickupNameCustomer: "Antalya Havalimanı (AYT)",
      pickupNameTr: "Antalya Havalimanı (AYT)",
      dropoffNameCustomer: "Kemer, Antalya",
      dropoffNameTr: "Kemer, Antalya",
      vehicleLabelCustomer: null,
      vehicleLabelTr: null,
      vehicleCode: PREMIUM_ECONOMY_SEDAN_CODE,
      passengers: [
        {
          sequence_no: 1,
          first_name: "AYŞE",
          last_name: "YILMAZ",
          is_primary_passenger: true,
        },
      ],
    },
  });
  assert.match(bodies.text, /^Sayın AYŞE YILMAZ,/);
  assert.match(bodies.html, /max-width:600px/);
  assert.match(bodies.html, /viewport/);
});
