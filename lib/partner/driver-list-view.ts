import {
  formatPartnerFleetPhone,
  type PartnerDriverRecord,
  type PartnerVehicleRecord,
} from "@/lib/partner/fleet-view";

export type DriverNameSortDir = "asc" | "desc";

const DRIVER_LIST_LOCALE = "tr";

export function nextDriverNameSortDir(current: DriverNameSortDir): DriverNameSortDir {
  return current === "asc" ? "desc" : "asc";
}

export function compareDriverFullName(
  left: string,
  right: string,
  dir: DriverNameSortDir = "asc",
): number {
  const cmp = left.localeCompare(right, DRIVER_LIST_LOCALE, { sensitivity: "base" });
  return dir === "asc" ? cmp : -cmp;
}

export function foldDriverSearchText(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase(DRIVER_LIST_LOCALE)
    .replaceAll("ı", "i")
    .replaceAll("ğ", "g")
    .replaceAll("ü", "u")
    .replaceAll("ş", "s")
    .replaceAll("ö", "o")
    .replaceAll("ç", "c");
}

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

export function driverMatchesSearch(
  driver: Pick<PartnerDriverRecord, "fullName" | "phone"> & {
    partnerName?: string | null;
  },
  query: string,
): boolean {
  const raw = query.trim();
  if (!raw) {
    return true;
  }

  const foldedQuery = foldDriverSearchText(raw);
  if (foldDriverSearchText(driver.fullName).includes(foldedQuery)) {
    return true;
  }
  if (driver.partnerName && foldDriverSearchText(driver.partnerName).includes(foldedQuery)) {
    return true;
  }

  const phone = driver.phone ?? "";
  const formatted = formatPartnerFleetPhone(driver.phone);
  const foldedPhone = foldDriverSearchText(`${phone} ${formatted}`);
  if (foldedPhone.includes(foldedQuery)) {
    return true;
  }

  const queryDigits = digitsOnly(raw);
  return queryDigits.length > 0 && digitsOnly(phone).includes(queryDigits);
}

export function vehicleMatchesSearch(
  vehicle: Pick<PartnerVehicleRecord, "plate" | "brand" | "model"> & {
    partnerName?: string | null;
  },
  query: string,
): boolean {
  const raw = query.trim();
  if (!raw) {
    return true;
  }
  const haystack = foldDriverSearchText(
    [vehicle.plate, vehicle.brand, vehicle.model, vehicle.partnerName]
      .filter(Boolean)
      .join(" "),
  );
  return haystack.includes(foldDriverSearchText(raw));
}

export function filterPartnerVehicles<
  T extends Pick<PartnerVehicleRecord, "plate" | "brand" | "model">,
>(vehicles: readonly T[], query: string): T[] {
  return vehicles.filter((vehicle) => vehicleMatchesSearch(vehicle, query));
}

export function filterAndSortPartnerDrivers<T extends Pick<PartnerDriverRecord, "fullName" | "phone">>(
  drivers: readonly T[],
  query: string,
  dir: DriverNameSortDir = "asc",
): T[] {
  return drivers
    .filter((driver) => driverMatchesSearch(driver, query))
    .slice()
    .sort((left, right) => compareDriverFullName(left.fullName, right.fullName, dir));
}
