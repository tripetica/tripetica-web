import {
  MICRO_EUR_SCALE,
  microEurFromDecimal,
  microEurToNumber,
  type MicroEur,
} from "@/lib/booking/pricing/euro";
import { type DisplayCurrency } from "@/lib/booking/pricing/format-eur";
import { type FxQuoteCurrency } from "@/lib/booking/fx/types";

/** Fixed-point FX rate. 1.0 = 100_000_000. */
export const RATE_SCALE = BigInt(100_000_000);
const MICRO_PER_UNIT = MICRO_EUR_SCALE;

export class FxRateParseError extends Error {
  constructor(value: string) {
    super(`Invalid FX rate: ${value}`);
    this.name = "FxRateParseError";
  }
}

const RATE_PATTERN = /^(\d+)(?:\.(\d+))?$/;

export function parsePositiveRate(value: string | number): bigint {
  const text =
    typeof value === "number" ? rateFromNumber(value) : value.trim();
  const match = text.match(RATE_PATTERN);
  if (!match) {
    throw new FxRateParseError(text);
  }
  const whole = BigInt(match[1]);
  const frac = (match[2] ?? "").slice(0, 8);
  const fracPadded = `${frac}${"0".repeat(8 - frac.length)}`;
  const scaled = whole * RATE_SCALE + BigInt(fracPadded);
  if (scaled <= BigInt(0)) {
    throw new FxRateParseError(text);
  }
  return scaled;
}

export function rateScaledToString(scaled: bigint): string {
  if (scaled <= BigInt(0)) {
    throw new FxRateParseError(String(scaled));
  }
  const whole = scaled / RATE_SCALE;
  const frac = scaled % RATE_SCALE;
  if (frac === BigInt(0)) {
    return String(whole);
  }
  return `${whole}.${frac.toString().padStart(8, "0").replace(/0+$/, "")}`;
}

export function isPlausibleQuoteRate(
  quoteCurrency: FxQuoteCurrency,
  scaled: bigint,
): boolean {
  const minMax: Record<FxQuoteCurrency, readonly [bigint, bigint]> = {
    EUR: [RATE_SCALE, RATE_SCALE],
    USD: [parsePositiveRate("0.5"), parsePositiveRate("3")],
    GBP: [parsePositiveRate("0.3"), parsePositiveRate("2.5")],
    TRY: [parsePositiveRate("5"), parsePositiveRate("200")],
    RUB: [parsePositiveRate("20"), parsePositiveRate("1000")],
  };
  const [min, max] = minMax[quoteCurrency];
  return scaled >= min && scaled <= max;
}

export function convertMicroEur(
  microEur: MicroEur,
  rateScaled: bigint,
): bigint {
  if (rateScaled <= BigInt(0)) {
    throw new FxRateParseError("0");
  }
  return (microEur * rateScaled) / RATE_SCALE;
}

export function microAmountToPreciseString(micro: bigint): string {
  if (micro === BigInt(0)) {
    return "0";
  }
  const sign = micro < BigInt(0) ? "-" : "";
  const abs = micro < BigInt(0) ? -micro : micro;
  const whole = abs / MICRO_PER_UNIT;
  const frac = abs % MICRO_PER_UNIT;
  if (frac === BigInt(0)) {
    return `${sign}${whole}`;
  }
  return `${sign}${whole}.${frac.toString().padStart(6, "0").replace(/0+$/, "")}`;
}

/** Display rounding only. Engine values stay in micro units / precise strings. */
export function displayAmountFromMicro(
  micro: bigint,
  code: DisplayCurrency,
): number {
  if (code === "RUB") {
    if (micro >= BigInt(0)) {
      return Number((micro + MICRO_PER_UNIT / BigInt(2)) / MICRO_PER_UNIT);
    }
    return -Number((-micro + MICRO_PER_UNIT / BigInt(2)) / MICRO_PER_UNIT);
  }
  return microEurToNumber(micro);
}

export function microEurAmount(totalEur: string | number): MicroEur {
  if (typeof totalEur === "string" && !/^\d+(\.\d+)?$/.test(totalEur.trim())) {
    throw new FxRateParseError(totalEur);
  }
  return microEurFromDecimal(totalEur);
}

function rateFromNumber(value: number): string {
  if (!Number.isFinite(value) || value <= 0) {
    throw new FxRateParseError(String(value));
  }
  return value.toFixed(8).replace(/0+$/, "").replace(/\.$/, "");
}
