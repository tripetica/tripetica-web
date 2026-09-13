import { bookingCopy } from "@/lib/booking/copy";
import {
  FULL_DAY_PACKAGE_HOURS,
  FULL_DAY_PACKAGE_KM,
  FULL_DAY_OVERRUN_HOUR_EUR,
  FULL_DAY_OVERRUN_KM_EUR,
  isFullDayTour,
} from "@/lib/booking/pricing/full-day-pricing";
import {
  HALF_DAY_PACKAGE_HOURS,
  HALF_DAY_PACKAGE_KM,
  HALF_DAY_OVERRUN_HOUR_EUR,
  HALF_DAY_OVERRUN_KM_EUR,
  isHalfDayTour,
} from "@/lib/booking/pricing/half-day-pricing";
import {
  LAYOVER_PACKAGE_HOURS,
  LAYOVER_PACKAGE_KM,
  LAYOVER_OVERRUN_HOUR_EUR,
  LAYOVER_OVERRUN_KM_EUR,
  isLayoverTour,
} from "@/lib/booking/pricing/layover-pricing";
import {
  isSapancaTour,
  SAPANCA_PACKAGE_HOURS,
  SAPANCA_OVERRUN_HOUR_EUR,
} from "@/lib/booking/pricing/sapanca-pricing";
import {
  bursaRouteLabel,
  bursaUludagLabel,
  hasBursaUludagAscent,
  isBursaTour,
  normalizeBursaRoute,
  type BursaRouteOption,
  BURSA_BRIDGE_ROUTE_SURCHARGE_EUR,
  BURSA_PACKAGE_HOURS,
  BURSA_OVERRUN_HOUR_EUR,
  BURSA_ULUDAG_ASCENT_SURCHARGE_EUR,
} from "@/lib/booking/pricing/bursa-pricing";
import { type Locale } from "@/lib/i18n/config";
import { type ServiceType, type TourId } from "@/lib/booking/types";
import { formatRateDigits } from "@/lib/booking/pricing/format-eur";
import { vehicleAdjustedOverageRateEur } from "@/lib/booking/pricing/euro";

export function localizedTourName(
  tourCode: string | null | undefined,
  locale: Locale,
): string | null {
  const id = tourCode?.trim() as TourId | undefined;
  if (!id || !(id in bookingCopy[locale].tours)) {
    return null;
  }
  return bookingCopy[locale].tours[id];
}

/** User-facing service type: tour name when a tour is selected, otherwise the service tab label. */
export function bookingServiceDisplayLabel(
  serviceType: string | null | undefined,
  tourCode: string | null | undefined,
  locale: Locale,
): string {
  const tourName = localizedTourName(tourCode, locale);
  if (serviceType?.trim() === "tour" && tourName) {
    return tourName;
  }
  const raw = serviceType?.trim();
  if (raw === "transfer" || raw === "hourly" || raw === "tour") {
    return bookingCopy[locale].services[raw as ServiceType];
  }
  return raw || "—";
}

export function formatLayoverPackageCoverage(locale: Locale): string {
  if (locale === "ru") {
    return `${LAYOVER_PACKAGE_HOURS} часов / ${LAYOVER_PACKAGE_KM} км`;
  }
  if (locale === "tr") {
    return `${LAYOVER_PACKAGE_HOURS} saat / ${LAYOVER_PACKAGE_KM} km`;
  }
  if (locale === "ar") {
    return `${LAYOVER_PACKAGE_HOURS} ساعات / ${LAYOVER_PACKAGE_KM} كم`;
  }
  return `${LAYOVER_PACKAGE_HOURS} hours / ${LAYOVER_PACKAGE_KM} km`;
}

export const layoverUsageOverrunNote: Record<Locale, string> = {
  tr: "7 saati aşan kullanım için +15 € / saat, 120 km'yi aşan kullanım için +0,50 € / km ek ücret uygulanır.",
  en: "Usage beyond 7 hours is charged at +€15/hour; usage beyond 120 km at +€0.50/km.",
  ru: "За использование свыше 7 часов взимается +15 €/час; за пробег свыше 120 км — +0,50 €/км.",
  ar: "يُطبَّق رسم +15 € / ساعة عند تجاوز 7 ساعات، و+0,50 € / كم عند تجاوز 120 كم.",
};

export const layoverVehicleTariffCopy: Record<
  Locale,
  { packageLabel: string; hourOverrun: string; kmOverrun: string }
> = {
  tr: {
    packageLabel: "Paket kapsamı",
    hourOverrun: "Süre aşımı: +15 EUR / saat",
    kmOverrun: "Kilometre aşımı: +0,50 EUR / km",
  },
  en: {
    packageLabel: "Package coverage",
    hourOverrun: "Time overrun: +€15 / hour",
    kmOverrun: "Distance overrun: +€0.50 / km",
  },
  ru: {
    packageLabel: "Пакет включает",
    hourOverrun: "Превышение по времени: +15 EUR / час",
    kmOverrun: "Превышение по км: +0,50 EUR / км",
  },
  ar: {
    packageLabel: "تغطية الباقة",
    hourOverrun: "تجاوز المدة: +15 EUR / ساعة",
    kmOverrun: "تجاوز المسافة: +0,50 EUR / كم",
  },
};

export function isLayoverTourDraft(
  serviceType: string | null | undefined,
  tourCode: string | null | undefined,
): boolean {
  return isLayoverTour(serviceType, tourCode);
}

export function formatHalfDayPackageCoverage(locale: Locale): string {
  if (locale === "ru") {
    return `${HALF_DAY_PACKAGE_HOURS} часов / ${HALF_DAY_PACKAGE_KM} км`;
  }
  if (locale === "tr") {
    return `${HALF_DAY_PACKAGE_HOURS} saat / ${HALF_DAY_PACKAGE_KM} km`;
  }
  if (locale === "ar") {
    return `${HALF_DAY_PACKAGE_HOURS} ساعات / ${HALF_DAY_PACKAGE_KM} كم`;
  }
  return `${HALF_DAY_PACKAGE_HOURS} hours / ${HALF_DAY_PACKAGE_KM} km`;
}

export function formatFullDayPackageCoverage(locale: Locale): string {
  if (locale === "ru") {
    return `${FULL_DAY_PACKAGE_HOURS} часов / ${FULL_DAY_PACKAGE_KM} км`;
  }
  if (locale === "tr") {
    return `${FULL_DAY_PACKAGE_HOURS} saat / ${FULL_DAY_PACKAGE_KM} km`;
  }
  if (locale === "ar") {
    return `${FULL_DAY_PACKAGE_HOURS} ساعات / ${FULL_DAY_PACKAGE_KM} كم`;
  }
  return `${FULL_DAY_PACKAGE_HOURS} hours / ${FULL_DAY_PACKAGE_KM} km`;
}

export function formatSapancaPackageCoverage(locale: Locale): string {
  if (locale === "ru") {
    return `${SAPANCA_PACKAGE_HOURS} часов`;
  }
  if (locale === "tr") {
    return `${SAPANCA_PACKAGE_HOURS} saat`;
  }
  if (locale === "ar") {
    return `${SAPANCA_PACKAGE_HOURS} ساعات`;
  }
  return `${SAPANCA_PACKAGE_HOURS} hours`;
}

export function formatBursaPackageCoverage(
  locale: Locale,
  route?: BursaRouteOption | string | null,
): string {
  const normalizedRoute = normalizeBursaRoute(route);
  const routeLabel = bursaRouteLabel(normalizedRoute, locale);
  const uludag = hasBursaUludagAscent(normalizedRoute)
    ? ` · ${bursaUludagLabel(locale)}`
    : "";
  if (locale === "ru") {
    return `${BURSA_PACKAGE_HOURS} часов · ${routeLabel}${uludag}`;
  }
  if (locale === "tr") {
    return `${BURSA_PACKAGE_HOURS} saat · ${routeLabel}${uludag}`;
  }
  if (locale === "ar") {
    return `${BURSA_PACKAGE_HOURS} ساعات · ${routeLabel}${uludag}`;
  }
  return `${BURSA_PACKAGE_HOURS} hours · ${routeLabel}${uludag}`;
}

export function formatPackageCoverageForTour(
  tourCode: string | null | undefined,
  locale: Locale,
  options?: { bursaRoute?: BursaRouteOption | string | null },
): string | null {
  if (isLayoverTour("tour", tourCode)) {
    return formatLayoverPackageCoverage(locale);
  }
  if (isHalfDayTour("tour", tourCode)) {
    return formatHalfDayPackageCoverage(locale);
  }
  if (isFullDayTour("tour", tourCode)) {
    return formatFullDayPackageCoverage(locale);
  }
  if (isSapancaTour("tour", tourCode)) {
    return formatSapancaPackageCoverage(locale);
  }
  if (isBursaTour("tour", tourCode)) {
    return formatBursaPackageCoverage(locale, options?.bursaRoute);
  }
  return null;
}

export const halfDayUsageOverrunNote: Record<Locale, string> = {
  tr: "Paket kapsamı 6 saat ve 70 km ile sınırlıdır. Paket sınırının aşılması halinde her ilave saat için €15, her ilave kilometre için €0,50 ek ücret uygulanır. Avrupa ve Anadolu yakaları arasında geçiş yapılması halinde €15 ek ücret uygulanır.",
  en: "The package is limited to 6 hours and 70 km. If the package limits are exceeded, each additional hour is charged at €15 and each additional kilometre at €0.50. A €15 surcharge applies when the tour crosses between the European and Asian sides of Istanbul.",
  ru: "Пакет ограничен 6 часами и 70 км. При превышении лимитов пакета каждый дополнительный час оплачивается по €15, каждый дополнительный километр — по €0,50. При переезде между европейской и азиатской частями Стамбула взимается доплата €15.",
  ar: "الباقة محدودة بـ 6 ساعات و70 كم. عند تجاوز حدود الباقة تُحتسب كل ساعة إضافية بـ 15 € وكل كيلومتر إضافي بـ 0,50 €. يُطبَّق رسم إضافي 15 € عند عبور الجولة بين الجانبين الأوروبي والآسيوي في إسطنبول.",
};

export const halfDayVehicleTariffCopy: Record<
  Locale,
  { packageLabel: string; hourOverrun: string; kmOverrun: string; crossingFee: string }
> = {
  tr: {
    packageLabel: "Paket kapsamı",
    hourOverrun: "Süre aşımı: +15 EUR / saat",
    kmOverrun: "Kilometre aşımı: +0,50 EUR / km",
    crossingFee: "Avrupa–Anadolu geçişi: +15 EUR",
  },
  en: {
    packageLabel: "Package coverage",
    hourOverrun: "Time overrun: +€15 / hour",
    kmOverrun: "Distance overrun: +€0.50 / km",
    crossingFee: "Europe–Asia crossing: +€15",
  },
  ru: {
    packageLabel: "Пакет включает",
    hourOverrun: "Превышение по времени: +15 EUR / час",
    kmOverrun: "Превышение по км: +0,50 EUR / км",
    crossingFee: "Переезд Европа–Азия: +15 EUR",
  },
  ar: {
    packageLabel: "تغطية الباقة",
    hourOverrun: "تجاوز المدة: +15 EUR / ساعة",
    kmOverrun: "تجاوز المسافة: +0,50 EUR / كم",
    crossingFee: "عبور أوروبا–آسيا: +15 EUR",
  },
};

export const fullDayUsageOverrunNote: Record<Locale, string> = {
  tr: "Paket kapsamı 10 saat ve 110 km ile sınırlıdır. Paket sınırının aşılması halinde her ilave saat için €15, her ilave kilometre için €0,50 ek ücret uygulanır. Avrupa ve Anadolu yakaları arasında geçiş yapılması halinde €15 ek ücret uygulanır.",
  en: "The package is limited to 10 hours and 110 km. If the package limits are exceeded, each additional hour is charged at €15 and each additional kilometre at €0.50. A €15 surcharge applies when the tour crosses between the European and Asian sides of Istanbul.",
  ru: "Пакет ограничен 10 часами и 110 км. При превышении лимитов пакета каждый дополнительный час оплачивается по €15, каждый дополнительный километр — по €0,50. При переезде между европейской и азиатской частями Стамбула взимается доплата €15.",
  ar: "الباقة محدودة بـ 10 ساعات و110 كم. عند تجاوز حدود الباقة تُحتسب كل ساعة إضافية بـ 15 € وكل كيلومتر إضافي بـ 0,50 €. يُطبَّق رسم إضافي 15 € عند عبور الجولة بين الجانبين الأوروبي والآسيوي في إسطنبول.",
};

export const fullDayVehicleTariffCopy: Record<
  Locale,
  { packageLabel: string; hourOverrun: string; kmOverrun: string; crossingFee: string }
> = {
  tr: {
    packageLabel: "Paket kapsamı",
    hourOverrun: "Süre aşımı: +15 EUR / saat",
    kmOverrun: "Kilometre aşımı: +0,50 EUR / km",
    crossingFee: "Avrupa–Anadolu geçişi: +15 EUR",
  },
  en: {
    packageLabel: "Package coverage",
    hourOverrun: "Time overrun: +€15 / hour",
    kmOverrun: "Distance overrun: +€0.50 / km",
    crossingFee: "Europe–Asia crossing: +€15",
  },
  ru: {
    packageLabel: "Пакет включает",
    hourOverrun: "Превышение по времени: +15 EUR / час",
    kmOverrun: "Превышение по км: +0,50 EUR / км",
    crossingFee: "Переезд Европа–Азия: +15 EUR",
  },
  ar: {
    packageLabel: "تغطية الباقة",
    hourOverrun: "تجاوز المدة: +15 EUR / ساعة",
    kmOverrun: "تجاوز المسافة: +0,50 EUR / كم",
    crossingFee: "عبور أوروبا–آسيا: +15 EUR",
  },
};

export const sapancaUsageOverrunNote: Record<Locale, string> = {
  tr: "Paket kapsamı 11 saate kadardır. Süre aşımında her ilave saat için 15,00 € ek ücret uygulanır.",
  en: "The package covers up to 11 hours. Each additional hour beyond that is charged at €15.00.",
  ru: "Пакет рассчитан на 11 часов. Каждый дополнительный час сверх этого оплачивается по 15,00 €.",
  ar: "تغطي الباقة حتى 11 ساعة. تُحتسب كل ساعة إضافية بعد ذلك بـ 15,00 €.",
};

export const sapancaVehicleTariffCopy: Record<
  Locale,
  { packageLabel: string; hourOverrun: string }
> = {
  tr: {
    packageLabel: "Paket kapsamı",
    hourOverrun: "Süre aşımı: +15 EUR / saat",
  },
  en: {
    packageLabel: "Package coverage",
    hourOverrun: "Time overrun: +€15 / hour",
  },
  ru: {
    packageLabel: "Пакет включает",
    hourOverrun: "Превышение по времени: +15 EUR / час",
  },
  ar: {
    packageLabel: "تغطية الباقة",
    hourOverrun: "تجاوز المدة: +15 EUR / ساعة",
  },
};

export const bursaUsageOverrunNote: Record<Locale, string> = {
  tr: "Paket kapsamı 12 saate kadardır. Süre aşımında her ilave saat için 15,00 € ek ücret uygulanır.",
  en: "The package covers up to 12 hours. Each additional hour beyond that is charged at €15.00.",
  ru: "Пакет рассчитан на 12 часов. Каждый дополнительный час сверх этого оплачивается по 15,00 €.",
  ar: "تغطي الباقة حتى 12 ساعة. تُحتسب كل ساعة إضافية بعد ذلك بـ 15,00 €.",
};

export const bursaVehicleTariffCopy: Record<
  Locale,
  {
    packageLabel: string;
    hourOverrun: string;
    bridgeRouteSurcharge: string;
    uludagVehicleAscent: string;
  }
> = {
  tr: {
    packageLabel: "Paket kapsamı",
    hourOverrun: "Süre aşımı: +15 EUR / saat",
    bridgeRouteSurcharge: `Köprü + otoyol tercihi: +${BURSA_BRIDGE_ROUTE_SURCHARGE_EUR} EUR`,
    uludagVehicleAscent: `Uludağ araçla çıkış: +${BURSA_ULUDAG_ASCENT_SURCHARGE_EUR} EUR`,
  },
  en: {
    packageLabel: "Package coverage",
    hourOverrun: "Time overrun: +€15 / hour",
    bridgeRouteSurcharge: `Bridge + motorway option: +${BURSA_BRIDGE_ROUTE_SURCHARGE_EUR} EUR`,
    uludagVehicleAscent: `Uludağ ascent by vehicle: +${BURSA_ULUDAG_ASCENT_SURCHARGE_EUR} EUR`,
  },
  ru: {
    packageLabel: "Пакет включает",
    hourOverrun: "Превышение по времени: +15 EUR / час",
    bridgeRouteSurcharge: `Мост + автомагистраль: +${BURSA_BRIDGE_ROUTE_SURCHARGE_EUR} EUR`,
    uludagVehicleAscent: `Подъём на Улудаг на автомобиле: +${BURSA_ULUDAG_ASCENT_SURCHARGE_EUR} EUR`,
  },
  ar: {
    packageLabel: "تغطية الباقة",
    hourOverrun: "تجاوز المدة: +15 EUR / ساعة",
    bridgeRouteSurcharge: `خيار الجسر والطريق السريع: +${BURSA_BRIDGE_ROUTE_SURCHARGE_EUR} EUR`,
    uludagVehicleAscent: `الصعود إلى أولوداغ بالمركبة: +${BURSA_ULUDAG_ASCENT_SURCHARGE_EUR} EUR`,
  },
};

export type PackageTourVehicleTariffCopy = {
  packageLabel: string;
  hourOverrun: string;
  kmOverrun?: string;
  crossingFee?: string;
  bridgeRouteSurcharge?: string;
  uludagVehicleAscent?: string;
};

const overrunRateCopy: Record<
  Locale,
  { hourLabel: string; kmLabel: string; hourUnit: string; kmUnit: string }
> = {
  tr: {
    hourLabel: "Süre aşımı",
    kmLabel: "Kilometre aşımı",
    hourUnit: "saat",
    kmUnit: "km",
  },
  en: {
    hourLabel: "Time overrun",
    kmLabel: "Distance overrun",
    hourUnit: "hour",
    kmUnit: "km",
  },
  ru: {
    hourLabel: "Превышение по времени",
    kmLabel: "Превышение по км",
    hourUnit: "час",
    kmUnit: "км",
  },
  ar: {
    hourLabel: "تجاوز المدة",
    kmLabel: "تجاوز المسافة",
    hourUnit: "ساعة",
    kmUnit: "كم",
  },
};

function withVehicleAdjustedOverrunRates(
  copy: PackageTourVehicleTariffCopy,
  locale: Locale,
  vehicleMultiplier: number,
  baseHourRateEur: string | number,
  baseKmRateEur?: string | number,
): PackageTourVehicleTariffCopy {
  const labels = overrunRateCopy[locale];
  const hourRate = formatRateDigits(
    vehicleAdjustedOverageRateEur(baseHourRateEur, vehicleMultiplier),
    locale,
  );
  const kmRate =
    baseKmRateEur === undefined
      ? null
      : formatRateDigits(
          vehicleAdjustedOverageRateEur(baseKmRateEur, vehicleMultiplier),
          locale,
        );
  return {
    ...copy,
    hourOverrun: `${labels.hourLabel}: +${hourRate} EUR / ${labels.hourUnit}`,
    ...(kmRate
      ? { kmOverrun: `${labels.kmLabel}: +${kmRate} EUR / ${labels.kmUnit}` }
      : {}),
  };
}

export function layoverVehicleTariffCopyForVehicle(
  locale: Locale,
  vehicleMultiplier: number,
): PackageTourVehicleTariffCopy {
  return withVehicleAdjustedOverrunRates(
    layoverVehicleTariffCopy[locale],
    locale,
    vehicleMultiplier,
    LAYOVER_OVERRUN_HOUR_EUR,
    LAYOVER_OVERRUN_KM_EUR,
  );
}

/** Informational Uludağ ascent fee for Bursa vouchers — not added to totals. */
export function bursaUludagFeeNote(
  tourCode: string | null | undefined,
  locale: Locale,
  route?: BursaRouteOption | string | null,
): string | null {
  if (!isBursaTour("tour", tourCode) || !hasBursaUludagAscent(route)) {
    return null;
  }
  return bursaVehicleTariffCopy[locale].uludagVehicleAscent;
}

export function packageTourVehicleTariffCopy(
  tourCode: string | null | undefined,
  locale: Locale,
  vehicleMultiplier = 1,
): PackageTourVehicleTariffCopy | null {
  if (isSapancaTour("tour", tourCode)) {
    return withVehicleAdjustedOverrunRates(
      sapancaVehicleTariffCopy[locale],
      locale,
      vehicleMultiplier,
      SAPANCA_OVERRUN_HOUR_EUR,
    );
  }
  if (isBursaTour("tour", tourCode)) {
    return withVehicleAdjustedOverrunRates(
      bursaVehicleTariffCopy[locale],
      locale,
      vehicleMultiplier,
      BURSA_OVERRUN_HOUR_EUR,
    );
  }
  if (isHalfDayTour("tour", tourCode)) {
    return withVehicleAdjustedOverrunRates(
      halfDayVehicleTariffCopy[locale],
      locale,
      vehicleMultiplier,
      HALF_DAY_OVERRUN_HOUR_EUR,
      HALF_DAY_OVERRUN_KM_EUR,
    );
  }
  if (isFullDayTour("tour", tourCode)) {
    return withVehicleAdjustedOverrunRates(
      fullDayVehicleTariffCopy[locale],
      locale,
      vehicleMultiplier,
      FULL_DAY_OVERRUN_HOUR_EUR,
      FULL_DAY_OVERRUN_KM_EUR,
    );
  }
  return null;
}

export function packageOverrunNoteForTour(
  tourCode: string | null | undefined,
  locale: Locale,
): string | null {
  if (isLayoverTour("tour", tourCode)) {
    return layoverUsageOverrunNote[locale];
  }
  if (isHalfDayTour("tour", tourCode)) {
    return halfDayUsageOverrunNote[locale];
  }
  if (isFullDayTour("tour", tourCode)) {
    return fullDayUsageOverrunNote[locale];
  }
  if (isSapancaTour("tour", tourCode)) {
    return sapancaUsageOverrunNote[locale];
  }
  if (isBursaTour("tour", tourCode)) {
    return bursaUsageOverrunNote[locale];
  }
  return null;
}

export function isIstanbulAddressPackageTourDraft(
  serviceType: string | null | undefined,
  tourCode: string | null | undefined,
): boolean {
  return isHalfDayTour(serviceType, tourCode) || isFullDayTour(serviceType, tourCode);
}

export function isSapancaTourDraft(
  serviceType: string | null | undefined,
  tourCode: string | null | undefined,
): boolean {
  return isSapancaTour(serviceType, tourCode);
}

export function isBursaTourDraft(
  serviceType: string | null | undefined,
  tourCode: string | null | undefined,
): boolean {
  return isBursaTour(serviceType, tourCode);
}
