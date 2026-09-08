import {
  formatHourlyPackageCoverage,
  formatHourlyVehicleTariffRows,
} from "@/lib/booking/catalog";
import { bosphorusDinnerCopy } from "@/lib/booking/bosphorus-dinner-copy";
import { isBosphorusDinnerTour } from "@/lib/booking/pricing/bosphorus-dinner-pricing";
import { isLayoverTour } from "@/lib/booking/pricing/layover-pricing";
import { vehicleMultiplierForCode } from "@/lib/booking/pricing/vehicle-quote";
import {
  formatPackageCoverageForTour,
  layoverVehicleTariffCopyForVehicle,
  packageTourVehicleTariffCopy,
} from "@/lib/booking/tour-display";
import { vehicleCardCopyFor } from "@/lib/booking/vehicles/copy";
import { type Locale, locales } from "@/lib/i18n/config";

export type ReservationServiceContent = {
  vehicleSubtitle?: string | null;
  packageCoverage: string | null;
  packageNotes: string[];
  includedSectionTitle: string | null;
  includedItems: string[];
  serviceInfoSectionTitle: string | null;
  serviceInfoGroups: Array<{ title: string; body: string }>;
};

export type ReservationServiceSnapshot = {
  version: 1;
  locales: Record<Locale, ReservationServiceContent>;
};

type SnapshotInput = {
  serviceType: string | null | undefined;
  tourCode: string | null | undefined;
  durationHours: string | number | null | undefined;
  bursaRoute: string | null | undefined;
  vehicleCode: string | null | undefined;
};

function contentForLocale(
  input: SnapshotInput,
  locale: Locale,
): ReservationServiceContent {
  const vehicleSubtitle = input.vehicleCode
    ? vehicleCardCopyFor(input.vehicleCode, locale).example
    : null;
  if (isBosphorusDinnerTour(input.serviceType, input.tourCode)) {
    const copy = bosphorusDinnerCopy[locale];
    return {
      vehicleSubtitle,
      packageCoverage: null,
      packageNotes: [],
      includedSectionTitle: copy.voucherIncludedSectionTitle,
      includedItems: [...copy.included, copy.durationNotice],
      serviceInfoSectionTitle: copy.voucherServiceInfoSectionTitle,
      serviceInfoGroups: copy.serviceInfoGroups.map((group, index) => ({
        ...group,
        body: index === 0 ? copy.voucherPickupInfoBody : group.body,
      })),
    };
  }

  const multiplier = vehicleMultiplierForCode(input.vehicleCode);
  if (input.serviceType?.trim() === "hourly") {
    const tariff = formatHourlyVehicleTariffRows(
      input.durationHours,
      locale,
      multiplier,
    );
    return {
      vehicleSubtitle,
      packageCoverage: formatHourlyPackageCoverage(input.durationHours, locale),
      packageNotes: tariff
        ? [tariff.hourOverrun, tariff.kmOverrun, tariff.crossingFee]
        : [],
      includedSectionTitle: null,
      includedItems: [],
      serviceInfoSectionTitle: null,
      serviceInfoGroups: [],
    };
  }

  const tariff = isLayoverTour(input.serviceType, input.tourCode)
    ? layoverVehicleTariffCopyForVehicle(locale, multiplier)
    : packageTourVehicleTariffCopy(input.tourCode, locale, multiplier);
  return {
    vehicleSubtitle,
    packageCoverage: formatPackageCoverageForTour(input.tourCode, locale, {
      bursaRoute: input.bursaRoute,
    }),
    packageNotes: tariff
      ? [tariff.hourOverrun, tariff.kmOverrun, tariff.crossingFee].filter(
          (item): item is string => Boolean(item),
        )
      : [],
    includedSectionTitle: null,
    includedItems: [],
    serviceInfoSectionTitle: null,
    serviceInfoGroups: [],
  };
}

export function buildReservationServiceSnapshot(
  input: SnapshotInput,
): ReservationServiceSnapshot {
  return {
    version: 1,
    locales: Object.fromEntries(
      locales.map((locale) => [locale, contentForLocale(input, locale)]),
    ) as Record<Locale, ReservationServiceContent>,
  };
}

export function parseReservationServiceSnapshot(
  value: unknown,
): ReservationServiceSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<ReservationServiceSnapshot>;
  if (candidate.version !== 1 || !candidate.locales) return null;
  for (const locale of locales) {
    const content = candidate.locales[locale];
    if (
      !content ||
      !Array.isArray(content.packageNotes) ||
      !Array.isArray(content.includedItems) ||
      !Array.isArray(content.serviceInfoGroups)
    ) {
      return null;
    }
  }
  return candidate as ReservationServiceSnapshot;
}

