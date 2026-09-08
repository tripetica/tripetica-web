import { isBosphorusDinnerTour } from "@/lib/booking/pricing/bosphorus-dinner-pricing";

export type ReservationWaitingPolicyKind = "transfer" | "hourly" | "tour";

export function reservationWaitingPolicyKind(
  serviceType: string | null | undefined,
  tourCode: string | null | undefined,
): ReservationWaitingPolicyKind | null {
  if (isBosphorusDinnerTour(serviceType, tourCode)) {
    return null;
  }
  const normalizedServiceType = serviceType?.trim().toLowerCase();
  if (normalizedServiceType === "hourly") {
    return "hourly";
  }
  if (normalizedServiceType === "tour") {
    return "tour";
  }
  return "transfer";
}
