import {
  HALF_DAY_PACKAGE_HOURS,
  HALF_DAY_TOUR_CODE,
  isHalfDayTour,
  quoteHalfDayBase,
} from "@/lib/booking/pricing/half-day-pricing";
import {
  FULL_DAY_PACKAGE_HOURS,
  FULL_DAY_TOUR_CODE,
  isFullDayTour,
  quoteFullDayBase,
} from "@/lib/booking/pricing/full-day-pricing";
import { type LocationGeo } from "@/lib/booking/pricing/location-codes";
import { type TransferPricingBreakdown } from "@/lib/booking/pricing/transfer-pricing";

export { HALF_DAY_TOUR_CODE, FULL_DAY_TOUR_CODE };

/** Half-day and full-day Istanbul tours share address search and no route-distance pricing. */
export function isIstanbulAddressPackageTour(
  serviceType: string | null | undefined,
  tourCode: string | null | undefined,
): boolean {
  return isHalfDayTour(serviceType, tourCode) || isFullDayTour(serviceType, tourCode);
}

export function istanbulAddressPackageTourDurationHours(
  serviceType: string | null | undefined,
  tourCode: string | null | undefined,
): number | null {
  if (isHalfDayTour(serviceType, tourCode)) {
    return HALF_DAY_PACKAGE_HOURS;
  }
  if (isFullDayTour(serviceType, tourCode)) {
    return FULL_DAY_PACKAGE_HOURS;
  }
  return null;
}

export function quoteIstanbulAddressPackageBase(
  tourCode: string | null | undefined,
  pickup: LocationGeo,
): TransferPricingBreakdown | null {
  if (tourCode === HALF_DAY_TOUR_CODE) {
    return quoteHalfDayBase(pickup);
  }
  if (tourCode === FULL_DAY_TOUR_CODE) {
    return quoteFullDayBase(pickup);
  }
  return null;
}
