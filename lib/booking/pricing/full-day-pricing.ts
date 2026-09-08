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

export const FULL_DAY_TOUR_CODE = "istanbul-full-day";
export const FULL_DAY_PRICING_VERSION = "istanbul-full-day.v1";
export const FULL_DAY_PACKAGE_HOURS = 10;
export const FULL_DAY_PACKAGE_KM = 110;
export const FULL_DAY_BASE_EUR = 175;
export const FULL_DAY_OVERRUN_HOUR_EUR = "15";
export const FULL_DAY_OVERRUN_KM_EUR = "0.50";
export const FULL_DAY_CONTINENT_CROSSING_EUR = 15;

export function isFullDayTour(
  serviceType: string | null | undefined,
  tourCode: string | null | undefined,
): boolean {
  return (
    serviceType?.trim() === TOUR_SERVICE_TYPE &&
    tourCode?.trim() === FULL_DAY_TOUR_CODE
  );
}

/** Flat 175 EUR base before vehicle multipliers. Overage tariffs are informational only. */
export function quoteFullDayBase(pickup: LocationGeo): TransferPricingBreakdown {
  const baseMicro = microEurFromDecimal(String(FULL_DAY_BASE_EUR));
  const base = microEurToNumber(baseMicro);
  const emptyDropoffProvince: TransferProvinceCode = "other";

  return {
    openingFeeEur: base,
    distanceFeeEur: 0,
    locationSurchargeEur: 0,
    timeSurchargeEur: 0,
    baseTransferFeeEur: base,
    pricingVersion: FULL_DAY_PRICING_VERSION,
    pickupProvinceCode: pickup.provinceCode,
    pickupDistrictCode: pickup.districtCode,
    dropoffProvinceCode: emptyDropoffProvince,
    dropoffDistrictCode: null,
  };
}
