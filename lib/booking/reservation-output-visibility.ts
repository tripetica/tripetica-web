export function shouldShowPaymentStatus(
  paymentMethod: string | null | undefined,
): boolean {
  return paymentMethod?.trim().toLowerCase() !== "cash";
}

export function shouldShowDropoff(
  serviceType: string | null | undefined,
): boolean {
  return serviceType?.trim().toLowerCase() === "transfer";
}

export function shouldShowDistance(
  serviceType: string | null | undefined,
): boolean {
  return serviceType?.trim().toLowerCase() === "transfer";
}
