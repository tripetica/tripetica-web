"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/path";
import { getPartnerActor } from "@/lib/partner/session";
import {
  isEdevletAuthorityStatus,
  type PartnerEdevletAuthorityState,
} from "./partner-authority-fields";
import {
  createPartnerEdevletAuthority,
  deletePartnerEdevletAuthority,
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

async function requireOwner() {
  const actor = await getPartnerActor();
  if (!actor || actor.mustChangePassword) return null;
  return actor;
}

function refreshAuthorityPaths(locale: Locale, authorityId?: string) {
  revalidatePath(localizedPath(locale, "/partner/edevlet-authorities"));
  if (authorityId) {
    revalidatePath(localizedPath(locale, `/partner/edevlet-authorities/${authorityId}`));
  }
}

export async function createPartnerEdevletAuthorityAction(
  _previous: PartnerEdevletAuthorityState,
  form: FormData,
): Promise<PartnerEdevletAuthorityState> {
  const locale = localeFromForm(form);
  const actor = await requireOwner();
  if (!actor) return { ok: false, error: "forbidden" };
  const statusRaw = String(form.get("status") ?? "active");
  if (!isEdevletAuthorityStatus(statusRaw)) return { ok: false, error: "invalid" };
  let authorityId: string;
  try {
    const authority = await createPartnerEdevletAuthority(actor.partnerId, {
      firstName: String(form.get("firstName") ?? ""),
      lastName: String(form.get("lastName") ?? ""),
      identity: String(form.get("identity") ?? ""),
      password: String(form.get("password") ?? ""),
      companyIds: companyIdsFromForm(form),
      status: statusRaw,
    });
    if (!authority) return { ok: false, error: "invalid" };
    authorityId = authority.id;
  } catch {
    return { ok: false, error: "failed" };
  }
  refreshAuthorityPaths(locale, authorityId);
  redirect(localizedPath(locale, `/partner/edevlet-authorities/${authorityId}`));
}

export async function updatePartnerEdevletAuthorityAction(
  _previous: PartnerEdevletAuthorityState,
  form: FormData,
): Promise<PartnerEdevletAuthorityState> {
  const locale = localeFromForm(form);
  const actor = await requireOwner();
  if (!actor) return { ok: false, error: "forbidden" };
  const authorityId = String(form.get("id") ?? "");
  try {
    const authority = await updatePartnerEdevletAuthority(actor.partnerId, authorityId, {
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

export async function setPartnerEdevletAuthorityStatusAction(
  _previous: PartnerEdevletAuthorityState,
  form: FormData,
): Promise<PartnerEdevletAuthorityState> {
  const locale = localeFromForm(form);
  const actor = await requireOwner();
  if (!actor) return { ok: false, error: "forbidden" };
  const statusRaw = String(form.get("status") ?? "");
  if (!isEdevletAuthorityStatus(statusRaw)) return { ok: false, error: "invalid" };
  const authorityId = String(form.get("id") ?? "");
  try {
    const authority = await setPartnerEdevletAuthorityStatus(actor.partnerId, authorityId, statusRaw);
    if (!authority) return { ok: false, error: "not-found" };
    refreshAuthorityPaths(locale, authority.id);
    return { ok: true, error: null, authority };
  } catch {
    return { ok: false, error: "failed" };
  }
}

export async function deletePartnerEdevletAuthorityAction(
  _previous: PartnerEdevletAuthorityState,
  form: FormData,
): Promise<PartnerEdevletAuthorityState> {
  const locale = localeFromForm(form);
  const actor = await requireOwner();
  if (!actor) return { ok: false, error: "forbidden" };
  const authorityId = String(form.get("id") ?? "");
  try {
    const deleted = await deletePartnerEdevletAuthority(actor.partnerId, authorityId);
    if (!deleted) return { ok: false, error: "not-found" };
  } catch {
    return { ok: false, error: "failed" };
  }
  refreshAuthorityPaths(locale, authorityId);
  redirect(localizedPath(locale, "/partner/edevlet-authorities"));
}
