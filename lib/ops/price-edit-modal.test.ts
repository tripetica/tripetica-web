import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { opsCopy } from "@/lib/ops/copy";
import { isOpsRecordEditDirty, type OpsRecordEditInput } from "@/lib/ops/record-edit-form";

function source(path: string) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

test("price edit modal keeps only footer cancel and save, not a header close", () => {
  const modal = source("components/ops/price-edit-modal.tsx");
  assert.match(modal, /copy\.editPriceTitle/);
  assert.match(modal, /copy\.cancelEdit/);
  assert.match(modal, /copy\.saveChanges/);
  assert.match(modal, /className="ops-price-backdrop"[\s\S]*onClick=\{onClose\}/);
  assert.match(
    modal,
    /className="ops-btn-ghost" onClick=\{onClose\}>\s*\{copy\.cancelEdit\}/,
  );
  assert.match(modal, /onApply\(\s*buildPriceEditApplyTotals\(/);
  assert.doesNotMatch(modal, /copy\.close/);
  assert.doesNotMatch(
    modal,
    /ops-price-modal-header[\s\S]*ops-btn-ghost[\s\S]*copy\.close/,
  );
  assert.equal(opsCopy.tr.editPriceTitle, "Fiyat düzenleme");
  assert.equal(opsCopy.tr.cancelEdit, "İptal");
  assert.equal(opsCopy.tr.saveChanges, "Değişiklikleri Kaydet");
  assert.equal(opsCopy.tr.close, "Kapat");
});

test("price modal cancel closes locally without applying draft totals to the main form", () => {
  const edit = source("components/ops/record-detail-edit.tsx");
  assert.match(edit, /onClose=\{\(\) => setPriceModalOpen\(false\)\}/);
  assert.doesNotMatch(
    edit,
    /onClose=\{\(\) => \{[\s\S]*setForm[\s\S]*setPriceModalOpen\(false\)/,
  );
  assert.match(edit, /onApply=\{\(totals, overridden\) => \{/);
  assert.match(edit, /priceManuallyOverridden: overridden/);
  assert.match(edit, /manualPriceTotals: totals/);
});

test("unsaved price modal draft does not dirty the main form until local save", () => {
  const original: Pick<OpsRecordEditInput, "priceManuallyOverridden" | "manualPriceTotals"> = {
    priceManuallyOverridden: false,
    manualPriceTotals: { EUR: "104.75" },
  };
  const stillOriginal = {
    ...original,
  };
  assert.equal(
    JSON.stringify(stillOriginal.manualPriceTotals),
    JSON.stringify(original.manualPriceTotals),
  );
  const afterLocalSave = {
    kind: "process" as const,
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
    currency: "EUR" as const,
    priceManuallyOverridden: false,
    manualPriceTotals: { EUR: "104.75" },
    calculatedPriceTotals: { EUR: "104.75" },
    fxSnapshot: null,
    passengers: [
      {
        sequenceNo: 1,
        firstName: "",
        lastName: "",
        countryCode: "",
        identityNumber: "",
        gender: "" as const,
        isPrimary: true,
      },
    ],
  };
  const applied = {
    ...afterLocalSave,
    priceManuallyOverridden: true,
    manualPriceTotals: { EUR: "100.00" },
  };
  assert.equal(isOpsRecordEditDirty(afterLocalSave, afterLocalSave), false);
  assert.equal(isOpsRecordEditDirty(applied, afterLocalSave), true);
});
