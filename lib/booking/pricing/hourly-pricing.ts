import {
  addMicroEur,
  microEurFromDecimal,
  microEurToNumber,
  type MicroEur,
} from "@/lib/booking/pricing/euro";
import {
  type LocationGeo,
  type TransferProvinceCode,
} from "@/lib/booking/pricing/location-codes";
import {
  TRANSFER_PRICING_V1,
  type TransferPricingBreakdown,
  type TransferPricingRules,
} from "@/lib/booking/pricing/transfer-pricing";
import { HOURLY_DROPOFF_DISTANCE_RATE_EUR } from "@/lib/booking/hourly-dropoff-distance";

export const HOURLY_PRICING_VERSION = "hourly-chauffeur.v1";
export const HOURLY_SERVICE_TYPE = "hourly";

export const HOURLY_MIN_HOURS = 5;
export const HOURLY_MAX_HOURS = 20;
export const HOURLY_BASE_EUR_AT_MIN = "100";
export const HOURLY_EXTRA_EUR_PER_HOUR = "15";
export const HOURLY_OUTSIDE_ISTANBUL_SURCHARGE_EUR = "50";
export const HOURLY_OVERRUN_HOUR_EUR = HOURLY_EXTRA_EUR_PER_HOUR;
export const HOURLY_OVERRUN_KM_EUR = HOURLY_DROPOFF_DISTANCE_RATE_EUR;
export const HOURLY_CONTINENT_CROSSING_EUR = "15";

export type HourlyPricingInput = {
  durationHours: number;
  pickup: LocationGeo;
  /** Canonical airport code when pickup is an airport preset (IST / SAW / …). */
  pickupAirportCode?: string | null;
  /**
   * Pickup→dropoff route km (operational display only).
   * Not billed at reservation time — package km overruns are charged after service.
   */
  dropoffDistanceKm?: number | null;
};

/**
 * Standard hourly base before location surcharge.
 * 5h = €100; each hour after that +€15.
 */
export function hourlyBaseEur(durationHours: number): number {
  const hours = Math.round(durationHours);
  if (!Number.isFinite(hours) || hours < HOURLY_MIN_HOURS) {
    return microEurToNumber(microEurFromDecimal(HOURLY_BASE_EUR_AT_MIN));
  }
  const clamped = Math.min(hours, HOURLY_MAX_HOURS);
  const extraHours = clamped - HOURLY_MIN_HOURS;
  const total = addMicroEur(
    microEurFromDecimal(HOURLY_BASE_EUR_AT_MIN),
    microEurFromDecimal(HOURLY_EXTRA_EUR_PER_HOUR) * BigInt(extraHours),
  );
  return microEurToNumber(total);
}

function districtFeeMicro(
  districtCode: string | null,
  rules: TransferPricingRules,
): MicroEur {
  if (!districtCode) {
    return BigInt(0);
  }
  const district = rules.districtFees.find((rule) => rule.districtCode === districtCode);
  return district ? microEurFromDecimal(district.feeEur) : BigInt(0);
}

/**
 * Pickup-only surcharge for hourly chauffeur.
 * IST/SAW airport premiums are not applied; outside Istanbul → district table.
 * Fees are mutually exclusive (never stacked).
 */
export function hourlyPickupSurchargeMicro(
  pickup: LocationGeo,
  pickupAirportCode: string | null | undefined,
  rules: TransferPricingRules = TRANSFER_PRICING_V1,
): MicroEur {
  const airport = pickupAirportCode?.trim().toUpperCase() ?? "";
  if (airport === "IST" || airport === "SAW") {
    return BigInt(0);
  }
  if (pickup.provinceCode !== "istanbul") {
    return microEurFromDecimal(HOURLY_OUTSIDE_ISTANBUL_SURCHARGE_EUR);
  }
  return districtFeeMicro(pickup.districtCode, rules);
}

export function hourlyPickupSurchargeEur(
  pickup: LocationGeo,
  pickupAirportCode?: string | null,
  rules: TransferPricingRules = TRANSFER_PRICING_V1,
): number {
  return microEurToNumber(hourlyPickupSurchargeMicro(pickup, pickupAirportCode, rules));
}

/**
 * Builds a TransferPricingBreakdown-shaped quote so vehicle multipliers,
 * extras, and FX reuse the existing transfer vehicle quote pipeline.
 * Drop-off route distance is not billed at booking time.
 */
export function quoteHourlyBase(
  input: HourlyPricingInput,
  rules: TransferPricingRules = TRANSFER_PRICING_V1,
): TransferPricingBreakdown {
  const hours = Math.round(input.durationHours);
  const clamped = Math.min(Math.max(hours, HOURLY_MIN_HOURS), HOURLY_MAX_HOURS);
  const baseMicro = microEurFromDecimal(String(hourlyBaseEur(clamped)));
  const surchargeMicro = hourlyPickupSurchargeMicro(
    input.pickup,
    input.pickupAirportCode,
    rules,
  );
  const dropoffDistanceKm = Math.max(0, input.dropoffDistanceKm ?? 0);
  const totalMicro = addMicroEur(baseMicro, surchargeMicro);
  const emptyDropoffProvince: TransferProvinceCode = "other";

  return {
    openingFeeEur: microEurToNumber(baseMicro),
    distanceFeeEur: 0,
    locationSurchargeEur: microEurToNumber(surchargeMicro),
    timeSurchargeEur: 0,
    baseTransferFeeEur: microEurToNumber(totalMicro),
    pricingVersion: HOURLY_PRICING_VERSION,
    pickupProvinceCode: input.pickup.provinceCode,
    pickupDistrictCode: input.pickup.districtCode,
    dropoffProvinceCode: emptyDropoffProvince,
    dropoffDistrictCode: null,
    hourlyDropoffDistanceKm: dropoffDistanceKm,
  };
}
