export type FleetChoice = {
  id: string;
  label: string;
};

export type AuthorityChoice = {
  id: string;
  partnerId: string;
  label: string;
  companyIds: string[];
};

export type FleetChoicesByPartner = Record<
  string,
  {
    vehicles: FleetChoice[];
    drivers: FleetChoice[];
    authorities: AuthorityChoice[];
  }
>;

export function fleetChoicesForPartner(choices: FleetChoicesByPartner, partnerId: string) {
  return choices[partnerId] ?? { vehicles: [], drivers: [], authorities: [] };
}

export function companyChoicesForRow(
  companies: readonly { id: string; shortName: string }[],
  current: { id: string; shortName: string } | null | undefined,
): FleetChoice[] {
  const options = companies.map((company) => ({ id: company.id, label: company.shortName }));
  if (current && !options.some((option) => option.id === current.id)) {
    options.unshift({ id: current.id, label: current.shortName });
  }
  return options;
}

export function authoritiesForCompany<T extends { companyIds: readonly string[] }>(
  authorities: readonly T[],
  companyId: string,
): T[] {
  if (!companyId) {
    return [...authorities];
  }
  return authorities.filter((item) => item.companyIds.includes(companyId));
}

export function allowedAuthorityIds(
  driver: { partnerId?: string; uetdsCompanyId?: string | null } | null | undefined,
  authorities: readonly AuthorityChoice[],
): string[] {
  if (!driver?.partnerId) {
    return [];
  }
  return authoritiesForCompany(
    authorities.filter((item) => item.partnerId === driver.partnerId),
    driver.uetdsCompanyId ?? "",
  ).map((item) => item.id);
}

export function showGoldAuthorityField(membershipStatus?: string | null) {
  return membershipStatus === "gold";
}

export function initialVehicleForSelectedDriver<T extends { driverId: string; vehicleId: string }>(
  draft: T,
  requestedVehicleId: string,
  defaultVehicleId: string | null | undefined,
  vehicleIds: readonly string[],
): T {
  if (requestedVehicleId) {
    return draft;
  }
  return applyDriverVehicleDefault(
    { ...draft, driverId: "" },
    draft.driverId,
    defaultVehicleId,
    vehicleIds,
  );
}

export function applyDriverVehicleDefault<T extends { driverId: string; vehicleId: string }>(
  current: T,
  nextDriverId: string,
  defaultVehicleId: string | null | undefined,
  vehicleIds: readonly string[],
): T {
  if (nextDriverId === current.driverId) {
    return current;
  }
  const preferred = defaultVehicleId ?? "";
  return {
    ...current,
    driverId: nextDriverId,
    vehicleId: preferred && vehicleIds.includes(preferred) ? preferred : current.vehicleId,
  };
}

/** Yeni Bildirim / AI düzenleme: bağlı aktif yetkiliyi Gold şartı olmadan getir. */
export function authorityForNotificationForm(input: {
  previousDriverId: string;
  nextDriverId: string;
  currentAuthorityId: string;
  defaultAuthorityId?: string | null;
  allowedAuthorityIds: readonly string[];
}): string {
  const allowed = new Set(input.allowedAuthorityIds);
  if (input.nextDriverId && input.nextDriverId === input.previousDriverId) {
    return allowed.has(input.currentAuthorityId) ? input.currentAuthorityId : "";
  }
  const preferred = input.defaultAuthorityId ?? "";
  return preferred && allowed.has(preferred) ? preferred : "";
}

export function authorityForDriverChange(input: {
  previousDriverId: string;
  nextDriverId: string;
  currentAuthorityId: string;
  membershipStatus?: string | null;
  defaultAuthorityId?: string | null;
  allowedAuthorityIds: readonly string[];
}): string {
  if (input.nextDriverId === input.previousDriverId) {
    return input.currentAuthorityId;
  }
  if (input.membershipStatus !== "gold") {
    return "";
  }
  const preferred = input.defaultAuthorityId ?? "";
  return preferred && input.allowedAuthorityIds.includes(preferred) ? preferred : "";
}
