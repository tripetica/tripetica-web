import test from "node:test";
import assert from "node:assert/strict";
import {
  canonicalizeOpsRecordEdit,
  isOpsRecordEditDirty,
  opsDetailToolbarMode,
  opsProcessToolbarActions,
  validateOpsRecordEditInput,
  type OpsRecordEditInput,
} from "@/lib/ops/record-edit-form";

const fxSnapshot = {
  baseCurrency: "EUR" as const,
  totalEur: "104.75",
  capturedAt: "2026-09-14T09:00:00.000Z",
  rates: {
    USD: {
      quoteCurrency: "USD" as const,
      rate: "1.1",
      source: "test",
      fetchedAt: "2026-09-14T09:00:00.000Z",
    },
    EUR: {
      quoteCurrency: "EUR" as const,
      rate: "1",
      source: "test",
      fetchedAt: "2026-09-14T09:00:00.000Z",
    },
    TRY: {
      quoteCurrency: "TRY" as const,
      rate: "40",
      source: "test",
      fetchedAt: "2026-09-14T09:00:00.000Z",
    },
    RUB: {
      quoteCurrency: "RUB" as const,
      rate: "100",
      source: "test",
      fetchedAt: "2026-09-14T09:00:00.000Z",
    },
    GBP: {
      quoteCurrency: "GBP" as const,
      rate: "0.85",
      source: "test",
      fetchedAt: "2026-09-14T09:00:00.000Z",
    },
  },
  totals: {
    USD: "115.23",
    EUR: "104.75",
    TRY: "4190.00",
    RUB: "10475.00",
    GBP: "89.04",
  },
};

function blankPassenger(sequenceNo = 1) {
  return {
    sequenceNo,
    firstName: "",
    lastName: "",
    countryCode: "",
    identityNumber: "",
    gender: "" as const,
    isPrimary: sequenceNo === 1,
  };
}

function processForm(
  overrides: Partial<OpsRecordEditInput> = {},
): OpsRecordEditInput {
  return {
    kind: "process",
    id: "11111111-1111-1111-1111-111111111111",
    pickupDate: "2026-09-20",
    pickupTime: "10:00",
    pickupName: "IST",
    pickupAddress: "Istanbul Airport",
    dropoffName: "Taksim",
    dropoffAddress: "Taksim",
    flightCode: "",
    passengerCount: 0,
    luggageCount: 0,
    babySeatCount: 0,
    meetAndGreet: false,
    customerFirstName: "",
    customerLastName: "",
    customerEmail: "",
    customerPhone: "",
    notes: "",
    vehicleCode: "",
    paymentMethod: "",
    currency: "EUR",
    priceManuallyOverridden: false,
    manualPriceTotals: {
      EUR: "104.75",
      USD: "115.23",
      TRY: "4190.00",
      RUB: "10475.00",
      GBP: "89.04",
    },
    calculatedPriceTotals: {
      EUR: "104.75",
      USD: "115.23",
      TRY: "4190.00",
      RUB: "10475.00",
      GBP: "89.04",
    },
    fxSnapshot,
    passengers: [blankPassenger()],
    ...overrides,
  };
}

test("ops process save accepts a 104.75 EUR to 100 EUR override without customer fields", () => {
  const original = processForm();
  const edited = processForm({
    priceManuallyOverridden: true,
    manualPriceTotals: {
      EUR: "100",
      USD: "110.00",
      TRY: "4000.00",
      RUB: "10000.00",
      GBP: "85.00",
    },
  });
  assert.equal(isOpsRecordEditDirty(edited, original), true);
  const validated = validateOpsRecordEditInput(edited);
  assert.equal(validated.ok, true);
  if (!validated.ok) {
    return;
  }
  assert.equal(validated.value.manualPriceTotals.EUR, "100.00");
  assert.equal(validated.value.priceManuallyOverridden, true);
  assert.equal(validated.value.currency, "EUR");
});

test("ops process save accepts locale-formatted override amounts", () => {
  const validated = validateOpsRecordEditInput(
    processForm({
      priceManuallyOverridden: true,
      manualPriceTotals: {
        EUR: "100,00",
        USD: "110,00",
        TRY: "4.000,00",
        RUB: "10.000,00",
        GBP: "85,00",
      },
    }),
  );
  assert.equal(validated.ok, true);
  if (!validated.ok) {
    return;
  }
  assert.equal(validated.value.manualPriceTotals.EUR, "100.00");
});

test("ops process save does not require filled passenger names or occupancy", () => {
  const validated = validateOpsRecordEditInput(processForm());
  assert.equal(validated.ok, true);
});

test("ops process save still rejects a known-invalid vehicle code", () => {
  const validated = validateOpsRecordEditInput(
    processForm({ vehicleCode: "not-a-vehicle" }),
  );
  assert.equal(validated.ok, false);
  if (validated.ok) {
    return;
  }
  assert.equal(validated.reason, "vehicle");
});

test("reservation edit still requires customer name and contact", () => {
  const validated = validateOpsRecordEditInput({
    ...processForm(),
    kind: "reservation",
    passengerCount: 1,
  });
  assert.equal(validated.ok, false);
  if (validated.ok) {
    return;
  }
  assert.equal(validated.reason, "customer");
});

test("dirty state compares canonical values, not focus events", () => {
  const original = processForm();
  assert.equal(isOpsRecordEditDirty(original, original), false);
  assert.equal(
    isOpsRecordEditDirty(processForm({ flightCode: "TK1" }), original),
    true,
  );
  assert.equal(
    isOpsRecordEditDirty(processForm({ flightCode: "TK1", notes: "" }), original),
    true,
  );
  assert.equal(
    isOpsRecordEditDirty(
      processForm({
        flightCode: "  ",
        customerEmail: "",
        notes: "  ",
      }),
      original,
    ),
    false,
  );
});

test("price modal apply to 100 EUR marks the main process form dirty", () => {
  const original = processForm();
  const afterPriceModal = processForm({
    priceManuallyOverridden: true,
    manualPriceTotals: {
      EUR: "100.00",
      USD: "110.00",
      TRY: "4000.00",
      RUB: "10000.00",
      GBP: "85.00",
    },
  });
  assert.equal(isOpsRecordEditDirty(afterPriceModal, original), true);
  assert.equal(
    isOpsRecordEditDirty(
      processForm({
        priceManuallyOverridden: false,
        manualPriceTotals: original.calculatedPriceTotals,
      }),
      original,
    ),
    false,
  );
});

test("reverting every field hides save by returning to a clean canonical form", () => {
  const original = processForm();
  const changed = processForm({
    notes: "whatsapp teklif",
    priceManuallyOverridden: true,
    manualPriceTotals: { EUR: "100.00" },
  });
  assert.equal(isOpsRecordEditDirty(changed, original), true);
  const reverted = processForm({
    notes: original.notes,
    priceManuallyOverridden: original.priceManuallyOverridden,
    manualPriceTotals: original.manualPriceTotals,
  });
  assert.equal(isOpsRecordEditDirty(reverted, original), false);
  assert.equal(
    canonicalizeOpsRecordEdit(reverted),
    canonicalizeOpsRecordEdit(original),
  );
});

test("process sticky actions follow detail, clean edit, and dirty edit modes", () => {
  const detail = opsProcessToolbarActions(
    opsDetailToolbarMode({ editing: false, dirty: false }),
  );
  assert.deepEqual(detail, {
    downloadPdf: true,
    edit: true,
    saveChanges: false,
  });

  const editClean = opsProcessToolbarActions(
    opsDetailToolbarMode({ editing: true, dirty: false }),
  );
  assert.deepEqual(editClean, {
    downloadPdf: false,
    edit: false,
    saveChanges: false,
  });

  const editDirty = opsProcessToolbarActions(
    opsDetailToolbarMode({ editing: true, dirty: true }),
  );
  assert.deepEqual(editDirty, {
    downloadPdf: false,
    edit: false,
    saveChanges: true,
  });
});
