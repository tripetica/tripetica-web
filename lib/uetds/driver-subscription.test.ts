import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  addSubscriptionMonths,
  buildPaidPeriodSnapshot,
  formatUetdsSubscriptionFee,
  isUetdsDriverSubscriptionEntitled,
  isUetdsSubscriptionCurrency,
  istanbulSubscriptionPeriodKey,
  parseUetdsSubscriptionFee,
  periodStatusForKey,
  subscriptionUiWindow,
  UETDS_SUBSCRIPTION_CURRENCIES,
} from "@/lib/uetds/driver-subscription";
import {
  buildUetdsSubscriptionReminderEmail,
  canClaimUetdsSubscriptionReminder,
  dueUetdsSubscriptionReminderKinds,
  shouldSendUetdsSubscriptionReminder,
} from "@/lib/uetds/driver-subscription-reminders";

describe("uetds driver subscription", () => {
  it("A: defaults USD and allows only USD/TRY/EUR", () => {
    assert.deepEqual([...UETDS_SUBSCRIPTION_CURRENCIES], ["USD", "TRY", "EUR"]);
    assert.equal(isUetdsSubscriptionCurrency("USD"), true);
    assert.equal(isUetdsSubscriptionCurrency("TRY"), true);
    assert.equal(isUetdsSubscriptionCurrency("EUR"), true);
    assert.equal(isUetdsSubscriptionCurrency("GBP"), false);
    assert.equal(isUetdsSubscriptionCurrency("RUB"), false);
    assert.equal(parseUetdsSubscriptionFee("9.00"), 9);
    assert.equal(formatUetdsSubscriptionFee(9), "9.00");
  });

  it("B+C: UI window is current + 11 months and advances with month", () => {
    const sep = subscriptionUiWindow(new Date("2026-09-15T12:00:00+03:00"));
    assert.equal(sep.length, 12);
    assert.deepEqual(sep[0], { year: 2026, month: 9 });
    assert.deepEqual(sep[11], { year: 2027, month: 8 });

    const oct = subscriptionUiWindow(new Date("2026-10-01T00:30:00+03:00"));
    assert.deepEqual(oct[0], { year: 2026, month: 10 });
    assert.deepEqual(oct[11], { year: 2027, month: 9 });
  });

  it("D: missing period defaults to unpaid", () => {
    assert.equal(periodStatusForKey([], { year: 2026, month: 9 }), "unpaid");
  });

  it("E+F+G: paid/free allow; unpaid blocks when enrolled", () => {
    const paid = isUetdsDriverSubscriptionEntitled({
      enrolled: true,
      periods: [
        {
          year: 2026,
          month: 9,
          status: "paid",
          amountSnapshot: 9,
          currencySnapshot: "USD",
        },
      ],
      now: new Date("2026-09-15T12:00:00+03:00"),
    });
    const free = isUetdsDriverSubscriptionEntitled({
      enrolled: true,
      periods: [
        {
          year: 2026,
          month: 9,
          status: "free",
          amountSnapshot: null,
          currencySnapshot: null,
        },
      ],
      now: new Date("2026-09-15T12:00:00+03:00"),
    });
    const unpaid = isUetdsDriverSubscriptionEntitled({
      enrolled: true,
      periods: [],
      now: new Date("2026-09-15T12:00:00+03:00"),
    });
    assert.equal(paid, true);
    assert.equal(free, true);
    assert.equal(unpaid, false);
  });

  it("H: entitlement is per-driver (independent period lists)", () => {
    const now = new Date("2026-09-15T12:00:00+03:00");
    const a = isUetdsDriverSubscriptionEntitled({
      enrolled: true,
      periods: [
        {
          year: 2026,
          month: 9,
          status: "paid",
          amountSnapshot: 5,
          currencySnapshot: "USD",
        },
      ],
      now,
    });
    const b = isUetdsDriverSubscriptionEntitled({
      enrolled: true,
      periods: [],
      now,
    });
    assert.equal(a, true);
    assert.equal(b, false);
  });

  it("I: driver active/inactive is unrelated to entitlement helper", () => {
    // Helper only receives enrollment + periods; no status field by design.
    const entitled = isUetdsDriverSubscriptionEntitled({
      enrolled: true,
      periods: [
        {
          year: 2026,
          month: 9,
          status: "free",
          amountSnapshot: null,
          currencySnapshot: null,
        },
      ],
      now: new Date("2026-09-15T12:00:00+03:00"),
    });
    assert.equal(entitled, true);
  });

  it("M: paid snapshot stays when fee changes", () => {
    const previous = {
      year: 2026,
      month: 10,
      status: "paid" as const,
      amountSnapshot: 5,
      currencySnapshot: "USD" as const,
    };
    const snap = buildPaidPeriodSnapshot({
      status: "paid",
      previous,
      monthlyFee: 9,
      currency: "USD",
    });
    assert.deepEqual(snap, { amountSnapshot: 5, currencySnapshot: "USD" });

    const firstPaid = buildPaidPeriodSnapshot({
      status: "paid",
      previous: null,
      monthlyFee: 9,
      currency: "EUR",
    });
    assert.deepEqual(firstPaid, { amountSnapshot: 9, currencySnapshot: "EUR" });

    const free = buildPaidPeriodSnapshot({
      status: "free",
      previous: null,
      monthlyFee: 9,
      currency: "USD",
    });
    assert.deepEqual(free, { amountSnapshot: null, currencySnapshot: null });
  });

  it("N: past months are outside current UI window but keys remain addressable", () => {
    const window = subscriptionUiWindow(new Date("2026-10-05T12:00:00+03:00"));
    assert.equal(
      window.some((key) => key.year === 2026 && key.month === 9),
      false,
    );
    const past = { year: 2026, month: 9 };
    assert.equal(
      periodStatusForKey(
        [
          {
            year: 2026,
            month: 9,
            status: "paid",
            amountSnapshot: 5,
            currencySnapshot: "USD",
          },
        ],
        past,
      ),
      "paid",
    );
  });

  it("P: legacy unenrolled drivers remain entitled", () => {
    assert.equal(
      isUetdsDriverSubscriptionEntitled({
        enrolled: false,
        periods: [],
        now: new Date("2026-09-15T12:00:00+03:00"),
      }),
      true,
    );
  });

  it("addSubscriptionMonths wraps year boundaries", () => {
    assert.deepEqual(addSubscriptionMonths({ year: 2026, month: 12 }, 1), {
      year: 2027,
      month: 1,
    });
    assert.deepEqual(istanbulSubscriptionPeriodKey(new Date("2026-09-26T10:00:00+03:00")), {
      year: 2026,
      month: 9,
    });
  });
});

describe("uetds driver subscription reminders", () => {
  it("Q: duplicate reminder claim is blocked", () => {
    assert.equal(
      canClaimUetdsSubscriptionReminder({
        existing: { reminderKind: "two_days_before", sentAt: null },
        kind: "two_days_before",
      }),
      false,
    );
    assert.equal(
      canClaimUetdsSubscriptionReminder({
        existing: { reminderKind: "two_days_before", sentAt: "2026-09-28T10:00:00Z" },
        kind: "two_days_before",
      }),
      false,
    );
    assert.equal(
      canClaimUetdsSubscriptionReminder({
        existing: null,
        kind: "two_days_before",
      }),
      true,
    );
  });

  it("R: paid/free periods do not get payment reminders", () => {
    assert.equal(
      shouldSendUetdsSubscriptionReminder({
        enrolled: true,
        periods: [
          {
            year: 2026,
            month: 10,
            status: "paid",
            amountSnapshot: 9,
            currencySnapshot: "USD",
          },
        ],
        targetPeriod: { year: 2026, month: 10 },
      }),
      false,
    );
    assert.equal(
      shouldSendUetdsSubscriptionReminder({
        enrolled: true,
        periods: [
          {
            year: 2026,
            month: 10,
            status: "free",
            amountSnapshot: null,
            currencySnapshot: null,
          },
        ],
        targetPeriod: { year: 2026, month: 10 },
      }),
      false,
    );
    assert.equal(
      shouldSendUetdsSubscriptionReminder({
        enrolled: true,
        periods: [],
        targetPeriod: { year: 2026, month: 10 },
      }),
      true,
    );
    assert.equal(
      shouldSendUetdsSubscriptionReminder({
        enrolled: false,
        periods: [],
        targetPeriod: { year: 2026, month: 10 },
      }),
      false,
    );
  });

  it("reminder email includes driver name and payment slots", () => {
    const mail = buildUetdsSubscriptionReminderEmail({
      partnerName: "Demo Partner",
      driverFullName: "Recep YILDIRIM",
      periodLabel: "Eki 2026",
      kind: "two_days_before",
      payment: {
        amountLabel: "9.00",
        currency: "USD",
        iban: "TR00 0000 0000 0000 0000 0000 00",
        beneficiary: "Tripetica",
        note: null,
      },
    });
    assert.match(mail.subject, /Recep YILDIRIM/);
    assert.match(mail.text, /Recep YILDIRIM/);
    assert.match(mail.text, /IBAN/);

    const expired = buildUetdsSubscriptionReminderEmail({
      partnerName: "Demo Partner",
      driverFullName: "Recep YILDIRIM",
      periodLabel: "Eki 2026",
      kind: "expired",
    });
    assert.match(expired.text, /sona ermiştir/);
  });

  it("due kinds map Istanbul calendar days", () => {
    const twoDays = dueUetdsSubscriptionReminderKinds({
      now: new Date("2026-09-29T12:00:00+03:00"),
    });
    assert.deepEqual(twoDays, [
      { kind: "two_days_before", period: { year: 2026, month: 10 } },
    ]);

    const lastDay = dueUetdsSubscriptionReminderKinds({
      now: new Date("2026-09-30T12:00:00+03:00"),
    });
    assert.deepEqual(lastDay, [
      { kind: "last_day", period: { year: 2026, month: 10 } },
    ]);

    const expired = dueUetdsSubscriptionReminderKinds({
      now: new Date("2026-10-01T08:00:00+03:00"),
    });
    assert.deepEqual(expired, [
      { kind: "expired", period: { year: 2026, month: 10 } },
    ]);
  });
});

describe("uetds driver subscription partner mutation surface", () => {
  it("O: partner driver-actions do not import subscription save", async () => {
    const fs = await import("node:fs/promises");
    const source = await fs.readFile(
      new URL("../partner/driver-actions.ts", import.meta.url),
      "utf8",
    );
    assert.equal(source.includes("saveDriverUetdsSubscription"), false);
    assert.equal(source.includes("uetdsSubscription"), false);
  });

  it("J+K: Ops form keeps subscription draft client-side until save action", async () => {
    const fs = await import("node:fs/promises");
    const form = await fs.readFile(
      new URL("../../components/ops/partner-driver-form.tsx", import.meta.url),
      "utf8",
    );
    assert.match(form, /driverSubscriptionDraftEquals/);
    assert.match(form, /setSubscriptionDraft/);
    assert.equal(form.includes("saveDriverUetdsSubscription"), false);
  });

  it("L: Ops fleet action persists subscription on save", async () => {
    const fs = await import("node:fs/promises");
    const actions = await fs.readFile(
      new URL("../ops/partner-fleet-actions.ts", import.meta.url),
      "utf8",
    );
    assert.match(actions, /saveDriverUetdsSubscription/);
    assert.match(actions, /uetdsSubscriptionEnrolled/);
  });

  it("S: submit/manage still gate on subscription entitlement", async () => {
    const fs = await import("node:fs/promises");
    const submit = await fs.readFile(new URL("./submit.ts", import.meta.url), "utf8");
    const manage = await fs.readFile(new URL("./manage.ts", import.meta.url), "utf8");
    assert.match(submit, /isUetdsDriverSubscriptionEntitled/);
    assert.match(manage, /isUetdsDriverSubscriptionEntitled/);
  });

  it("T: month scroller uses horizontal overflow CSS class", async () => {
    const fs = await import("node:fs/promises");
    const css = await fs.readFile(new URL("../../app/globals.css", import.meta.url), "utf8");
    assert.match(css, /\.uetds-driver-subscription-scroller[\s\S]*overflow-x:\s*auto/);
    const section = await fs.readFile(
      new URL("../../components/uetds/driver-uetds-subscription-section.tsx", import.meta.url),
      "utf8",
    );
    assert.match(section, /uetds-driver-subscription-scroller/);
  });
});
