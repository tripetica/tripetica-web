import {
  normalizeMeetAndGreet,
  type PickupAirportInput,
} from "@/lib/booking/meet-and-greet";
import {
  addMicroEur,
  microEurFromDecimal,
  microEurToNumber,
  multiplyMicroEurByKm,
} from "./euro";
import { type TransferPricingBreakdown } from "./transfer-pricing";

export const PREMIUM_ECONOMY_SEDAN_CODE = "premium-economy-sedan";
export const STANDARD_MINIVAN_CODE = "standard-minivan";
export const BUSINESS_MINIVAN_CODE = "business-minivan";
export const FIRST_CLASS_MINIVAN_CODE = "first-class-minivan";
export const FIRST_CLASS_SEDAN_CODE = "first-class-sedan";
export const MINIBUS_CODE = "minibus";
export const MIDIBUS_CODE = "midibus";
export const BUS_CODE = "bus";

export type VehicleOccupancy = {
  passengerCount: number | null;
  luggageCount: number | null;
  babySeatCount: number | null;
  meetAndGreet: boolean | null;
};

export type VehicleQuoteBreakdown = {
  vehicleCode: string;
  multiplier: number;
  baseServiceFeeEur: number;
  extraPassengerFeeEur: number;
  extraLuggageFeeEur: number;
  babySeatFeeEur: number;
  meetAndGreetFeeEur: number;
  totalEur: number;
};

export const PREMIUM_ECONOMY_SEDAN = {
  code: PREMIUM_ECONOMY_SEDAN_CODE,
  multiplier: "1.00",
  includedPassengers: 2,
  extraPassengerFeeEur: "1",
  extraPassengerThreshold: 3,
  includedLuggage: 2,
  extraLuggageFeeEur: "1",
  extraLuggageThreshold: 3,
  babySeatFeeEur: "10",
  meetAndGreetFeeEur: "5",
  standardPassengers: 2,
  standardLuggage: 2,
  maxPassengers: 3,
  maxLuggage: 3,
  // TODO(vehicle-eligibility): Premium Economy Sedan is not suitable for more
  // than 1 baby seat or more than 3 passengers / 3 bags. Hide or filter the
  // card when occupancy exceeds these limits; do not show this note in the UI.
  maxBabySeats: 1,
} as const;

export const STANDARD_MINIVAN = {
  code: STANDARD_MINIVAN_CODE,
  multiplier: "1.10",
  includedPassengers: 5,
  extraPassengerFeeEur: "1",
  includedLuggage: 5,
  extraLuggageFeeEur: "1",
  babySeatFeeEur: "10",
  meetAndGreetFeeEur: "5",
  standardPassengers: 5,
  standardLuggage: 5,
  maxPassengers: 7,
  maxLuggage: 8,
  maxBabySeats: 2,
} as const;

export const BUSINESS_MINIVAN = {
  code: BUSINESS_MINIVAN_CODE,
  multiplier: "1.20",
  includedPassengers: 4,
  extraPassengerFeeEur: "1",
  includedLuggage: 4,
  extraLuggageFeeEur: "1",
  babySeatFeeEur: "10",
  meetAndGreetFeeEur: "5",
  standardPassengers: 4,
  standardLuggage: 4,
  maxPassengers: 6,
  maxLuggage: 6,
  maxBabySeats: 2,
} as const;

export const FIRST_CLASS_MINIVAN = {
  code: FIRST_CLASS_MINIVAN_CODE,
  multiplier: "2.70",
  includedPassengers: 3,
  extraPassengerFeeEur: "5",
  includedLuggage: 3,
  extraLuggageFeeEur: "5",
  babySeatFeeEur: "10",
  meetAndGreetFeeEur: "0",
  standardPassengers: 3,
  standardLuggage: 3,
  maxPassengers: 5,
  maxLuggage: 5,
  maxBabySeats: 2,
} as const;

export const FIRST_CLASS_SEDAN = {
  code: FIRST_CLASS_SEDAN_CODE,
  multiplier: "8.00",
  includedPassengers: 2,
  extraPassengerFeeEur: "10",
  includedLuggage: 2,
  extraLuggageFeeEur: "10",
  babySeatFeeEur: "20",
  meetAndGreetFeeEur: "0",
  standardPassengers: 2,
  standardLuggage: 2,
  maxPassengers: 3,
  maxLuggage: 3,
  maxBabySeats: 1,
} as const;

export const MINIBUS = {
  code: MINIBUS_CODE,
  multiplier: "1.60",
  includedPassengers: 9,
  extraPassengerFeeEur: "1",
  includedLuggage: 9,
  extraLuggageFeeEur: "1",
  babySeatFeeEur: "10",
  meetAndGreetFeeEur: "7",
  standardPassengers: 9,
  standardLuggage: 9,
  minPassengers: 7,
  minLuggage: 7,
  maxPassengers: 18,
  maxLuggage: 19,
  maxBabySeats: 3,
} as const;

export const MIDIBUS = {
  code: MIDIBUS_CODE,
  multiplier: "5.40",
  includedPassengers: 20,
  extraPassengerFeeEur: "1",
  includedLuggage: 20,
  extraLuggageFeeEur: "1",
  babySeatFeeEur: "10",
  meetAndGreetFeeEur: "10",
  standardPassengers: 20,
  standardLuggage: 20,
  minPassengers: 17,
  minLuggage: 18,
  maxPassengers: 25,
  maxLuggage: 27,
} as const;

export const BUS = {
  code: BUS_CODE,
  multiplier: "10.00",
  includedPassengers: 35,
  extraPassengerFeeEur: "1",
  includedLuggage: 35,
  extraLuggageFeeEur: "1",
  babySeatFeeEur: "10",
  meetAndGreetFeeEur: "15",
  standardPassengers: 35,
  standardLuggage: 35,
  minPassengers: 25,
  minLuggage: 25,
  maxPassengers: 45,
  maxLuggage: 45,
} as const;

export type VehicleCapacitySpec = {
  maxPassengers: number;
  maxLuggage: number;
  maxBabySeats: number;
};

export function occupancyIsUnset(occupancy: VehicleOccupancy): boolean {
  const passengersUnset =
    occupancy.passengerCount === null || occupancy.passengerCount === 0;
  return (
    passengersUnset &&
    occupancy.luggageCount === null &&
    occupancy.babySeatCount === null
  );
}

function countWithinMax(count: number | null, max: number) {
  if (count === null) {
    return true;
  }
  return count >= 0 && count <= max;
}

export function isVehicleVisible(
  spec: VehicleCapacitySpec,
  occupancy: VehicleOccupancy,
): boolean {
  return (
    countWithinMax(occupancy.passengerCount, spec.maxPassengers) &&
    countWithinMax(occupancy.luggageCount, spec.maxLuggage) &&
    countWithinMax(occupancy.babySeatCount, spec.maxBabySeats)
  );
}

export function isPremiumEconomySedanVisible(occupancy: VehicleOccupancy): boolean {
  return isVehicleVisible(PREMIUM_ECONOMY_SEDAN, occupancy);
}

export function isStandardMinivanVisible(occupancy: VehicleOccupancy): boolean {
  return isVehicleVisible(STANDARD_MINIVAN, occupancy);
}

export function isBusinessMinivanVisible(occupancy: VehicleOccupancy): boolean {
  return isVehicleVisible(BUSINESS_MINIVAN, occupancy);
}

export function isFirstClassMinivanVisible(occupancy: VehicleOccupancy): boolean {
  return isVehicleVisible(FIRST_CLASS_MINIVAN, occupancy);
}

export function isFirstClassSedanVisible(occupancy: VehicleOccupancy): boolean {
  return isVehicleVisible(FIRST_CLASS_SEDAN, occupancy);
}

function countIsInRange(count: number | null, min: number, max: number) {
  return count !== null && count >= min && count <= max;
}

function countDoesNotExceed(count: number | null, max: number) {
  return count === null || count <= max;
}

export function isMinibusVisible(occupancy: VehicleOccupancy): boolean {
  if (
    !countDoesNotExceed(occupancy.passengerCount, MINIBUS.maxPassengers) ||
    !countDoesNotExceed(occupancy.luggageCount, MINIBUS.maxLuggage)
  ) {
    return false;
  }
  return (
    countIsInRange(
      occupancy.passengerCount,
      MINIBUS.minPassengers,
      MINIBUS.maxPassengers,
    ) ||
    countIsInRange(occupancy.luggageCount, MINIBUS.minLuggage, MINIBUS.maxLuggage)
  );
}

export function isMidibusVisible(occupancy: VehicleOccupancy): boolean {
  if (
    !countDoesNotExceed(occupancy.passengerCount, MIDIBUS.maxPassengers) ||
    !countDoesNotExceed(occupancy.luggageCount, MIDIBUS.maxLuggage)
  ) {
    return false;
  }
  return (
    countIsInRange(
      occupancy.passengerCount,
      MIDIBUS.minPassengers,
      MIDIBUS.maxPassengers,
    ) ||
    countIsInRange(occupancy.luggageCount, MIDIBUS.minLuggage, MIDIBUS.maxLuggage)
  );
}

export function isBusVisible(occupancy: VehicleOccupancy): boolean {
  if (
    !countDoesNotExceed(occupancy.passengerCount, BUS.maxPassengers) ||
    !countDoesNotExceed(occupancy.luggageCount, BUS.maxLuggage)
  ) {
    return false;
  }
  return (
    countIsInRange(
      occupancy.passengerCount,
      BUS.minPassengers,
      BUS.maxPassengers,
    ) ||
    countIsInRange(occupancy.luggageCount, BUS.minLuggage, BUS.maxLuggage)
  );
}

export function includesFirstClassAmenities(vehicleCode: string) {
  return (
    vehicleCode === FIRST_CLASS_MINIVAN_CODE ||
    vehicleCode === FIRST_CLASS_SEDAN_CODE
  );
}

export function meetAndGreetForVehicleSelection(
  vehicleCode: string,
  pickup: PickupAirportInput,
  requested: boolean | null,
) {
  return normalizeMeetAndGreet(
    pickup,
    includesFirstClassAmenities(vehicleCode) ? true : requested,
  );
}

/** Counts and meet & greet for vehicle quotes use applied trip state. */
export function occupancyForVehicleQuotes(
  counts: Pick<VehicleOccupancy, "passengerCount" | "luggageCount" | "babySeatCount">,
  meetAndGreetRequested: boolean | null,
  pickup: PickupAirportInput,
): VehicleOccupancy {
  return {
    passengerCount: counts.passengerCount,
    luggageCount: counts.luggageCount,
    babySeatCount: counts.babySeatCount,
    meetAndGreet: normalizeMeetAndGreet(pickup, meetAndGreetRequested),
  };
}

function meetAndGreetFeeMicro(
  vehicleCode: string,
  occupancy: VehicleOccupancy,
  feeEur: string,
) {
  if (includesFirstClassAmenities(vehicleCode) || occupancy.meetAndGreet !== true) {
    return BigInt(0);
  }
  return microEurFromDecimal(feeEur);
}

function extraFee(
  count: number | null,
  threshold: number,
  feeEur: string,
): ReturnType<typeof microEurFromDecimal> {
  if (count === null || count < threshold) {
    return BigInt(0);
  }
  return microEurFromDecimal(feeEur);
}

export function quotePremiumEconomySedan(
  base: TransferPricingBreakdown,
  occupancy: VehicleOccupancy,
): VehicleQuoteBreakdown {
  const multiplier = microEurFromDecimal(PREMIUM_ECONOMY_SEDAN.multiplier);
  const baseService = multiplyMicroEurByKm(
    microEurFromDecimal(base.baseTransferFeeEur),
    multiplier,
  );
  const extraPassenger = extraFee(
    occupancy.passengerCount,
    PREMIUM_ECONOMY_SEDAN.extraPassengerThreshold,
    PREMIUM_ECONOMY_SEDAN.extraPassengerFeeEur,
  );
  const extraLuggage = extraFee(
    occupancy.luggageCount,
    PREMIUM_ECONOMY_SEDAN.extraLuggageThreshold,
    PREMIUM_ECONOMY_SEDAN.extraLuggageFeeEur,
  );
  const babySeatCount = occupancy.babySeatCount ?? 0;
  const babySeat =
    babySeatCount <= 0
      ? BigInt(0)
      : microEurFromDecimal(PREMIUM_ECONOMY_SEDAN.babySeatFeeEur);
  const meetAndGreet = meetAndGreetFeeMicro(
    PREMIUM_ECONOMY_SEDAN.code,
    occupancy,
    PREMIUM_ECONOMY_SEDAN.meetAndGreetFeeEur,
  );
  const total = addMicroEur(
    baseService,
    extraPassenger,
    extraLuggage,
    babySeat,
    meetAndGreet,
  );

  return {
    vehicleCode: PREMIUM_ECONOMY_SEDAN.code,
    multiplier: Number(PREMIUM_ECONOMY_SEDAN.multiplier),
    baseServiceFeeEur: microEurToNumber(baseService),
    extraPassengerFeeEur: microEurToNumber(extraPassenger),
    extraLuggageFeeEur: microEurToNumber(extraLuggage),
    babySeatFeeEur: microEurToNumber(babySeat),
    meetAndGreetFeeEur: microEurToNumber(meetAndGreet),
    totalEur: microEurToNumber(total),
  };
}

function extraUnitsFee(
  count: number | null,
  included: number,
  feeEur: string,
): ReturnType<typeof microEurFromDecimal> {
  if (count === null) {
    return BigInt(0);
  }
  const extra = count - included;
  if (extra <= 0) {
    return BigInt(0);
  }
  return multiplyMicroEurByKm(
    microEurFromDecimal(feeEur),
    microEurFromDecimal(extra),
  );
}

export function quoteStandardMinivan(
  base: TransferPricingBreakdown,
  occupancy: VehicleOccupancy,
): VehicleQuoteBreakdown {
  const multiplier = microEurFromDecimal(STANDARD_MINIVAN.multiplier);
  const baseService = multiplyMicroEurByKm(
    microEurFromDecimal(base.baseTransferFeeEur),
    multiplier,
  );
  const extraPassenger = extraUnitsFee(
    occupancy.passengerCount,
    STANDARD_MINIVAN.includedPassengers,
    STANDARD_MINIVAN.extraPassengerFeeEur,
  );
  const extraLuggage = extraUnitsFee(
    occupancy.luggageCount,
    STANDARD_MINIVAN.includedLuggage,
    STANDARD_MINIVAN.extraLuggageFeeEur,
  );
  const babySeat = extraUnitsFee(
    occupancy.babySeatCount,
    0,
    STANDARD_MINIVAN.babySeatFeeEur,
  );
  const meetAndGreet = meetAndGreetFeeMicro(
    STANDARD_MINIVAN.code,
    occupancy,
    STANDARD_MINIVAN.meetAndGreetFeeEur,
  );
  const total = addMicroEur(
    baseService,
    extraPassenger,
    extraLuggage,
    babySeat,
    meetAndGreet,
  );

  return {
    vehicleCode: STANDARD_MINIVAN.code,
    multiplier: Number(STANDARD_MINIVAN.multiplier),
    baseServiceFeeEur: microEurToNumber(baseService),
    extraPassengerFeeEur: microEurToNumber(extraPassenger),
    extraLuggageFeeEur: microEurToNumber(extraLuggage),
    babySeatFeeEur: microEurToNumber(babySeat),
    meetAndGreetFeeEur: microEurToNumber(meetAndGreet),
    totalEur: microEurToNumber(total),
  };
}

export function quoteBusinessMinivan(
  base: TransferPricingBreakdown,
  occupancy: VehicleOccupancy,
): VehicleQuoteBreakdown {
  const multiplier = microEurFromDecimal(BUSINESS_MINIVAN.multiplier);
  const baseService = multiplyMicroEurByKm(
    microEurFromDecimal(base.baseTransferFeeEur),
    multiplier,
  );
  const extraPassenger = extraUnitsFee(
    occupancy.passengerCount,
    BUSINESS_MINIVAN.includedPassengers,
    BUSINESS_MINIVAN.extraPassengerFeeEur,
  );
  const extraLuggage = extraUnitsFee(
    occupancy.luggageCount,
    BUSINESS_MINIVAN.includedLuggage,
    BUSINESS_MINIVAN.extraLuggageFeeEur,
  );
  const babySeat = extraUnitsFee(
    occupancy.babySeatCount,
    0,
    BUSINESS_MINIVAN.babySeatFeeEur,
  );
  const meetAndGreet = meetAndGreetFeeMicro(
    BUSINESS_MINIVAN.code,
    occupancy,
    BUSINESS_MINIVAN.meetAndGreetFeeEur,
  );
  const total = addMicroEur(
    baseService,
    extraPassenger,
    extraLuggage,
    babySeat,
    meetAndGreet,
  );

  return {
    vehicleCode: BUSINESS_MINIVAN.code,
    multiplier: Number(BUSINESS_MINIVAN.multiplier),
    baseServiceFeeEur: microEurToNumber(baseService),
    extraPassengerFeeEur: microEurToNumber(extraPassenger),
    extraLuggageFeeEur: microEurToNumber(extraLuggage),
    babySeatFeeEur: microEurToNumber(babySeat),
    meetAndGreetFeeEur: microEurToNumber(meetAndGreet),
    totalEur: microEurToNumber(total),
  };
}

export function quoteFirstClassMinivan(
  base: TransferPricingBreakdown,
  occupancy: VehicleOccupancy,
): VehicleQuoteBreakdown {
  const multiplier = microEurFromDecimal(FIRST_CLASS_MINIVAN.multiplier);
  const baseService = multiplyMicroEurByKm(
    microEurFromDecimal(base.baseTransferFeeEur),
    multiplier,
  );
  const extraPassenger = extraUnitsFee(
    occupancy.passengerCount,
    FIRST_CLASS_MINIVAN.includedPassengers,
    FIRST_CLASS_MINIVAN.extraPassengerFeeEur,
  );
  const extraLuggage = extraUnitsFee(
    occupancy.luggageCount,
    FIRST_CLASS_MINIVAN.includedLuggage,
    FIRST_CLASS_MINIVAN.extraLuggageFeeEur,
  );
  const babySeat = extraUnitsFee(
    occupancy.babySeatCount,
    0,
    FIRST_CLASS_MINIVAN.babySeatFeeEur,
  );
  const meetAndGreet = meetAndGreetFeeMicro(
    FIRST_CLASS_MINIVAN.code,
    occupancy,
    FIRST_CLASS_MINIVAN.meetAndGreetFeeEur,
  );
  const total = addMicroEur(
    baseService,
    extraPassenger,
    extraLuggage,
    babySeat,
    meetAndGreet,
  );

  return {
    vehicleCode: FIRST_CLASS_MINIVAN.code,
    multiplier: Number(FIRST_CLASS_MINIVAN.multiplier),
    baseServiceFeeEur: microEurToNumber(baseService),
    extraPassengerFeeEur: microEurToNumber(extraPassenger),
    extraLuggageFeeEur: microEurToNumber(extraLuggage),
    babySeatFeeEur: microEurToNumber(babySeat),
    meetAndGreetFeeEur: microEurToNumber(meetAndGreet),
    totalEur: microEurToNumber(total),
  };
}

export function quoteFirstClassSedan(
  base: TransferPricingBreakdown,
  occupancy: VehicleOccupancy,
): VehicleQuoteBreakdown {
  const multiplier = microEurFromDecimal(FIRST_CLASS_SEDAN.multiplier);
  const baseService = multiplyMicroEurByKm(
    microEurFromDecimal(base.baseTransferFeeEur),
    multiplier,
  );
  const extraPassenger = extraUnitsFee(
    occupancy.passengerCount,
    FIRST_CLASS_SEDAN.includedPassengers,
    FIRST_CLASS_SEDAN.extraPassengerFeeEur,
  );
  const extraLuggage = extraUnitsFee(
    occupancy.luggageCount,
    FIRST_CLASS_SEDAN.includedLuggage,
    FIRST_CLASS_SEDAN.extraLuggageFeeEur,
  );
  const babySeat = extraUnitsFee(
    occupancy.babySeatCount,
    0,
    FIRST_CLASS_SEDAN.babySeatFeeEur,
  );
  const meetAndGreet = meetAndGreetFeeMicro(
    FIRST_CLASS_SEDAN.code,
    occupancy,
    FIRST_CLASS_SEDAN.meetAndGreetFeeEur,
  );
  const total = addMicroEur(
    baseService,
    extraPassenger,
    extraLuggage,
    babySeat,
    meetAndGreet,
  );

  return {
    vehicleCode: FIRST_CLASS_SEDAN.code,
    multiplier: Number(FIRST_CLASS_SEDAN.multiplier),
    baseServiceFeeEur: microEurToNumber(baseService),
    extraPassengerFeeEur: microEurToNumber(extraPassenger),
    extraLuggageFeeEur: microEurToNumber(extraLuggage),
    babySeatFeeEur: microEurToNumber(babySeat),
    meetAndGreetFeeEur: microEurToNumber(meetAndGreet),
    totalEur: microEurToNumber(total),
  };
}

export function quoteMinibus(
  base: TransferPricingBreakdown,
  occupancy: VehicleOccupancy,
): VehicleQuoteBreakdown {
  const multiplier = microEurFromDecimal(MINIBUS.multiplier);
  const baseService = multiplyMicroEurByKm(
    microEurFromDecimal(base.baseTransferFeeEur),
    multiplier,
  );
  const extraPassenger = extraUnitsFee(
    occupancy.passengerCount,
    MINIBUS.includedPassengers,
    MINIBUS.extraPassengerFeeEur,
  );
  const extraLuggage = extraUnitsFee(
    occupancy.luggageCount,
    MINIBUS.includedLuggage,
    MINIBUS.extraLuggageFeeEur,
  );
  const babySeat = extraUnitsFee(
    occupancy.babySeatCount,
    0,
    MINIBUS.babySeatFeeEur,
  );
  const meetAndGreet = meetAndGreetFeeMicro(
    MINIBUS.code,
    occupancy,
    MINIBUS.meetAndGreetFeeEur,
  );
  const total = addMicroEur(
    baseService,
    extraPassenger,
    extraLuggage,
    babySeat,
    meetAndGreet,
  );

  return {
    vehicleCode: MINIBUS.code,
    multiplier: Number(MINIBUS.multiplier),
    baseServiceFeeEur: microEurToNumber(baseService),
    extraPassengerFeeEur: microEurToNumber(extraPassenger),
    extraLuggageFeeEur: microEurToNumber(extraLuggage),
    babySeatFeeEur: microEurToNumber(babySeat),
    meetAndGreetFeeEur: microEurToNumber(meetAndGreet),
    totalEur: microEurToNumber(total),
  };
}

export function quoteMidibus(
  base: TransferPricingBreakdown,
  occupancy: VehicleOccupancy,
): VehicleQuoteBreakdown {
  const multiplier = microEurFromDecimal(MIDIBUS.multiplier);
  const baseService = multiplyMicroEurByKm(
    microEurFromDecimal(base.baseTransferFeeEur),
    multiplier,
  );
  const extraPassenger = extraUnitsFee(
    occupancy.passengerCount,
    MIDIBUS.includedPassengers,
    MIDIBUS.extraPassengerFeeEur,
  );
  const extraLuggage = extraUnitsFee(
    occupancy.luggageCount,
    MIDIBUS.includedLuggage,
    MIDIBUS.extraLuggageFeeEur,
  );
  const babySeat = extraUnitsFee(
    occupancy.babySeatCount,
    0,
    MIDIBUS.babySeatFeeEur,
  );
  const meetAndGreet = meetAndGreetFeeMicro(
    MIDIBUS.code,
    occupancy,
    MIDIBUS.meetAndGreetFeeEur,
  );
  const total = addMicroEur(
    baseService,
    extraPassenger,
    extraLuggage,
    babySeat,
    meetAndGreet,
  );

  return {
    vehicleCode: MIDIBUS.code,
    multiplier: Number(MIDIBUS.multiplier),
    baseServiceFeeEur: microEurToNumber(baseService),
    extraPassengerFeeEur: microEurToNumber(extraPassenger),
    extraLuggageFeeEur: microEurToNumber(extraLuggage),
    babySeatFeeEur: microEurToNumber(babySeat),
    meetAndGreetFeeEur: microEurToNumber(meetAndGreet),
    totalEur: microEurToNumber(total),
  };
}

export function quoteBus(
  base: TransferPricingBreakdown,
  occupancy: VehicleOccupancy,
): VehicleQuoteBreakdown {
  const multiplier = microEurFromDecimal(BUS.multiplier);
  const baseService = multiplyMicroEurByKm(
    microEurFromDecimal(base.baseTransferFeeEur),
    multiplier,
  );
  const extraPassenger = extraUnitsFee(
    occupancy.passengerCount,
    BUS.includedPassengers,
    BUS.extraPassengerFeeEur,
  );
  const extraLuggage = extraUnitsFee(
    occupancy.luggageCount,
    BUS.includedLuggage,
    BUS.extraLuggageFeeEur,
  );
  const babySeat = extraUnitsFee(
    occupancy.babySeatCount,
    0,
    BUS.babySeatFeeEur,
  );
  const meetAndGreet = meetAndGreetFeeMicro(
    BUS.code,
    occupancy,
    BUS.meetAndGreetFeeEur,
  );
  const total = addMicroEur(
    baseService,
    extraPassenger,
    extraLuggage,
    babySeat,
    meetAndGreet,
  );

  return {
    vehicleCode: BUS.code,
    multiplier: Number(BUS.multiplier),
    baseServiceFeeEur: microEurToNumber(baseService),
    extraPassengerFeeEur: microEurToNumber(extraPassenger),
    extraLuggageFeeEur: microEurToNumber(extraLuggage),
    babySeatFeeEur: microEurToNumber(babySeat),
    meetAndGreetFeeEur: microEurToNumber(meetAndGreet),
    totalEur: microEurToNumber(total),
  };
}

function withFlatVehicleSurcharge(
  quote: VehicleQuoteBreakdown,
  base: TransferPricingBreakdown,
): VehicleQuoteBreakdown {
  const flat = base.flatVehicleSurchargeEur ?? 0;
  if (flat <= 0) {
    return quote;
  }
  const totalEur = microEurToNumber(
    addMicroEur(microEurFromDecimal(String(quote.totalEur)), microEurFromDecimal(String(flat))),
  );
  return { ...quote, totalEur };
}

export function vehicleMultiplierForCode(
  vehicleCode: string | null | undefined,
): number {
  if (vehicleCode === BUS_CODE) return Number(BUS.multiplier);
  if (vehicleCode === MIDIBUS_CODE) return Number(MIDIBUS.multiplier);
  if (vehicleCode === MINIBUS_CODE) return Number(MINIBUS.multiplier);
  if (vehicleCode === FIRST_CLASS_SEDAN_CODE) {
    return Number(FIRST_CLASS_SEDAN.multiplier);
  }
  if (vehicleCode === FIRST_CLASS_MINIVAN_CODE) {
    return Number(FIRST_CLASS_MINIVAN.multiplier);
  }
  if (vehicleCode === BUSINESS_MINIVAN_CODE) {
    return Number(BUSINESS_MINIVAN.multiplier);
  }
  if (vehicleCode === STANDARD_MINIVAN_CODE) {
    return Number(STANDARD_MINIVAN.multiplier);
  }
  return Number(PREMIUM_ECONOMY_SEDAN.multiplier);
}

export function quoteVehicle(
  vehicleCode: string,
  base: TransferPricingBreakdown,
  occupancy: VehicleOccupancy,
): VehicleQuoteBreakdown {
  let quote: VehicleQuoteBreakdown;
  if (vehicleCode === BUS_CODE) {
    quote = quoteBus(base, occupancy);
  } else if (vehicleCode === MIDIBUS_CODE) {
    quote = quoteMidibus(base, occupancy);
  } else if (vehicleCode === MINIBUS_CODE) {
    quote = quoteMinibus(base, occupancy);
  } else if (vehicleCode === FIRST_CLASS_SEDAN_CODE) {
    quote = quoteFirstClassSedan(base, occupancy);
  } else if (vehicleCode === FIRST_CLASS_MINIVAN_CODE) {
    quote = quoteFirstClassMinivan(base, occupancy);
  } else if (vehicleCode === BUSINESS_MINIVAN_CODE) {
    quote = quoteBusinessMinivan(base, occupancy);
  } else if (vehicleCode === STANDARD_MINIVAN_CODE) {
    quote = quoteStandardMinivan(base, occupancy);
  } else {
    quote = quotePremiumEconomySedan(base, occupancy);
  }
  return withFlatVehicleSurcharge(quote, base);
}
