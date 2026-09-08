import { isBosphorusDinnerTour } from "@/lib/booking/pricing/bosphorus-dinner-pricing";
import { isNoKmPackageTour } from "@/lib/booking/pricing/no-km-package-tour";
import { HOURLY_SERVICE_TYPE } from "@/lib/booking/pricing/hourly-pricing";

/** Mirrors the SQL readiness guard in applySelectedTripToApplied. */
export function selectedTripRowReadyForApply(params: {
  serviceType: string;
  tourCode: string | null;
  selectedDurationHours: number | null;
  selectedDistanceKm: number | null;
}) {
  if (params.serviceType === HOURLY_SERVICE_TYPE) {
    return params.selectedDurationHours !== null;
  }
  if (
    isNoKmPackageTour(params.serviceType, params.tourCode) ||
    isBosphorusDinnerTour(params.serviceType, params.tourCode)
  ) {
    return true;
  }
  return params.selectedDistanceKm !== null;
}
