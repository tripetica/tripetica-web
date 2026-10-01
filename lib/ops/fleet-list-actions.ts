"use server";

import { revalidatePath } from "next/cache";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/path";
import { actorCan, getOpsActor } from "@/lib/ops/session";
import {
  setDriverListAuthority,
  setDriverListCompany,
  setDriverListVehicle,
  setVehicleListCompany,
  setVehicleListDriver,
} from "@/lib/partner/fleet-list-patch";

function localeFromInput(value: string): Locale {
  return isLocale(value) ? value : "tr";
}

function optionalId(value: string) {
  const trimmed = value.trim();
  return trimmed || null;
}

async function requireOpsFleetManager() {
  const actor = await getOpsActor();
  if (!actor || !actorCan(actor, "partners.manage")) {
    return null;
  }
  return actor;
}

function refreshFleet(locale: Locale, partnerId: string) {
  revalidatePath(localizedPath(locale, "/ops/drivers"));
  revalidatePath(localizedPath(locale, "/ops/vehicles"));
  revalidatePath(localizedPath(locale, "/partner/drivers"));
  revalidatePath(localizedPath(locale, "/partner/vehicles"));
  revalidatePath(localizedPath(locale, `/ops/partners/${partnerId}`));
}

export async function patchOpsDriverCompanyAction(input: {
  locale: string;
  partnerId: string;
  driverId: string;
  companyId: string;
}) {
  const actor = await requireOpsFleetManager();
  if (!actor) {
    return { ok: false as const, error: "forbidden" as const };
  }
  const result = await setDriverListCompany({
    partnerId: input.partnerId,
    driverId: input.driverId,
    companyId: optionalId(input.companyId),
  });
  if (result.ok) {
    refreshFleet(localeFromInput(input.locale), input.partnerId);
  }
  return result;
}

export async function patchOpsDriverVehicleAction(input: {
  locale: string;
  partnerId: string;
  driverId: string;
  vehicleId: string;
}) {
  const actor = await requireOpsFleetManager();
  if (!actor) {
    return { ok: false as const, error: "forbidden" as const };
  }
  const result = await setDriverListVehicle({
    partnerId: input.partnerId,
    driverId: input.driverId,
    vehicleId: optionalId(input.vehicleId),
  });
  if (result.ok) {
    refreshFleet(localeFromInput(input.locale), input.partnerId);
  }
  return result;
}

export async function patchOpsDriverAuthorityAction(input: {
  locale: string;
  partnerId: string;
  driverId: string;
  authorityId: string;
}) {
  const actor = await requireOpsFleetManager();
  if (!actor) {
    return { ok: false as const, error: "forbidden" as const };
  }
  const result = await setDriverListAuthority({
    partnerId: input.partnerId,
    driverId: input.driverId,
    authorityId: optionalId(input.authorityId),
  });
  if (result.ok) {
    refreshFleet(localeFromInput(input.locale), input.partnerId);
  }
  return result;
}

export async function patchOpsVehicleCompanyAction(input: {
  locale: string;
  partnerId: string;
  vehicleId: string;
  companyId: string;
}) {
  const actor = await requireOpsFleetManager();
  if (!actor) {
    return { ok: false as const, error: "forbidden" as const };
  }
  const result = await setVehicleListCompany({
    partnerId: input.partnerId,
    vehicleId: input.vehicleId,
    companyId: optionalId(input.companyId),
  });
  if (result.ok) {
    refreshFleet(localeFromInput(input.locale), input.partnerId);
  }
  return result;
}

export async function patchOpsVehicleDriverAction(input: {
  locale: string;
  partnerId: string;
  vehicleId: string;
  driverId: string;
}) {
  const actor = await requireOpsFleetManager();
  if (!actor) {
    return { ok: false as const, error: "forbidden" as const };
  }
  const result = await setVehicleListDriver({
    partnerId: input.partnerId,
    vehicleId: input.vehicleId,
    driverId: optionalId(input.driverId),
  });
  if (result.ok) {
    refreshFleet(localeFromInput(input.locale), input.partnerId);
  }
  return result;
}
