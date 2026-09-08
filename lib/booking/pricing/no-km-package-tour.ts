import {
  istanbulAddressPackageTourDurationHours,
  isIstanbulAddressPackageTour,
  quoteIstanbulAddressPackageBase,
} from "@/lib/booking/pricing/istanbul-address-package-tour";
import {
  isBursaTour,
  normalizeBursaRoute,
  quoteBursaBase,
  type BursaRouteOption,
  BURSA_PACKAGE_HOURS,
} from "@/lib/booking/pricing/bursa-pricing";
import { type LocationGeo } from "@/lib/booking/pricing/location-codes";
import { type TransferPricingBreakdown } from "@/lib/booking/pricing/transfer-pricing";
import {
  isSapancaTour,
  quoteSapancaBase,
  SAPANCA_PACKAGE_HOURS,
} from "@/lib/booking/pricing/sapanca-pricing";

/** Istanbul address package tours, Sapanca, and Bursa — no route-distance pricing. */
export function isNoKmPackageTour(
  serviceType: string | null | undefined,
  tourCode: string | null | undefined,
): boolean {
  return (
    isIstanbulAddressPackageTour(serviceType, tourCode) ||
    isSapancaTour(serviceType, tourCode) ||
    isBursaTour(serviceType, tourCode)
  );
}

export function noKmPackageTourDurationHours(
  serviceType: string | null | undefined,
  tourCode: string | null | undefined,
): number | null {
  if (isBursaTour(serviceType, tourCode)) {
    return BURSA_PACKAGE_HOURS;
  }
  if (isSapancaTour(serviceType, tourCode)) {
    return SAPANCA_PACKAGE_HOURS;
  }
  return istanbulAddressPackageTourDurationHours(serviceType, tourCode);
}

export function quoteNoKmPackageTourBase(
  tourCode: string | null | undefined,
  pickup: LocationGeo,
  options?: { bursaRoute?: BursaRouteOption | string | null },
): TransferPricingBreakdown | null {
  if (tourCode === undefined || tourCode === null) {
    return null;
  }
  if (isBursaTour("tour", tourCode)) {
    return quoteBursaBase(pickup, normalizeBursaRoute(options?.bursaRoute));
  }
  if (isSapancaTour("tour", tourCode)) {
    return quoteSapancaBase(pickup);
  }
  return quoteIstanbulAddressPackageBase(tourCode, pickup);
}
