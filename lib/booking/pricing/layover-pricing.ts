import {
  microEurFromDecimal,
  microEurToNumber,
} from "@/lib/booking/pricing/euro";
import {
  layoverAirportCodeFromDraft,
  layoverBaseEur,
  type LayoverAirportCode,
} from "@/lib/booking/layover-airports";
import {
  type LocationGeo,
  type TransferProvinceCode,
} from "@/lib/booking/pricing/location-codes";
import {
  type TransferPricingBreakdown,
} from "@/lib/booking/pricing/transfer-pricing";

export const TOUR_SERVICE_TYPE = "tour";
export const LAYOVER_TOUR_CODE = "istanbul-layover";
export const LAYOVER_PRICING_VERSION = "istanbul-layover.v2";
export const LAYOVER_PACKAGE_HOURS = 7;
export const LAYOVER_PACKAGE_KM = 120;
export const LAYOVER_OVERRUN_HOUR_EUR = "15";
export const LAYOVER_OVERRUN_KM_EUR = "0.50";

export function isLayoverTour(
  serviceType: string | null | undefined,
  tourCode: string | null | undefined,
): boolean {
  return (
    serviceType?.trim() === TOUR_SERVICE_TYPE &&
    tourCode?.trim() === LAYOVER_TOUR_CODE
  );
}

export type LayoverQuoteAirports = {
  pickupAirportCode: string | null | undefined;
  dropoffAirportCode: string | null | undefined;
  pickupLocationType?: string | null;
  dropoffLocationType?: string | null;
};

export function layoverQuoteAirportPair(
  input: LayoverQuoteAirports,
): { pickup: LayoverAirportCode; dropoff: LayoverAirportCode } | null {
  const pickup = layoverAirportCodeFromDraft(
    input.pickupAirportCode,
    input.pickupLocationType ?? "airport",
  );
  const dropoff = layoverAirportCodeFromDraft(
    input.dropoffAirportCode,
    input.dropoffLocationType ?? "airport",
  );
  if (!pickup || !dropoff) {
    return null;
  }
  return { pickup, dropoff };
}

/**
 * Base service fee from IST/SAW airport pair before vehicle multipliers and extras.
 * Package overage tariffs are informational only — not added at booking.
 */
export function quoteLayoverBase(
  pickup: LocationGeo,
  airports: LayoverQuoteAirports,
): TransferPricingBreakdown {
  const pair = layoverQuoteAirportPair(airports);
  const baseEur = pair ? layoverBaseEur(pair.pickup, pair.dropoff) : 150;
  const baseMicro = microEurFromDecimal(String(baseEur));
  const base = microEurToNumber(baseMicro);
  const emptyDropoffProvince: TransferProvinceCode = "other";

  return {
    openingFeeEur: base,
    distanceFeeEur: 0,
    locationSurchargeEur: 0,
    timeSurchargeEur: 0,
    baseTransferFeeEur: base,
    pricingVersion: LAYOVER_PRICING_VERSION,
    pickupProvinceCode: pickup.provinceCode,
    pickupDistrictCode: pickup.districtCode,
    dropoffProvinceCode: emptyDropoffProvince,
    dropoffDistrictCode: null,
  };
}
