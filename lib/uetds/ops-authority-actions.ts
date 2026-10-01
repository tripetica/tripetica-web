"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/path";
import { actorCan, getOpsActor } from "@/lib/ops/session";
import {
  isEdevletAuthorityStatus,
  type PartnerEdevletAuthorityState,
} from "./partner-authority-fields";
import {
  deletePartnerEdevletAuthority,
  getOpsEdevletAuthority,
  setPartnerEdevletAuthorityStatus,
  updatePartnerEdevletAuthority,
} from "./partner-authority-store";

function localeFromForm(form: FormData): Locale {
  const value = String(form.get("locale") ?? "");
  return isLocale(value) ? value : "tr";
}

function companyIdsFromForm(form: FormData) {
  return form.getAll("companyId").map((value) => String(value));
}

async function requireManager() {
  const actor = await getOpsActor();
  if (!actor || !actorCan(actor, "uetds.manage")) return null;
  return actor;
}

function refreshAuthorityPaths(locale: Locale, authorityId?: string) {
  revalidatePath(localizedPath(locale, "/ops/uetds/authorities"));
  if (authorityId) {
    revalidatePath(localizedPath(locale, `/ops/uetds/authorities/${authorityId}`));
  }
}

export async function updateOpsEdevletAuthorityAction(
  _previous: PartnerEdevletAuthorityState,
  form: FormData,
): Promise<PartnerEdevletAuthorityState> {
  const locale = localeFromForm(form);
  const actor = await requireManager();
  if (!actor) return { ok: false, error: "forbidden" };
  const authorityId = String(form.get("id") ?? "");
  const existing = await getOpsEdevletAuthority(authorityId);
  if (!existing) return { ok: false, error: "not-found" };
  try {
    const authority = await updatePartnerEdevletAuthority(existing.partnerId, authorityId, {
      firstName: String(form.get("firstName") ?? ""),
      lastName: String(form.get("lastName") ?? ""),
      identity: String(form.get("identity") ?? ""),
      password: String(form.get("password") ?? ""),
      companyIds: companyIdsFromForm(form),
    });
    if (!authority) return { ok: false, error: "invalid" };
    refreshAuthorityPaths(locale, authority.id);
    return { ok: true, error: null, authority };
  } catch {
    return { ok: false, error: "failed" };
  }
}

export async function setOpsEdevletAuthorityStatusAction(
  _previous: PartnerEdevletAuthorityState,
  form: FormData,
): Promise<PartnerEdevletAuthorityState> {
  const locale = localeFromForm(form);
  const actor = await requireManager();
  if (!actor) return { ok: false, error: "forbidden" };
  const statusRaw = String(form.get("status") ?? "");
  if (!isEdevletAuthorityStatus(statusRaw)) return { ok: false, error: "invalid" };
  const authorityId = String(form.get("id") ?? "");
  const existing = await getOpsEdevletAuthority(authorityId);
  if (!existing) return { ok: false, error: "not-found" };
  try {
    const authority = await setPartnerEdevletAuthorityStatus(existing.partnerId, authorityId, statusRaw);
    if (!authority) return { ok: false, error: "not-found" };
    refreshAuthorityPaths(locale, authority.id);
    return { ok: true, error: null, authority };
  } catch {
    return { ok: false, error: "failed" };
  }
}

export async function deleteOpsEdevletAuthorityAction(
  _previous: PartnerEdevletAuthorityState,
  form: FormData,
): Promise<PartnerEdevletAuthorityState> {
  const locale = localeFromForm(form);
  const actor = await requireManager();
  if (!actor) return { ok: false, error: "forbidden" };
  const authorityId = String(form.get("id") ?? "");
  const existing = await getOpsEdevletAuthority(authorityId);
  if (!existing) return { ok: false, error: "not-found" };
  try {
    const deleted = await deletePartnerEdevletAuthority(existing.partnerId, authorityId);
    if (!deleted) return { ok: false, error: "not-found" };
  } catch {
    return { ok: false, error: "failed" };
  }
  refreshAuthorityPaths(locale, authorityId);
  redirect(localizedPath(locale, "/ops/uetds/authorities"));
}
