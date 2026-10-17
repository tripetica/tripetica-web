"use server";

import { revalidatePath } from "next/cache";
import { isLocale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/path";
import { actorCan, getOpsActor } from "@/lib/ops/session";
import {
  addSubscriptionMonths,
  istanbulSubscriptionPeriodKey,
  isUetdsSubscriptionCurrency,
  isUetdsSubscriptionPeriodStatus,
  parseUetdsSubscriptionFee,
  type UetdsDriverSubscriptionListSummary,
  type UetdsSubscriptionPeriodStatus,
} from "@/lib/uetds/driver-subscription";
import { patchVehicleUetdsSubscriptionFromList } from "@/lib/uetds/vehicle-subscription-store";

type PatchState = {
  ok: boolean;
  error: string | null;
  vehicleId: string;
  summary: UetdsDriverSubscriptionListSummary | null;
};

function localeFromInput(value: string) {
  return isLocale(value) ? value : null;
}

function revalidateVehicle(locale: ReturnType<typeof localeFromInput>, vehicleId: string) {
  if (!locale) return;
  revalidatePath(localizedPath(locale, "/ops/vehicles"));
  revalidatePath(localizedPath(locale, `/ops/vehicles/${vehicleId}`));
  revalidatePath(localizedPath(locale, "/partner/vehicles"));
}

async function manager() {
  const actor = await getOpsActor();
  if (!actor || !actorCan(actor, "partners.manage")) return null;
  return actor;
}

export async function patchOpsVehicleSubscriptionFeeAction(input: {
  locale: string;
  vehicleId: string;
  monthlyFee: string;
}): Promise<PatchState> {
  const actor = await manager();
  if (!actor) return { ok: false, error: "forbidden", vehicleId: input.vehicleId, summary: null };
  const fee = parseUetdsSubscriptionFee(input.monthlyFee);
  if (fee == null) {
    return { ok: false, error: "invalid-subscription-fee", vehicleId: input.vehicleId, summary: null };
  }
  const result = await patchVehicleUetdsSubscriptionFromList({
    vehicleId: input.vehicleId,
    opsUserId: actor.id,
    patch: { kind: "fee", monthlyFee: fee },
  });
  if (!result.ok) return { ok: false, error: result.error, vehicleId: input.vehicleId, summary: null };
  revalidateVehicle(localeFromInput(input.locale), input.vehicleId);
  return { ok: true, error: null, vehicleId: input.vehicleId, summary: result.summary };
}

export async function patchOpsVehicleSubscriptionCurrencyAction(input: {
  locale: string;
  vehicleId: string;
  currency: string;
}): Promise<PatchState> {
  const actor = await manager();
  if (!actor) return { ok: false, error: "forbidden", vehicleId: input.vehicleId, summary: null };
  const currencyRaw = input.currency.trim().toUpperCase();
  if (!isUetdsSubscriptionCurrency(currencyRaw)) {
    return { ok: false, error: "invalid-subscription-currency", vehicleId: input.vehicleId, summary: null };
  }
  const result = await patchVehicleUetdsSubscriptionFromList({
    vehicleId: input.vehicleId,
    opsUserId: actor.id,
    patch: { kind: "currency", currency: currencyRaw },
  });
  if (!result.ok) return { ok: false, error: result.error, vehicleId: input.vehicleId, summary: null };
  revalidateVehicle(localeFromInput(input.locale), input.vehicleId);
  return { ok: true, error: null, vehicleId: input.vehicleId, summary: result.summary };
}

export async function patchOpsVehicleSubscriptionStatusAction(input: {
  locale: string;
  vehicleId: string;
  status: string;
  year: number;
  month: number;
}): Promise<PatchState> {
  const actor = await manager();
  if (!actor) return { ok: false, error: "forbidden", vehicleId: input.vehicleId, summary: null };
  if (!isUetdsSubscriptionPeriodStatus(input.status)) {
    return { ok: false, error: "invalid-subscription-status", vehicleId: input.vehicleId, summary: null };
  }
  const current = istanbulSubscriptionPeriodKey();
  if (input.year !== current.year || input.month !== current.month) {
    return { ok: false, error: "forbidden-period", vehicleId: input.vehicleId, summary: null };
  }
  const result = await patchVehicleUetdsSubscriptionFromList({
    vehicleId: input.vehicleId,
    opsUserId: actor.id,
    patch: { kind: "currentStatus", status: input.status as UetdsSubscriptionPeriodStatus, year: input.year, month: input.month },
  });
  if (!result.ok) return { ok: false, error: result.error, vehicleId: input.vehicleId, summary: null };
  revalidateVehicle(localeFromInput(input.locale), input.vehicleId);
  return { ok: true, error: null, vehicleId: input.vehicleId, summary: result.summary };
}

export async function patchOpsVehicleSubscriptionNextStatusAction(input: {
  locale: string;
  vehicleId: string;
  status: string;
  year: number;
  month: number;
}): Promise<PatchState> {
  const actor = await manager();
  if (!actor) return { ok: false, error: "forbidden", vehicleId: input.vehicleId, summary: null };
  if (!isUetdsSubscriptionPeriodStatus(input.status)) {
    return { ok: false, error: "invalid-subscription-status", vehicleId: input.vehicleId, summary: null };
  }
  const next = addSubscriptionMonths(istanbulSubscriptionPeriodKey(), 1);
  if (input.year !== next.year || input.month !== next.month) {
    return { ok: false, error: "forbidden-period", vehicleId: input.vehicleId, summary: null };
  }
  const result = await patchVehicleUetdsSubscriptionFromList({
    vehicleId: input.vehicleId,
    opsUserId: actor.id,
    patch: { kind: "nextStatus", status: input.status as UetdsSubscriptionPeriodStatus, year: input.year, month: input.month },
  });
  if (!result.ok) return { ok: false, error: result.error, vehicleId: input.vehicleId, summary: null };
  revalidateVehicle(localeFromInput(input.locale), input.vehicleId);
  return { ok: true, error: null, vehicleId: input.vehicleId, summary: result.summary };
}
