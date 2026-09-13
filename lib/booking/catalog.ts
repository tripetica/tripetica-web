import {
  type AirportCode,
  type AirportPreset,
  type DurationOption,
  type LocationValue,
  type TourOption,
} from "./types";
import { type Locale } from "@/lib/i18n/config";
import {
  HOURLY_CONTINENT_CROSSING_EUR,
  HOURLY_OVERRUN_HOUR_EUR,
  HOURLY_OVERRUN_KM_EUR,
} from "@/lib/booking/pricing/hourly-pricing";
import { formatRateDigits } from "@/lib/booking/pricing/format-eur";
import { vehicleAdjustedOverageRateEur } from "@/lib/booking/pricing/euro";

export const durationOptions: DurationOption[] = [
  { hours: 5, includedKm: 60 },
  { hours: 6, includedKm: 70 },
  { hours: 7, includedKm: 80 },
  { hours: 8, includedKm: 90 },
  { hours: 9, includedKm: 100 },
  { hours: 10, includedKm: 110 },
  { hours: 11, includedKm: 120 },
  { hours: 12, includedKm: 130 },
  { hours: 13, includedKm: 140 },
  { hours: 14, includedKm: 150 },
  { hours: 15, includedKm: 160 },
  { hours: 16, includedKm: 170 },
  { hours: 17, includedKm: 180 },
  { hours: 18, includedKm: 190 },
  { hours: 19, includedKm: 200 },
  { hours: 20, includedKm: 220 },
];

export function formatDurationOption(
  option: DurationOption,
  locale: Locale,
) {
  if (locale === "ru") {
    return `${option.hours} часов (${option.includedKm} км)`;
  }
  if (locale === "tr") {
    return `${option.hours} saat (${option.includedKm} km)`;
  }
  if (locale === "ar") {
    return `${option.hours} ساعات (${option.includedKm} كم)`;
  }
  return `${option.hours} Hours (${option.includedKm} km)`;
}

/** Formats stored duration hours with the same catalog labels as booking UI. */
export function formatDurationHours(
  hours: string | number | null | undefined,
  locale: Locale,
): string | null {
  if (hours === null || hours === undefined || hours === "") {
    return null;
  }
  const numeric = typeof hours === "number" ? hours : Number(hours);
  if (!Number.isFinite(numeric)) {
    return null;
  }
  const option = durationOptions.find((item) => item.hours === Math.round(numeric));
  if (!option) {
    return null;
  }
  return formatDurationOption(option, locale);
}

/** Package coverage line for hourly chauffeur cards / voucher (slash form). */
export function formatHourlyPackageCoverage(
  hours: string | number | null | undefined,
  locale: Locale,
): string | null {
  if (hours === null || hours === undefined || hours === "") {
    return null;
  }
  const numeric = typeof hours === "number" ? hours : Number(hours);
  if (!Number.isFinite(numeric)) {
    return null;
  }
  const option = durationOptions.find((item) => item.hours === Math.round(numeric));
  if (!option) {
    return null;
  }
  if (locale === "ru") {
    return `${option.hours} часов / ${option.includedKm} км`;
  }
  if (locale === "tr") {
    return `${option.hours} saat / ${option.includedKm} km`;
  }
  if (locale === "ar") {
    return `${option.hours} ساعات / ${option.includedKm} كم`;
  }
  return `${option.hours} hours / ${option.includedKm} km`;
}

export function formatHourlyVehicleTariffRows(
  hours: string | number | null | undefined,
  locale: Locale,
  vehicleMultiplier = 1,
): {
  packageCoverage: string;
  hourOverrun: string;
  kmOverrun: string;
  crossingFee: string;
} | null {
  const coverage = formatHourlyPackageCoverage(hours, locale);
  if (!coverage) {
    return null;
  }
  const hourOverrun = formatRateDigits(
    vehicleAdjustedOverageRateEur(HOURLY_OVERRUN_HOUR_EUR, vehicleMultiplier),
    locale,
  );
  const kmOverrun = formatRateDigits(
    vehicleAdjustedOverageRateEur(HOURLY_OVERRUN_KM_EUR, vehicleMultiplier),
    locale,
  );
  if (locale === "tr") {
    return {
      packageCoverage: `Paket kapsamı: ${coverage}`,
      hourOverrun: `Süre aşımı: +${hourOverrun} EUR / saat`,
      kmOverrun: `Kilometre aşımı: +${kmOverrun} EUR / km`,
      crossingFee: `Avrupa–Anadolu geçişi: +${HOURLY_CONTINENT_CROSSING_EUR} EUR`,
    };
  }
  if (locale === "ru") {
    return {
      packageCoverage: `Пакет включает: ${coverage}`,
      hourOverrun: `Превышение по времени: +${hourOverrun} EUR / час`,
      kmOverrun: `Превышение по километражу: +${kmOverrun} EUR / км`,
      crossingFee: `Переезд Европа–Азия: +${HOURLY_CONTINENT_CROSSING_EUR} EUR`,
    };
  }
  if (locale === "ar") {
    return {
      packageCoverage: `تغطية الباقة: ${coverage}`,
      hourOverrun: `تجاوز المدة: +${hourOverrun} EUR / ساعة`,
      kmOverrun: `تجاوز المسافة: +${kmOverrun} EUR / كم`,
      crossingFee: `عبور أوروبا–آسيا: +${HOURLY_CONTINENT_CROSSING_EUR} EUR`,
    };
  }
  return {
    packageCoverage: `Package coverage: ${coverage}`,
    hourOverrun: `Time overrun: +${hourOverrun} EUR / hour`,
    kmOverrun: `Distance overrun: +${kmOverrun} EUR / km`,
    crossingFee: `Europe–Asia crossing: +${HOURLY_CONTINENT_CROSSING_EUR} EUR`,
  };
}

export const hourlyVehicleTariffCopy: Record<
  Locale,
  {
    packageLabel: string;
    hourOverrun: string;
    kmOverrun: string;
    crossingFee: string;
    notice: string;
  }
> = {
  tr: {
    packageLabel: "Paket kapsamı",
    hourOverrun: "Süre aşımı: +15 EUR / saat",
    kmOverrun: "Kilometre aşımı: +0,50 EUR / km",
    crossingFee: "Avrupa–Anadolu geçişi: +15 EUR",
    notice:
      "Seçtiğiniz paket belirtilen süre ve kilometre kullanımını kapsar. Paket süresinin aşılması halinde +15 EUR/saat, paket kilometre sınırının aşılması halinde +0,50 EUR/km ek ücret uygulanır. Hizmet sırasında Avrupa Yakası ile Anadolu Yakası arasında geçiş yapılması halinde +15 EUR geçiş ücreti uygulanır. Ek kullanımlar hizmet sonunda gerçekleşen fiilî kullanıma göre ayrıca ücretlendirilir.",
  },
  en: {
    packageLabel: "Package coverage",
    hourOverrun: "Time overrun: +15 EUR / hour",
    kmOverrun: "Distance overrun: +0.50 EUR / km",
    crossingFee: "Europe–Asia crossing: +15 EUR",
    notice:
      "Your selected package covers the stated time and kilometre allowance. Time beyond the package is charged at +15 EUR/hour, and kilometres beyond the package limit at +0.50 EUR/km. A +15 EUR crossing fee applies if the service crosses between the European and Asian sides. Extra usage is billed separately based on actual usage at the end of the service.",
  },
  ru: {
    packageLabel: "Пакет включает",
    hourOverrun: "Превышение по времени: +15 EUR / час",
    kmOverrun: "Превышение по километражу: +0,50 EUR / км",
    crossingFee: "Переезд Европа–Азия: +15 EUR",
    notice:
      "Выбранный пакет включает указанное время и километраж. При превышении времени пакета взимается +15 EUR/час, при превышении лимита километров — +0,50 EUR/км. При переезде между европейской и азиатской сторонами во время услуги применяется сбор +15 EUR. Дополнительное использование оплачивается отдельно по фактическому использованию в конце услуги.",
  },
  ar: {
    packageLabel: "تغطية الباقة",
    hourOverrun: "تجاوز المدة: +15 EUR / ساعة",
    kmOverrun: "تجاوز المسافة: +0,50 EUR / كم",
    crossingFee: "عبور أوروبا–آسيا: +15 EUR",
    notice:
      "تغطي الباقة المختارة المدة والمسافة المذكورتين. يُحتسب تجاوز مدة الباقة بـ +15 EUR/ساعة، وتجاوز حد الكيلومترات بـ +0,50 EUR/كم. يُطبَّق رسم عبور +15 EUR إذا عبرت الخدمة بين الجانبين الأوروبي والآسيوي. تُحتسب الاستخدامات الإضافية بشكل منفصل وفق الاستخدام الفعلي في نهاية الخدمة.",
  },
};

/** Multiline overrun rules for hourly voucher PDF under package coverage. */
export function formatHourlyPackageOverrunNote(locale: Locale): string {
  const copy = hourlyVehicleTariffCopy[locale];
  return [
    copy.hourOverrun,
    copy.kmOverrun,
    copy.crossingFee,
    copy.notice,
  ].join("\n");
}

export const hourlyKmOverrunNote: Record<Locale, string> = {
  tr: hourlyVehicleTariffCopy.tr.kmOverrun,
  en: hourlyVehicleTariffCopy.en.kmOverrun,
  ru: hourlyVehicleTariffCopy.ru.kmOverrun,
  ar: hourlyVehicleTariffCopy.ar.kmOverrun,
};

export const tourOptions: TourOption[] = [
  { id: "istanbul-layover", behaviorType: "vehicleBooking" },
  { id: "istanbul-half-day", behaviorType: "vehicleBooking" },
  { id: "istanbul-full-day", behaviorType: "vehicleBooking" },
  { id: "sapanca", behaviorType: "vehicleBooking" },
  { id: "bursa", behaviorType: "vehicleBooking" },
  { id: "bosphorus-dinner", behaviorType: "perPersonBooking" },
  { id: "private-turkey-tours", behaviorType: "customQuote" },
];

/**
 * Canonical airport presets verified via Places API (New) Place Details.
 * Technical identity (placeId / lat / lng / airport_code) is locale-independent.
 * Localized display names stay in booking copy, not here.
 */
export const airportPresets: AirportPreset[] = [
  {
    id: "IST",
    airportCode: "IST",
    type: "airport",
    source: "preset",
    placeId: "ChIJqZW8Cvb_n0ARBuUkyCzgDDg",
    lat: 41.2761476,
    lng: 28.7287349,
    googleName: "Istanbul Airport",
    formattedAddress:
      "Tayakadın, Terminal Caddesi No:1, 34283 Arnavutköy/İstanbul, Türkiye",
    city: "İstanbul",
    district: "Arnavutköy",
    region: "İstanbul",
    country: "Türkiye",
  },
  {
    id: "SAW",
    airportCode: "SAW",
    type: "airport",
    source: "preset",
    placeId: "ChIJU6Ek9MvbyhQRdNqYgE3K76w",
    lat: 40.8944747,
    lng: 29.3130928,
    googleName: "Sabiha Gökçen International Airport",
    formattedAddress: "Sanayi, 34906 Pendik/İstanbul, Türkiye",
    city: "İstanbul",
    district: "Pendik",
    region: "İstanbul",
    country: "Türkiye",
  },
  {
    id: "AYT",
    airportCode: "AYT",
    type: "airport",
    source: "preset",
    placeId: "ChIJnXxhjXeEwxQR-uhI2_zcfME",
    lat: 36.9086961,
    lng: 30.7981855,
    googleName: "Antalya Airport",
    formattedAddress:
      "Yeşilköy, Antalya Havaalanı, 07230 Muratpaşa/Antalya, Türkiye",
    city: "Antalya",
    district: "Muratpaşa",
    region: "Antalya",
    country: "Türkiye",
  },
];

export function airportPresetByCode(code: AirportCode) {
  const preset = airportPresets.find((item) => item.id === code);
  if (!preset) {
    throw new Error(`Unknown airport preset: ${code}`);
  }
  return preset;
}

export function locationFromAirportPreset(
  preset: AirportPreset,
  label: string,
): LocationValue {
  return {
    source: "preset",
    name: label,
    formattedAddress: preset.formattedAddress,
    placeId: preset.placeId,
    lat: preset.lat,
    lng: preset.lng,
    city: preset.city,
    district: preset.district,
    region: preset.region,
    country: preset.country,
    countryCode: "TR",
    airportCode: preset.airportCode,
    type: "airport",
    placeTypes: ["airport"],
  };
}
