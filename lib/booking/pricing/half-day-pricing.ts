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

export const HALF_DAY_TOUR_CODE = "istanbul-half-day";
export const HALF_DAY_PRICING_VERSION = "istanbul-half-day.v1";
export const HALF_DAY_PACKAGE_HOURS = 6;
export const HALF_DAY_PACKAGE_KM = 70;
export const HALF_DAY_BASE_EUR = 115;
export const HALF_DAY_OVERRUN_HOUR_EUR = "15";
export const HALF_DAY_OVERRUN_KM_EUR = "0.50";
export const HALF_DAY_CONTINENT_CROSSING_EUR = 15;

export function isHalfDayTour(
  serviceType: string | null | undefined,
  tourCode: string | null | undefined,
): boolean {
  return (
    serviceType?.trim() === TOUR_SERVICE_TYPE &&
    tourCode?.trim() === HALF_DAY_TOUR_CODE
  );
}

/** Flat 115 EUR base before vehicle multipliers. Overage tariffs are informational only. */
export function quoteHalfDayBase(pickup: LocationGeo): TransferPricingBreakdown {
  const baseMicro = microEurFromDecimal(String(HALF_DAY_BASE_EUR));
  const base = microEurToNumber(baseMicro);
  const emptyDropoffProvince: TransferProvinceCode = "other";

  return {
    openingFeeEur: base,
    distanceFeeEur: 0,
    locationSurchargeEur: 0,
    timeSurchargeEur: 0,
    baseTransferFeeEur: base,
    pricingVersion: HALF_DAY_PRICING_VERSION,
    pickupProvinceCode: pickup.provinceCode,
    pickupDistrictCode: pickup.districtCode,
    dropoffProvinceCode: emptyDropoffProvince,
    dropoffDistrictCode: null,
  };
}
