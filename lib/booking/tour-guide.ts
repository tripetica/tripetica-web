import { isHalfDayTour } from "@/lib/booking/pricing/half-day-pricing";
import { isFullDayTour } from "@/lib/booking/pricing/full-day-pricing";
import { isBursaTour } from "@/lib/booking/pricing/bursa-pricing";
import { isSapancaTour } from "@/lib/booking/pricing/sapanca-pricing";
import { isLayoverTour } from "@/lib/booking/pricing/layover-pricing";

export function showsTourGuideOnSuccess(
  serviceType: string | null | undefined,
  tourCode: string | null | undefined,
): boolean {
  return (
    isLayoverTour(serviceType, tourCode) ||
    isHalfDayTour(serviceType, tourCode) ||
    isFullDayTour(serviceType, tourCode)
  );
}

export function isPackageTourDraft(
  serviceType: string | null | undefined,
  tourCode: string | null | undefined,
): boolean {
  return (
    isLayoverTour(serviceType, tourCode) ||
    isHalfDayTour(serviceType, tourCode) ||
    isFullDayTour(serviceType, tourCode) ||
    isSapancaTour(serviceType, tourCode) ||
    isBursaTour(serviceType, tourCode)
  );
}
