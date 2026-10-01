"use server";

import { revalidatePath } from "next/cache";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/path";
import { listOpsDrivers, OPS_DRIVERS_PAGE_SIZE } from "@/lib/ops/drivers";
import { parseOpsDriverSortDir } from "@/lib/ops/driver-filters";
import { isDriverMembershipStatus } from "@/lib/ops/driver-membership";
import { saveDriverMembership } from "@/lib/ops/driver-membership-store";
import { actorCan, getOpsActor } from "@/lib/ops/session";
import {
  addSubscriptionMonths,
  isUetdsSubscriptionCurrency,
  isUetdsSubscriptionPeriodStatus,
  istanbulSubscriptionPeriodKey,
  parseUetdsSubscriptionFee,
  type UetdsDriverSubscriptionListSummary,
  type UetdsSubscriptionPeriodStatus,
} from "@/lib/uetds/driver-subscription";
import { patchDriverUetdsSubscriptionFromList } from "@/lib/uetds/driver-subscription-store";

export async function searchOpsDriversAction(input: {
  query: string;
  dir: string;
  page: number;
}) {
  const actor = await getOpsActor();
  if (!actor || !actorCan(actor, "partners.view")) {
    return { items: [], total: 0, page: 1, pageSize: OPS_DRIVERS_PAGE_SIZE, fleetChoices: {} };
  }
  return listOpsDrivers({
    query: input.query,
    dir: parseOpsDriverSortDir(input.dir),
    page: input.page,
    pageSize: OPS_DRIVERS_PAGE_SIZE,
  });
}

export type OpsDriverSubscriptionListPatchState =
  | {
      ok: true;
      error: null;
      driverId: string;
      summary: UetdsDriverSubscriptionListSummary;
    }
  | {
      ok: false;
      error:
        | "forbidden"
        | "not-found"
        | "not-enrolled"
        | "forbidden-period"
        | "invalid-subscription-fee"
        | "invalid-subscription-currency"
        | "invalid-subscription-status"
        | "failed";
      driverId: string | null;
      summary: null;
    };

function localeFromInput(value: string): Locale {
  return isLocale(value) ? value : "tr";
}

function revalidateDriverSubscriptionPaths(locale: Locale, driverId: string, partnerId?: string) {
  revalidatePath(localizedPath(locale, "/ops/drivers"));
  revalidatePath(localizedPath(locale, `/ops/drivers/${driverId}`));
  revalidatePath(localizedPath(locale, "/partner/drivers"));
  revalidatePath(localizedPath(locale, `/partner/drivers/${driverId}`));
  if (partnerId) {
    revalidatePath(localizedPath(locale, `/ops/partners/${partnerId}`));
    revalidatePath(localizedPath(locale, `/ops/partners/${partnerId}/drivers/${driverId}`));
  }
}

async function requireOpsSubscriptionManager() {
  const actor = await getOpsActor();
  if (!actor || !actorCan(actor, "partners.manage")) {
    return null;
  }
  return actor;
}

export async function patchOpsDriverSubscriptionFeeAction(input: {
  locale: string;
  driverId: string;
  monthlyFee: string;
}): Promise<OpsDriverSubscriptionListPatchState> {
  const actor = await requireOpsSubscriptionManager();
  if (!actor) {
    return { ok: false, error: "forbidden", driverId: input.driverId, summary: null };
  }
  const fee = parseUetdsSubscriptionFee(input.monthlyFee);
  if (fee == null) {
    return {
      ok: false,
      error: "invalid-subscription-fee",
      driverId: input.driverId,
      summary: null,
    };
  }
  const result = await patchDriverUetdsSubscriptionFromList({
    driverId: input.driverId,
    opsUserId: actor.id,
    patch: { kind: "fee", monthlyFee: fee },
  });
  if (!result.ok) {
    return { ok: false, error: result.error, driverId: input.driverId, summary: null };
  }
  revalidateDriverSubscriptionPaths(localeFromInput(input.locale), input.driverId);
  return {
    ok: true,
    error: null,
    driverId: input.driverId,
    summary: result.summary,
  };
}

export async function patchOpsDriverSubscriptionCurrencyAction(input: {
  locale: string;
  driverId: string;
  currency: string;
}): Promise<OpsDriverSubscriptionListPatchState> {
  const actor = await requireOpsSubscriptionManager();
  if (!actor) {
    return { ok: false, error: "forbidden", driverId: input.driverId, summary: null };
  }
  const currencyRaw = input.currency.trim().toUpperCase();
  if (!isUetdsSubscriptionCurrency(currencyRaw)) {
    return {
      ok: false,
      error: "invalid-subscription-currency",
      driverId: input.driverId,
      summary: null,
    };
  }
  const result = await patchDriverUetdsSubscriptionFromList({
    driverId: input.driverId,
    opsUserId: actor.id,
    patch: { kind: "currency", currency: currencyRaw },
  });
  if (!result.ok) {
    return { ok: false, error: result.error, driverId: input.driverId, summary: null };
  }
  revalidateDriverSubscriptionPaths(localeFromInput(input.locale), input.driverId);
  return {
    ok: true,
    error: null,
    driverId: input.driverId,
    summary: result.summary,
  };
}

export async function patchOpsDriverSubscriptionStatusAction(input: {
  locale: string;
  driverId: string;
  status: string;
  year: number;
  month: number;
}): Promise<OpsDriverSubscriptionListPatchState> {
  const actor = await requireOpsSubscriptionManager();
  if (!actor) {
    return { ok: false, error: "forbidden", driverId: input.driverId, summary: null };
  }
  if (!isUetdsSubscriptionPeriodStatus(input.status)) {
    return {
      ok: false,
      error: "invalid-subscription-status",
      driverId: input.driverId,
      summary: null,
    };
  }
  const current = istanbulSubscriptionPeriodKey();
  if (input.year !== current.year || input.month !== current.month) {
    return {
      ok: false,
      error: "forbidden-period",
      driverId: input.driverId,
      summary: null,
    };
  }
  const result = await patchDriverUetdsSubscriptionFromList({
    driverId: input.driverId,
    opsUserId: actor.id,
    patch: {
      kind: "currentStatus",
      status: input.status as UetdsSubscriptionPeriodStatus,
      year: input.year,
      month: input.month,
    },
  });
  if (!result.ok) {
    return { ok: false, error: result.error, driverId: input.driverId, summary: null };
  }
  revalidateDriverSubscriptionPaths(localeFromInput(input.locale), input.driverId);
  return {
    ok: true,
    error: null,
    driverId: input.driverId,
    summary: result.summary,
  };
}

export async function patchOpsDriverSubscriptionNextStatusAction(input: {
  locale: string;
  driverId: string;
  status: string;
  year: number;
  month: number;
}): Promise<OpsDriverSubscriptionListPatchState> {
  const actor = await requireOpsSubscriptionManager();
  if (!actor) {
    return { ok: false, error: "forbidden", driverId: input.driverId, summary: null };
  }
  if (!isUetdsSubscriptionPeriodStatus(input.status)) {
    return {
      ok: false,
      error: "invalid-subscription-status",
      driverId: input.driverId,
      summary: null,
    };
  }
  const next = addSubscriptionMonths(istanbulSubscriptionPeriodKey(), 1);
  if (input.year !== next.year || input.month !== next.month) {
    return {
      ok: false,
      error: "forbidden-period",
      driverId: input.driverId,
      summary: null,
    };
  }
  const result = await patchDriverUetdsSubscriptionFromList({
    driverId: input.driverId,
    opsUserId: actor.id,
    patch: {
      kind: "nextStatus",
      status: input.status as UetdsSubscriptionPeriodStatus,
      year: input.year,
      month: input.month,
    },
  });
  if (!result.ok) {
    return { ok: false, error: result.error, driverId: input.driverId, summary: null };
  }
  revalidateDriverSubscriptionPaths(localeFromInput(input.locale), input.driverId);
  return {
    ok: true,
    error: null,
    driverId: input.driverId,
    summary: result.summary,
  };
}

export async function patchOpsDriverMembershipAction(input: {
  locale: string;
  driverId: string;
  partnerId: string;
  status: string;
}): Promise<
  | { ok: true; error: null; driverId: string; status: "standard" | "gold" }
  | { ok: false; error: "forbidden" | "invalid" | "not-found" | "failed"; driverId: string }
> {
  const actor = await requireOpsSubscriptionManager();
  if (!actor) return { ok: false, error: "forbidden", driverId: input.driverId };
  if (!isDriverMembershipStatus(input.status)) {
    return { ok: false, error: "invalid", driverId: input.driverId };
  }
  try {
    const saved = await saveDriverMembership(input.partnerId, input.driverId, input.status);
    if (!saved) return { ok: false, error: "not-found", driverId: input.driverId };
  } catch {
    return { ok: false, error: "failed", driverId: input.driverId };
  }
  revalidateDriverSubscriptionPaths(localeFromInput(input.locale), input.driverId, input.partnerId);
  return { ok: true, error: null, driverId: input.driverId, status: input.status };
}
