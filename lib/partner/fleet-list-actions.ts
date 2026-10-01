"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/path";
import {
  setDriverListAuthority,
  setDriverListCompany,
  setDriverListVehicle,
  setVehicleListCompany,
  setVehicleListDriver,
} from "@/lib/partner/fleet-list-patch";
import { getPartnerActor } from "@/lib/partner/session";

function localeFromInput(value: string): Locale {
  return isLocale(value) ? value : "tr";
}

function optionalId(value: string) {
  const trimmed = value.trim();
  return trimmed || null;
}

async function requirePartner(locale: string) {
  const resolved = localeFromInput(locale);
  const actor = await getPartnerActor();
  if (!actor) {
    redirect(localizedPath(resolved, "/partner/login"));
  }
  if (actor.mustChangePassword) {
    redirect(localizedPath(resolved, "/partner/change-password"));
  }
  return actor;
}

function refreshFleet(locale: Locale, partnerId: string) {
  revalidatePath(localizedPath(locale, "/partner/drivers"));
  revalidatePath(localizedPath(locale, "/partner/vehicles"));
  revalidatePath(localizedPath(locale, "/ops/drivers"));
  revalidatePath(localizedPath(locale, "/ops/vehicles"));
  revalidatePath(localizedPath(locale, `/ops/partners/${partnerId}`));
}

export async function patchPartnerDriverCompanyAction(input: {
  locale: string;
  driverId: string;
  companyId: string;
}) {
  const actor = await requirePartner(input.locale);
  const result = await setDriverListCompany({
    partnerId: actor.partnerId,
    driverId: input.driverId,
    companyId: optionalId(input.companyId),
  });
  if (result.ok) {
    refreshFleet(localeFromInput(input.locale), actor.partnerId);
  }
  return result;
}

export async function patchPartnerDriverVehicleAction(input: {
  locale: string;
  driverId: string;
  vehicleId: string;
}) {
  const actor = await requirePartner(input.locale);
  const result = await setDriverListVehicle({
    partnerId: actor.partnerId,
    driverId: input.driverId,
    vehicleId: optionalId(input.vehicleId),
  });
  if (result.ok) {
    refreshFleet(localeFromInput(input.locale), actor.partnerId);
  }
  return result;
}

export async function patchPartnerDriverAuthorityAction(input: {
  locale: string;
  driverId: string;
  authorityId: string;
}) {
  const actor = await requirePartner(input.locale);
  const result = await setDriverListAuthority({
    partnerId: actor.partnerId,
    driverId: input.driverId,
    authorityId: optionalId(input.authorityId),
  });
  if (result.ok) {
    refreshFleet(localeFromInput(input.locale), actor.partnerId);
  }
  return result;
}

export async function patchPartnerVehicleCompanyAction(input: {
  locale: string;
  vehicleId: string;
  companyId: string;
}) {
  const actor = await requirePartner(input.locale);
  const result = await setVehicleListCompany({
    partnerId: actor.partnerId,
    vehicleId: input.vehicleId,
    companyId: optionalId(input.companyId),
  });
  if (result.ok) {
    refreshFleet(localeFromInput(input.locale), actor.partnerId);
  }
  return result;
}

export async function patchPartnerVehicleDriverAction(input: {
  locale: string;
  vehicleId: string;
  driverId: string;
}) {
  const actor = await requirePartner(input.locale);
  const result = await setVehicleListDriver({
    partnerId: actor.partnerId,
    vehicleId: input.vehicleId,
    driverId: optionalId(input.driverId),
  });
  if (result.ok) {
    refreshFleet(localeFromInput(input.locale), actor.partnerId);
  }
  return result;
}
