import {
  buildFxSnapshot,
  displayAmountFromEur,
  parseFxSnapshot,
} from "@/lib/booking/fx/convert";
import { type FxBook, type FxRateQuote, type FxSnapshot } from "@/lib/booking/fx/types";
import { type VehicleQuoteView } from "@/lib/booking/draft-view";
import {
  DISPLAY_CURRENCIES,
  currencyTotalsFromEur,
  type DisplayCurrency,
} from "@/lib/booking/pricing/format-eur";
import {
  BUSINESS_MINIVAN_CODE,
  FIRST_CLASS_MINIVAN_CODE,
  FIRST_CLASS_SEDAN_CODE,
  isBusinessMinivanVisible,
  isBusVisible,
  isFirstClassMinivanVisible,
  isFirstClassSedanVisible,
  isMinibusVisible,
  isMidibusVisible,
  isPremiumEconomySedanVisible,
  isStandardMinivanVisible,
  BUS_CODE,
  MIDIBUS_CODE,
  MINIBUS_CODE,
  occupancyIsUnset,
  PREMIUM_ECONOMY_SEDAN_CODE,
  quotePremiumEconomySedan,
  quoteVehicle,
  STANDARD_MINIVAN_CODE,
  type VehicleOccupancy,
} from "@/lib/booking/pricing/vehicle-quote";
import { type TransferPricingBreakdown } from "@/lib/booking/pricing/transfer-pricing";

const VISIBLE_VEHICLE_ORDER = [
  {
    code: PREMIUM_ECONOMY_SEDAN_CODE,
    visible: isPremiumEconomySedanVisible,
  },
  {
    code: STANDARD_MINIVAN_CODE,
    visible: isStandardMinivanVisible,
  },
  {
    code: BUSINESS_MINIVAN_CODE,
    visible: isBusinessMinivanVisible,
  },
  {
    code: FIRST_CLASS_MINIVAN_CODE,
    visible: isFirstClassMinivanVisible,
  },
  {
    code: FIRST_CLASS_SEDAN_CODE,
    visible: isFirstClassSedanVisible,
  },
  {
    code: MINIBUS_CODE,
    visible: isMinibusVisible,
  },
  {
    code: MIDIBUS_CODE,
    visible: isMidibusVisible,
  },
  {
    code: BUS_CODE,
    visible: isBusVisible,
  },
] as const;

function fxRatesFrom(
  fx: { snapshot?: FxSnapshot | null; book?: FxBook | null },
): Partial<Record<DisplayCurrency, FxRateQuote>> {
  const snapshotRates = fx.snapshot?.rates;
  if (snapshotRates && Object.keys(snapshotRates).length > 0) {
    return snapshotRates;
  }
  return fx.book ?? {};
}

function viewFromBreakdown(
  breakdown: ReturnType<typeof quotePremiumEconomySedan>,
  rates: Partial<Record<DisplayCurrency, FxRateQuote>>,
): VehicleQuoteView {
  const hasRates = DISPLAY_CURRENCIES.some((code) => rates[code]);
  const totals = hasRates
    ? DISPLAY_CURRENCIES.map((code) => ({
        code,
        amount: displayAmountFromEur(breakdown.totalEur, code, rates),
      }))
    : currencyTotalsFromEur(breakdown.totalEur);
  return {
    vehicleCode: breakdown.vehicleCode,
    baseServiceFeeEur: breakdown.baseServiceFeeEur,
    extraPassengerFeeEur: breakdown.extraPassengerFeeEur,
    extraLuggageFeeEur: breakdown.extraLuggageFeeEur,
    babySeatFeeEur: breakdown.babySeatFeeEur,
    meetAndGreetFeeEur: breakdown.meetAndGreetFeeEur,
    totalEur: breakdown.totalEur,
    totals,
    fxRates: rates,
  };
}

export function vehicleQuoteViewFromApplied(
  quote: TransferPricingBreakdown,
  occupancy: VehicleOccupancy,
  fx: { snapshot?: FxSnapshot | null; book?: FxBook | null },
  vehicleCode: string = PREMIUM_ECONOMY_SEDAN_CODE,
): VehicleQuoteView {
  return viewFromBreakdown(quoteVehicle(vehicleCode, quote, occupancy), fxRatesFrom(fx));
}

export function visibleVehicleQuoteViews(
  quote: TransferPricingBreakdown,
  occupancy: VehicleOccupancy,
  fx: { snapshot?: FxSnapshot | null; book?: FxBook | null },
): VehicleQuoteView[] {
  const rates = fxRatesFrom(fx);
  return VISIBLE_VEHICLE_ORDER.filter((vehicle) =>
    occupancyIsUnset(occupancy) || vehicle.visible(occupancy),
  ).map((vehicle) =>
    viewFromBreakdown(quoteVehicle(vehicle.code, quote, occupancy), rates),
  );
}

export const KNOWN_VEHICLE_CODES = VISIBLE_VEHICLE_ORDER.map((vehicle) => vehicle.code);

export function isKnownVehicleCode(code: string) {
  return VISIBLE_VEHICLE_ORDER.some((vehicle) => vehicle.code === code);
}

export function isVehicleCodeVisible(vehicleCode: string, occupancy: VehicleOccupancy) {
  if (occupancyIsUnset(occupancy)) {
    return isKnownVehicleCode(vehicleCode);
  }
  const vehicle = VISIBLE_VEHICLE_ORDER.find((item) => item.code === vehicleCode);
  return vehicle ? vehicle.visible(occupancy) : false;
}

export function fxSnapshotForVehicle(
  quote: TransferPricingBreakdown,
  occupancy: VehicleOccupancy,
  book: FxBook,
  capturedAt = new Date().toISOString(),
) {
  const sedan = quotePremiumEconomySedan(quote, occupancy);
  return buildFxSnapshot(sedan.totalEur, book, capturedAt);
}

export { parseFxSnapshot };
