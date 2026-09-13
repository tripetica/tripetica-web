import { type Locale } from "@/lib/i18n/config";
import {
  formatOpsOtherPrice,
  formatOpsSelectedPrice,
  otherStoredAmounts,
  selectedStoredAmount,
} from "@/lib/ops/money";
import { parseManualPriceTotals } from "@/lib/ops/price-override";

export function reservationPriceDisplay(
  locale: Locale,
  item: {
    currency?: string | null;
    fxSnapshot?: unknown;
    totalPrice?: string | number | null;
    priceManuallyOverridden?: boolean;
    manualPriceTotals?: unknown;
  },
) {
  return priceFields(
    locale,
    item.currency,
    null,
    item.fxSnapshot,
    null,
    item.totalPrice,
    item.priceManuallyOverridden,
    item.manualPriceTotals,
  );
}

export function priceFields(
  locale: Locale,
  currency: string | null | undefined,
  appliedVehicleTotal: string | number | null | undefined,
  fxSnapshot: unknown,
  appliedVehicleTotalEur?: string | number | null,
  totalPrice?: string | number | null,
  priceManuallyOverridden?: boolean,
  manualPriceTotals?: unknown,
) {
  const manualTotals = parseManualPriceTotals(manualPriceTotals);
  const selected = selectedStoredAmount({
    currency,
    appliedVehicleTotal,
    totalPrice,
    fxSnapshot,
    priceManuallyOverridden,
    manualPriceTotals: manualTotals,
  });
  return {
    selectedPrice: formatOpsSelectedPrice(selected.amount, selected.currency, locale) || null,
    otherCurrencies: otherStoredAmounts({
      currency: selected.currency,
      appliedVehicleTotalEur,
      fxSnapshot,
      priceManuallyOverridden,
      manualPriceTotals: manualTotals,
    }).map((item) => formatOpsOtherPrice(item.amount, item.code, locale)),
  };
}
