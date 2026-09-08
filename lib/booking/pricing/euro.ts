/** Fixed-point euros. 1 EUR = 1_000_000 micro-euros. */

export type MicroEur = bigint;

export const MICRO_EUR_SCALE = BigInt(1_000_000);
const MICRO_PER_CENT = BigInt(10_000);

export class EuroParseError extends Error {
  constructor(value: string) {
    super(`Invalid euro amount: ${value}`);
    this.name = "EuroParseError";
  }
}

export function microEurFromDecimal(value: string | number): MicroEur {
  const text =
    typeof value === "number" ? decimalFromNumber(value) : value.trim();
  const match = text.match(/^(-?)(\d+)(?:[.,](\d+))?$/);
  if (!match) {
    throw new EuroParseError(text);
  }
  const sign = match[1] === "-" ? BigInt(-1) : BigInt(1);
  const whole = BigInt(match[2]);
  const frac = (match[3] ?? "").slice(0, 6);
  const fracPadded = `${frac}${"0".repeat(6 - frac.length)}`;
  return sign * (whole * MICRO_EUR_SCALE + BigInt(fracPadded));
}

export function addMicroEur(...values: MicroEur[]): MicroEur {
  return values.reduce((sum, value) => sum + value, BigInt(0));
}

export function maxMicroEur(a: MicroEur, b: MicroEur): MicroEur {
  return a >= b ? a : b;
}

export function multiplyMicroEurByKm(ratePerKm: MicroEur, km: MicroEur): MicroEur {
  return (ratePerKm * km) / MICRO_EUR_SCALE;
}

export function vehicleAdjustedOverageRateEur(
  baseRateEur: string | number,
  vehicleMultiplier: string | number,
): number {
  return microEurToNumber(
    multiplyMicroEurByKm(
      microEurFromDecimal(baseRateEur),
      microEurFromDecimal(vehicleMultiplier),
    ),
  );
}

export function minMicroEur(a: MicroEur, b: MicroEur): MicroEur {
  return a <= b ? a : b;
}

/** Half-up to 2 decimal places. Intermediates stay in micro-euros. */
export function roundMicroEurToCents(value: MicroEur): bigint {
  if (value >= BigInt(0)) {
    return (value + MICRO_PER_CENT / BigInt(2)) / MICRO_PER_CENT;
  }
  return -((-value + MICRO_PER_CENT / BigInt(2)) / MICRO_PER_CENT);
}

export function centsToNumber(cents: bigint): number {
  return Number(cents) / 100;
}

export function microEurToNumber(value: MicroEur): number {
  return centsToNumber(roundMicroEurToCents(value));
}

function decimalFromNumber(value: number): string {
  if (!Number.isFinite(value)) {
    throw new EuroParseError(String(value));
  }
  if (Number.isInteger(value)) {
    return String(value);
  }
  return value.toFixed(6).replace(/0+$/, "").replace(/\.$/, "");
}
