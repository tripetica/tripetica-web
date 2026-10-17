export type DriverServiceSelection = {
  standardEnabled: boolean;
  standardFee: number | null;
  advancedEnabled: boolean;
  advancedFee: number | null;
  gpsAtsEnabled: boolean;
  gpsAtsFee: number | null;
  mobileEnabled: boolean;
  mobileFee: number | null;
};

export const SERVICE_PRICE_PLACEHOLDER = 5;

export const emptyDriverServices = (): DriverServiceSelection => ({
  standardEnabled: false,
  standardFee: null,
  advancedEnabled: false,
  advancedFee: null,
  gpsAtsEnabled: false,
  gpsAtsFee: null,
  mobileEnabled: false,
  mobileFee: null,
});

export function selectedServiceTotal(services: DriverServiceSelection) {
  const selected = [
    services.standardEnabled ? services.standardFee : null,
    services.advancedEnabled ? services.advancedFee : null,
    services.gpsAtsEnabled ? services.gpsAtsFee : null,
    services.mobileEnabled ? services.mobileFee : null,
  ].filter((fee): fee is number => fee != null && Number.isFinite(fee));
  const any = services.standardEnabled || services.advancedEnabled || services.gpsAtsEnabled || services.mobileEnabled;
  if (!any) return null;
  return Math.round(selected.reduce((sum, fee) => sum + fee, 0) * 100) / 100;
}

export function serviceSubscriptionNames(
  services: Pick<DriverServiceSelection, "standardEnabled" | "advancedEnabled" | "gpsAtsEnabled" | "mobileEnabled">,
  labels: { standard: string; advanced: string; gpsAts: string; mobile: string; none: string },
) {
  const names = [
    services.standardEnabled ? labels.standard : null,
    services.advancedEnabled ? labels.advanced : null,
    services.gpsAtsEnabled ? labels.gpsAts : null,
    services.mobileEnabled ? labels.mobile : null,
  ].filter((name): name is string => Boolean(name));
  return names.length > 0 ? names.join(", ") : labels.none;
}

export function normalizeEmail(value: string | null | undefined) {
  return (value ?? "").trim().toLocaleLowerCase("en-US");
}
