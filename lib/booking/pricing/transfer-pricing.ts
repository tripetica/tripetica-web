import { timestamptzToIstanbulLocal } from "@/lib/booking/istanbul-time";
import {
  addMicroEur,
  maxMicroEur,
  microEurFromDecimal,
  microEurToNumber,
  minMicroEur,
  multiplyMicroEurByKm,
  type MicroEur,
} from "./euro";
import { type LocationGeo, type TransferProvinceCode } from "./location-codes";

export const TRANSFER_PRICING_VERSION = "transfer-pricing.v1";
export const TRANSFER_PRICING_SERVICE_TYPE = "transfer";

export type TransferOpeningFeeRule = {
  maxKmInclusive: number | null;
  feeEur: string;
};

export type TransferDistanceBandRule = {
  fromKmExclusive: number;
  toKmInclusive: number | null;
  rateEurPerKm: string;
};

export type TransferRegionFeeRule = {
  provinceCode: TransferProvinceCode;
  feeEur: string;
};

export type TransferDistrictFeeRule = {
  districtCode: string;
  feeEur: string;
};

export type TransferTimeSurchargeRule = {
  districtCode: string;
  startLocal: string;
  endLocal: string;
  feeEur: string;
};

export type TransferPricingRules = {
  version: string;
  serviceType: string;
  openingFees: TransferOpeningFeeRule[];
  distanceBands: TransferDistanceBandRule[];
  regionFees: TransferRegionFeeRule[];
  districtFees: TransferDistrictFeeRule[];
  timeSurcharges: TransferTimeSurchargeRule[];
};

export type TransferPricingInput = {
  distanceKm: number;
  pickupAtLocal: string;
  pickup: LocationGeo;
  dropoff: LocationGeo;
};

export type TransferPricingBreakdown = {
  openingFeeEur: number;
  distanceFeeEur: number;
  locationSurchargeEur: number;
  timeSurchargeEur: number;
  baseTransferFeeEur: number;
  pricingVersion: string;
  pickupProvinceCode: TransferProvinceCode;
  pickupDistrictCode: string | null;
  dropoffProvinceCode: TransferProvinceCode;
  dropoffDistrictCode: string | null;
};

export const TRANSFER_PRICING_V1: TransferPricingRules = {
  version: TRANSFER_PRICING_VERSION,
  serviceType: TRANSFER_PRICING_SERVICE_TYPE,
  openingFees: [
    { maxKmInclusive: 15, feeEur: "25" },
    { maxKmInclusive: 30, feeEur: "23" },
    { maxKmInclusive: null, feeEur: "15" },
  ],
  distanceBands: [
    { fromKmExclusive: 0, toKmInclusive: 60, rateEurPerKm: "0.55" },
    { fromKmExclusive: 60, toKmInclusive: 90, rateEurPerKm: "0.60" },
    { fromKmExclusive: 90, toKmInclusive: 120, rateEurPerKm: "0.65" },
    { fromKmExclusive: 120, toKmInclusive: 160, rateEurPerKm: "0.70" },
    { fromKmExclusive: 160, toKmInclusive: 220, rateEurPerKm: "0.80" },
    { fromKmExclusive: 220, toKmInclusive: 300, rateEurPerKm: "0.90" },
    { fromKmExclusive: 300, toKmInclusive: 400, rateEurPerKm: "1.00" },
    { fromKmExclusive: 400, toKmInclusive: null, rateEurPerKm: "1.10" },
  ],
  regionFees: [
    { provinceCode: "istanbul", feeEur: "0" },
    { provinceCode: "other", feeEur: "50" },
    { provinceCode: "yalova", feeEur: "90" },
    { provinceCode: "bursa", feeEur: "90" },
    { provinceCode: "antalya", feeEur: "0" },
  ],
  districtFees: [
    { districtCode: "adalar", feeEur: "0" },
    { districtCode: "arnavutkoy", feeEur: "0" },
    { districtCode: "atasehir", feeEur: "6" },
    { districtCode: "avcilar", feeEur: "10" },
    { districtCode: "bagcilar", feeEur: "7" },
    { districtCode: "bahcelievler", feeEur: "7" },
    { districtCode: "bakirkoy", feeEur: "8" },
    { districtCode: "basaksehir", feeEur: "9" },
    { districtCode: "bayrampasa", feeEur: "8" },
    { districtCode: "besiktas", feeEur: "0" },
    { districtCode: "beykoz", feeEur: "15" },
    { districtCode: "beylikduzu", feeEur: "10" },
    { districtCode: "beyoglu", feeEur: "0" },
    { districtCode: "buyukcekmece", feeEur: "10" },
    { districtCode: "catalca", feeEur: "20" },
    { districtCode: "cekmekoy", feeEur: "15" },
    { districtCode: "esenler", feeEur: "8" },
    { districtCode: "esenyurt", feeEur: "10" },
    { districtCode: "eyupsultan", feeEur: "8" },
    { districtCode: "fatih", feeEur: "2" },
    { districtCode: "gaziosmanpasa", feeEur: "8" },
    { districtCode: "gungoren", feeEur: "8" },
    { districtCode: "kadikoy", feeEur: "7" },
    { districtCode: "kagithane", feeEur: "9" },
    { districtCode: "kartal", feeEur: "10" },
    { districtCode: "kucukcekmece", feeEur: "10" },
    { districtCode: "maltepe", feeEur: "7" },
    { districtCode: "pendik", feeEur: "10" },
    { districtCode: "sancaktepe", feeEur: "15" },
    { districtCode: "sariyer", feeEur: "15" },
    { districtCode: "silivri", feeEur: "20" },
    { districtCode: "sultanbeyli", feeEur: "15" },
    { districtCode: "sultangazi", feeEur: "10" },
    { districtCode: "sile", feeEur: "40" },
    { districtCode: "sisli", feeEur: "0" },
    { districtCode: "tuzla", feeEur: "15" },
    { districtCode: "umraniye", feeEur: "8" },
    { districtCode: "uskudar", feeEur: "7" },
    { districtCode: "zeytinburnu", feeEur: "3" },
  ],
  timeSurcharges: [
    { districtCode: "kartal", startLocal: "13:00", endLocal: "21:00", feeEur: "15" },
    { districtCode: "maltepe", startLocal: "13:00", endLocal: "21:00", feeEur: "15" },
    { districtCode: "pendik", startLocal: "13:00", endLocal: "21:00", feeEur: "15" },
    { districtCode: "sancaktepe", startLocal: "13:00", endLocal: "21:00", feeEur: "15" },
    { districtCode: "sultanbeyli", startLocal: "13:00", endLocal: "21:00", feeEur: "15" },
    { districtCode: "tuzla", startLocal: "13:00", endLocal: "21:00", feeEur: "15" },
    { districtCode: "atasehir", startLocal: "13:00", endLocal: "21:00", feeEur: "5" },
    { districtCode: "kadikoy", startLocal: "13:00", endLocal: "21:00", feeEur: "5" },
    { districtCode: "umraniye", startLocal: "13:00", endLocal: "21:00", feeEur: "5" },
    { districtCode: "uskudar", startLocal: "13:00", endLocal: "21:00", feeEur: "5" },
  ],
};

function openingFee(distanceKm: number, rules: TransferPricingRules): MicroEur {
  const ordered = [...rules.openingFees].sort((a, b) => {
    if (a.maxKmInclusive === null) {
      return 1;
    }
    if (b.maxKmInclusive === null) {
      return -1;
    }
    return a.maxKmInclusive - b.maxKmInclusive;
  });
  for (const rule of ordered) {
    if (rule.maxKmInclusive === null || distanceKm <= rule.maxKmInclusive) {
      return microEurFromDecimal(rule.feeEur);
    }
  }
  return BigInt(0);
}

function distanceFee(distanceKm: number, rules: TransferPricingRules): MicroEur {
  const total = microEurFromDecimal(distanceKm);
  let fee: MicroEur = BigInt(0);
  for (const band of rules.distanceBands) {
    const from = microEurFromDecimal(band.fromKmExclusive);
    const to =
      band.toKmInclusive === null ? null : microEurFromDecimal(band.toKmInclusive);
    if (total <= from) {
      continue;
    }
    const spanEnd = to === null ? total : minMicroEur(total, to);
    const kmInBand = spanEnd - from;
    if (kmInBand <= BigInt(0)) {
      continue;
    }
    fee = addMicroEur(
      fee,
      multiplyMicroEurByKm(microEurFromDecimal(band.rateEurPerKm), kmInBand),
    );
  }
  return fee;
}

function locationFee(geo: LocationGeo, rules: TransferPricingRules): MicroEur {
  if (geo.provinceCode === "istanbul" && geo.districtCode) {
    const district = rules.districtFees.find(
      (rule) => rule.districtCode === geo.districtCode,
    );
    if (district) {
      return microEurFromDecimal(district.feeEur);
    }
  }
  const region = rules.regionFees.find(
    (rule) => rule.provinceCode === geo.provinceCode,
  );
  return region ? microEurFromDecimal(region.feeEur) : BigInt(0);
}

export const PICKUP_TIME_SURCHARGE_START = "13:00";
export const PICKUP_TIME_SURCHARGE_END = "21:00";

const PICKUP_TIME_SURCHARGE_15 = new Set([
  "kartal",
  "maltepe",
  "pendik",
  "sancaktepe",
  "sultanbeyli",
  "tuzla",
]);

const PICKUP_TIME_SURCHARGE_5 = new Set([
  "atasehir",
  "kadikoy",
  "umraniye",
  "uskudar",
]);

export type PickupTimeSurchargeEur = 0 | 5 | 15;

function istanbulHmFromAppliedPickupDateTime(
  value: string | Date | null | undefined,
): string | null {
  if (value instanceof Date) {
    return istanbulHmFromAppliedPickupDateTime(timestamptzToIstanbulLocal(value));
  }
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const local =
    /[zZ]$/.test(trimmed) || /[+-]\d{2}:?\d{2}$/.test(trimmed)
      ? timestamptzToIstanbulLocal(trimmed)
      : trimmed;
  const match = local.match(/T(\d{2}:\d{2})/) ?? local.match(/^(\d{2}:\d{2})$/);
  return match?.[1] ?? null;
}

/**
 * Excel “Alış Zamanına ve aynı zamanda alış yerine göre + ücret”.
 * Uses only applied pickup district + applied pickup datetime (Europe/Istanbul).
 * Drop-off is never consulted.
 */
export function calculatePickupTimeSurcharge(input: {
  appliedPickupDistrictCode: string | null | undefined;
  appliedPickupDateTime: string | Date | null | undefined;
}): PickupTimeSurchargeEur {
  const district = input.appliedPickupDistrictCode?.trim().toLowerCase() ?? "";
  if (!district) {
    return 0;
  }
  const hm = istanbulHmFromAppliedPickupDateTime(input.appliedPickupDateTime);
  if (
    !hm ||
    hm < PICKUP_TIME_SURCHARGE_START ||
    hm > PICKUP_TIME_SURCHARGE_END
  ) {
    return 0;
  }
  if (PICKUP_TIME_SURCHARGE_15.has(district)) {
    return 15;
  }
  if (PICKUP_TIME_SURCHARGE_5.has(district)) {
    return 5;
  }
  return 0;
}

export function quoteTransferBase(
  input: TransferPricingInput,
  rules: TransferPricingRules = TRANSFER_PRICING_V1,
): TransferPricingBreakdown {
  const opening = openingFee(input.distanceKm, rules);
  const distance = distanceFee(input.distanceKm, rules);
  const pickupFee = locationFee(input.pickup, rules);
  const dropoffFee = locationFee(input.dropoff, rules);
  const location = maxMicroEur(pickupFee, dropoffFee);
  const timeEur = calculatePickupTimeSurcharge({
    appliedPickupDistrictCode: input.pickup.districtCode,
    appliedPickupDateTime: input.pickupAtLocal,
  });
  const time = microEurFromDecimal(timeEur);
  const base = addMicroEur(opening, distance, location, time);

  return {
    openingFeeEur: microEurToNumber(opening),
    distanceFeeEur: microEurToNumber(distance),
    locationSurchargeEur: microEurToNumber(location),
    timeSurchargeEur: microEurToNumber(time),
    baseTransferFeeEur: microEurToNumber(base),
    pricingVersion: rules.version,
    pickupProvinceCode: input.pickup.provinceCode,
    pickupDistrictCode: input.pickup.districtCode,
    dropoffProvinceCode: input.dropoff.provinceCode,
    dropoffDistrictCode: input.dropoff.districtCode,
  };
}
