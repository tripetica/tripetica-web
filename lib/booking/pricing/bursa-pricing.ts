import {
  microEurFromDecimal,
  microEurToNumber,
} from "@/lib/booking/pricing/euro";
import {
  type LocationGeo,
  type TransferProvinceCode,
} from "@/lib/booking/pricing/location-codes";
import { type TransferPricingBreakdown } from "@/lib/booking/pricing/transfer-pricing";
import { TOUR_SERVICE_TYPE } from "@/lib/booking/pricing/layover-pricing";
import { type Locale } from "@/lib/i18n/config";

export const BURSA_TOUR_CODE = "bursa";
export const BURSA_PRICING_VERSION = "bursa.v1";
export const BURSA_PACKAGE_HOURS = 12;
export const BURSA_OVERRUN_HOUR_EUR = "15";
export const BURSA_BASE_EUR = 250;
export const BURSA_BRIDGE_ROUTE_SURCHARGE_EUR = 50;
export const BURSA_ULUDAG_ASCENT_SURCHARGE_EUR = 50;

export const BURSA_ROUTE_FERRY = "ferry";
export const BURSA_ROUTE_BRIDGE = "bridge";
export const BURSA_ROUTE_FERRY_ULUDAG = "ferry-uludag";
export const BURSA_ROUTE_BRIDGE_ULUDAG = "bridge-uludag";

export type BursaRouteOption =
  | typeof BURSA_ROUTE_FERRY
  | typeof BURSA_ROUTE_BRIDGE
  | typeof BURSA_ROUTE_FERRY_ULUDAG
  | typeof BURSA_ROUTE_BRIDGE_ULUDAG;

type BursaBaseRouteOption =
  | typeof BURSA_ROUTE_FERRY
  | typeof BURSA_ROUTE_BRIDGE;

export function isBursaTour(
  serviceType: string | null | undefined,
  tourCode: string | null | undefined,
): boolean {
  return (
    serviceType?.trim() === TOUR_SERVICE_TYPE &&
    tourCode?.trim() === BURSA_TOUR_CODE
  );
}

export function normalizeBursaRoute(
  value: string | null | undefined,
): BursaRouteOption {
  const normalized = value?.trim();
  if (
    normalized === BURSA_ROUTE_BRIDGE ||
    normalized === BURSA_ROUTE_FERRY_ULUDAG ||
    normalized === BURSA_ROUTE_BRIDGE_ULUDAG
  ) {
    return normalized;
  }
  return BURSA_ROUTE_FERRY;
}

export function isBursaBridgeRoute(
  value: string | null | undefined,
): boolean {
  const route = normalizeBursaRoute(value);
  return route === BURSA_ROUTE_BRIDGE || route === BURSA_ROUTE_BRIDGE_ULUDAG;
}

export function hasBursaUludagAscent(
  value: string | null | undefined,
): boolean {
  const route = normalizeBursaRoute(value);
  return route === BURSA_ROUTE_FERRY_ULUDAG || route === BURSA_ROUTE_BRIDGE_ULUDAG;
}

export function withBursaBridgeRoute(
  value: string | null | undefined,
  enabled: boolean,
): BursaRouteOption {
  const uludag = hasBursaUludagAscent(value);
  if (enabled) {
    return uludag ? BURSA_ROUTE_BRIDGE_ULUDAG : BURSA_ROUTE_BRIDGE;
  }
  return uludag ? BURSA_ROUTE_FERRY_ULUDAG : BURSA_ROUTE_FERRY;
}

export function withBursaUludagAscent(
  value: string | null | undefined,
  enabled: boolean,
): BursaRouteOption {
  const bridge = isBursaBridgeRoute(value);
  if (enabled) {
    return bridge ? BURSA_ROUTE_BRIDGE_ULUDAG : BURSA_ROUTE_FERRY_ULUDAG;
  }
  return bridge ? BURSA_ROUTE_BRIDGE : BURSA_ROUTE_FERRY;
}

const BURSA_ROUTE_LABELS: Record<Locale, Record<BursaBaseRouteOption, string>> = {
  tr: {
    ferry: "Normal yol + feribot",
    bridge: "Köprü + otoyol",
  },
  en: {
    ferry: "Normal road + ferry",
    bridge: "Bridge + motorway",
  },
  ru: {
    ferry: "Обычная дорога + паром",
    bridge: "Мост + автомагистраль",
  },
};

export function bursaRouteLabel(
  route: BursaRouteOption | string | null | undefined,
  locale: Locale,
): string {
  const baseRoute = isBursaBridgeRoute(route)
    ? BURSA_ROUTE_BRIDGE
    : BURSA_ROUTE_FERRY;
  return BURSA_ROUTE_LABELS[locale][baseRoute];
}

const BURSA_ULUDAG_LABELS: Record<Locale, string> = {
  tr: "Uludağ araçla çıkış",
  en: "Uludağ ascent by vehicle",
  ru: "Подъём на Улудаг на автомобиле",
};

export function bursaUludagLabel(locale: Locale): string {
  return BURSA_ULUDAG_LABELS[locale];
}

export function bursaPaidOptionLabels(locale: Locale): {
  bridge: string;
  uludag: string;
  bridgePrice: string;
  uludagPrice: string;
} {
  const uludag =
    locale === "tr"
      ? "Uludağ'a araçla çıkış"
      : locale === "en"
        ? "Uludağ ascent by vehicle"
        : "Подъём на Улудаг на автомобиле";
  return {
    bridge: bursaRouteLabel(BURSA_ROUTE_BRIDGE, locale),
    uludag,
    bridgePrice: `+${BURSA_BRIDGE_ROUTE_SURCHARGE_EUR} EUR`,
    uludagPrice: `+${BURSA_ULUDAG_ASCENT_SURCHARGE_EUR} EUR`,
  };
}

export function bursaRouteOptions(locale: Locale): Array<{
  id: BursaRouteOption;
  label: string;
  priceLabel: string;
}> {
  const includedLabel =
    locale === "ru"
      ? "Включено в стоимость"
      : locale === "tr"
        ? "Ücrete dahil"
        : "Included";
  return [
    {
      id: BURSA_ROUTE_FERRY,
      label: bursaRouteLabel(BURSA_ROUTE_FERRY, locale),
      priceLabel: includedLabel,
    },
    {
      id: BURSA_ROUTE_BRIDGE,
      label: bursaRouteLabel(BURSA_ROUTE_BRIDGE, locale),
      priceLabel: `+${BURSA_BRIDGE_ROUTE_SURCHARGE_EUR} EUR`,
    },
  ];
}

/** Flat base before vehicle multipliers. */
export function quoteBursaBase(
  pickup: LocationGeo,
  route: BursaRouteOption,
): TransferPricingBreakdown {
  const baseMicro = microEurFromDecimal(String(BURSA_BASE_EUR));
  const base = microEurToNumber(baseMicro);
  const emptyDropoffProvince: TransferProvinceCode = "other";
  const flatVehicleSurchargeEur =
    (isBursaBridgeRoute(route) ? BURSA_BRIDGE_ROUTE_SURCHARGE_EUR : 0) +
    (hasBursaUludagAscent(route) ? BURSA_ULUDAG_ASCENT_SURCHARGE_EUR : 0);

  return {
    openingFeeEur: base,
    distanceFeeEur: 0,
    locationSurchargeEur: 0,
    timeSurchargeEur: 0,
    baseTransferFeeEur: base,
    flatVehicleSurchargeEur,
    pricingVersion: BURSA_PRICING_VERSION,
    pickupProvinceCode: pickup.provinceCode,
    pickupDistrictCode: pickup.districtCode,
    dropoffProvinceCode: emptyDropoffProvince,
    dropoffDistrictCode: null,
  };
}
