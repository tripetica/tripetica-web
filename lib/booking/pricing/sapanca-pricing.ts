import {
  microEurFromDecimal,
  microEurToNumber,
} from "@/lib/booking/pricing/euro";
import {
  type LocationGeo,
  type TransferProvinceCode,
} from "@/lib/booking/pricing/location-codes";
import { type TransferPricingBreakdown } from "@/lib/booking/pricing/transfer-pricing";
import { TOUR_SERVICE_TYPE } from "@/lib/booking/pricing/layover-pricing";

export const SAPANCA_TOUR_CODE = "sapanca";
export const SAPANCA_PRICING_VERSION = "sapanca.v1";
export const SAPANCA_PACKAGE_HOURS = 11;
export const SAPANCA_OVERRUN_HOUR_EUR = "15";

/**
 * Approved Sapanca tour base fare in EUR.
 * Set when product pricing is finalized — do not guess a value here.
 */
export const SAPANCA_BASE_EUR: number | null = 170;

export function isSapancaTour(
  serviceType: string | null | undefined,
  tourCode: string | null | undefined,
): boolean {
  return (
    serviceType?.trim() === TOUR_SERVICE_TYPE &&
    tourCode?.trim() === SAPANCA_TOUR_CODE
  );
}

/** Flat base before vehicle multipliers. Returns null when base fare is not configured. */
export function quoteSapancaBase(
  pickup: LocationGeo,
): TransferPricingBreakdown | null {
  if (SAPANCA_BASE_EUR === null) {
    return null;
  }
  const baseMicro = microEurFromDecimal(String(SAPANCA_BASE_EUR));
  const base = microEurToNumber(baseMicro);
  const emptyDropoffProvince: TransferProvinceCode = "other";

  return {
    openingFeeEur: base,
    distanceFeeEur: 0,
    locationSurchargeEur: 0,
    timeSurchargeEur: 0,
    baseTransferFeeEur: base,
    pricingVersion: SAPANCA_PRICING_VERSION,
    pickupProvinceCode: pickup.provinceCode,
    pickupDistrictCode: pickup.districtCode,
    dropoffProvinceCode: emptyDropoffProvince,
    dropoffDistrictCode: null,
  };
}
