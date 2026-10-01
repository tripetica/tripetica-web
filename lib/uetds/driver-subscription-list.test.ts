import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  buildPaidPeriodSnapshot,
  isUetdsDriverSubscriptionEntitled,
  mapUetdsSubscriptionListSummary,
} from "@/lib/uetds/driver-subscription";
import { opsCopy } from "@/lib/ops/copy";
import { partnerCopy } from "@/lib/partner/copy";

function source(path: string) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

describe("uetds driver subscription list UX", () => {
  it("11: unenrolled list summary stays empty (view does not enroll)", () => {
    assert.deepEqual(
      mapUetdsSubscriptionListSummary({
        enrolledAt: null,
        monthlyFee: "9.00",
        currency: "USD",
        currentPeriodStatus: "paid",
      }),
      {
        enrolled: false,
        monthlyFee: null,
        currency: null,
        currentPeriodStatus: null,
        nextPeriodStatus: null,
      },
    );
  });

  it("next month status comes from the supplied period, not a guess", () => {
    const summary = mapUetdsSubscriptionListSummary({
      enrolledAt: "2026-09-01T00:00:00Z",
      monthlyFee: "9",
      currency: "USD",
      currentPeriodStatus: "paid",
      nextPeriodStatus: "unpaid",
    });
    assert.equal(summary.currentPeriodStatus, "paid");
    assert.equal(summary.nextPeriodStatus, "unpaid");
  });

  it("enrolled missing period defaults to unpaid on list", () => {
    assert.deepEqual(
      mapUetdsSubscriptionListSummary({
        enrolledAt: "2026-09-01T00:00:00Z",
        monthlyFee: "5",
        currency: "USD",
        currentPeriodStatus: null,
      }),
      {
        enrolled: true,
        monthlyFee: 5,
        currency: "USD",
        currentPeriodStatus: "unpaid",
        nextPeriodStatus: "unpaid",
      },
    );
  });

  it("5: paid snapshot keeps prior amount when fee later changes", () => {
    const snap = buildPaidPeriodSnapshot({
      status: "paid",
      previous: {
        year: 2026,
        month: 9,
        status: "paid",
        amountSnapshot: 9,
        currencySnapshot: "USD",
      },
      monthlyFee: 5,
      currency: "USD",
    });
    assert.deepEqual(snap, { amountSnapshot: 9, currencySnapshot: "USD" });
  });

  it("6: free clears paid snapshot; unpaid entitlement still blocks enrolled", () => {
    assert.deepEqual(
      buildPaidPeriodSnapshot({
        status: "free",
        previous: {
          year: 2026,
          month: 9,
          status: "paid",
          amountSnapshot: 9,
          currencySnapshot: "USD",
        },
        monthlyFee: 9,
        currency: "USD",
      }),
      { amountSnapshot: null, currencySnapshot: null },
    );
    assert.equal(
      isUetdsDriverSubscriptionEntitled({
        enrolled: true,
        periods: [],
        now: new Date("2026-09-15T12:00:00+03:00"),
      }),
      false,
    );
  });

  it("1+4+L: Ops list wires inline patch actions and shared store", () => {
    const actions = source("lib/ops/driver-actions.ts");
    const store = source("lib/uetds/driver-subscription-store.ts");
    const table = source("components/ops/driver-table.tsx");
    const cells = source("components/uetds/driver-subscription-list-cells.tsx");
    assert.match(actions, /patchOpsDriverSubscriptionFeeAction/);
    assert.match(actions, /patchOpsDriverSubscriptionCurrencyAction/);
    assert.match(actions, /patchOpsDriverSubscriptionStatusAction/);
    assert.match(actions, /partners\.manage/);
    assert.match(store, /patchDriverUetdsSubscriptionFromList/);
    assert.match(store, /not-enrolled/);
    assert.match(table, /OpsDriverSubscriptionInlineCells/);
    assert.match(cells, /onBlur=\{\(\) => saveFee\(\)\}/);
    assert.match(cells, /Enter/);
  });

  it("7: row onSummaryChange only updates matching driver id", () => {
    const table = source("components/ops/driver-table.tsx");
    assert.match(table, /item\.id === driverId \? \{ \.\.\.item, uetdsSubscription: summary \}/);
  });

  it("8+9: Partner list is read-only with no patch actions", () => {
    const list = source("components/partner/driver-list.tsx");
    const partnerActions = source("lib/partner/driver-actions.ts");
    assert.match(list, /PartnerDriverSubscriptionReadOnlyCells/);
    assert.match(list, /FleetInlineSelect/);
    assert.doesNotMatch(list, /patchOpsDriverSubscription|inputMode|patchDriverUetdsSubscription/);
    assert.doesNotMatch(partnerActions, /patchDriverUetdsSubscriptionFromList|uetdsSubscription/);
  });

  it("10: partner mutation surface still has no subscription save", () => {
    const partnerActions = source("lib/partner/driver-actions.ts");
    assert.equal(partnerActions.includes("saveDriverUetdsSubscription"), false);
    assert.equal(partnerActions.includes("patchDriverUetdsSubscriptionFromList"), false);
  });

  it("12+13: detail forms keep dirty-save / read-only architecture", () => {
    const opsForm = source("components/ops/partner-driver-form.tsx");
    const partnerDetail = source("components/partner/driver-detail.tsx");
    assert.match(opsForm, /driverSubscriptionDraftEquals/);
    assert.match(opsForm, /updateOpsPartnerDriverAction/);
    assert.match(partnerDetail, /readOnly/);
    assert.match(partnerDetail, /DriverUetdsSubscriptionSection/);
  });

  it("14: entitlement helpers remain in submit/manage", () => {
    assert.match(source("lib/uetds/submit.ts"), /isUetdsDriverSubscriptionEntitled/);
    assert.match(source("lib/uetds/manage.ts"), /isUetdsDriverSubscriptionEntitled/);
  });

  it("15: horizontal scroll wrappers remain on list tables", () => {
    const css = source("app/globals.css");
    assert.match(css, /\.ops-table-wrap[\s\S]*overflow-x:\s*auto/);
    assert.match(css, /\.ops-drivers-table-wrap/);
    assert.match(source("components/ops/driver-table.tsx"), /ops-drivers-table-wrap/);
    assert.match(source("components/partner/driver-list.tsx"), /ops-table-wrap partner-drivers-table/);
  });

  it("16: TR/EN/RU list copy includes fee/currency/status", () => {
    for (const locale of ["tr", "en", "ru"] as const) {
      assert.ok(opsCopy[locale].uetdsSubscriptionFee);
      assert.ok(opsCopy[locale].uetdsSubscriptionCurrency);
      assert.ok(opsCopy[locale].uetdsSubscriptionStatusColumn);
      assert.ok(partnerCopy[locale].uetdsSubscriptionFee);
      assert.ok(partnerCopy[locale].uetdsSubscriptionCurrency);
      assert.ok(partnerCopy[locale].uetdsSubscriptionStatusColumn);
    }
    assert.equal(opsCopy.tr.uetdsSubscriptionStatusColumn, "Ödeme durumu");
    assert.equal(partnerCopy.en.uetdsSubscriptionCurrency, "Currency");
  });

  it("ops list query joins current Istanbul period without writing enrollment", () => {
    const drivers = source("lib/ops/drivers.ts");
    const plan = source("lib/ops/driver-list-query.ts");
    assert.match(plan, /partner_driver_uetds_subscription_periods/);
    assert.match(drivers, /istanbulSubscriptionPeriodKey/);
    assert.match(drivers, /buildOpsDriverListQueryPlan/);
    assert.doesNotMatch(drivers, /UPDATE partner_drivers|INSERT INTO partner_driver_uetds/);
    assert.doesNotMatch(plan, /UPDATE partner_drivers|INSERT INTO partner_driver_uetds/);
  });
});
