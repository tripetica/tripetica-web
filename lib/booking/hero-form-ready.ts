import { isLocationFilled, type LocationValue, type ServiceType, type TourId } from "./types";
import { layoverAirportCodeFromLocation } from "./layover-airports";
import { isIstanbulLocationValue } from "./istanbul-location";
import { BOSPHORUS_DINNER_TOUR_CODE } from "@/lib/booking/pricing/bosphorus-dinner-pricing";

/** Visual-only: basic required fields for the hero booking CTA active appearance. */
export function isHeroFormBasicsReady(params: {
  serviceType: ServiceType;
  pickup: LocationValue;
  dropoff: LocationValue | null;
  durationHours: number | null;
  tourId: TourId | null;
  pickupAtLocal: string;
}) {
  if (!isLocationFilled(params.pickup)) {
    return false;
  }
  if (params.serviceType === "transfer" && !isLocationFilled(params.dropoff)) {
    return false;
  }
  if (params.serviceType === "hourly" && !params.durationHours) {
    return false;
  }
  if (params.serviceType === "tour" && params.tourId === "istanbul-layover") {
    if (!layoverAirportCodeFromLocation(params.pickup)) {
      return false;
    }
  }
  if (params.serviceType === "tour" && params.tourId === BOSPHORUS_DINNER_TOUR_CODE) {
    if (!isIstanbulLocationValue(params.pickup)) {
      return false;
    }
  }
  if (params.serviceType === "tour" && !params.tourId) {
    return false;
  }
  if (!params.pickupAtLocal.trim()) {
    return false;
  }
  return true;
}
