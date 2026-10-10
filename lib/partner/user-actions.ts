"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/path";
import { firstPartnerTabPath, partnerHasTab } from "@/lib/partner/access";
import { getPartnerActor } from "@/lib/partner/session";
import {
  createPartnerExtraUser,
  deletePartnerExtraUser,
  replacePartnerExtraUserTabs,
  setPartnerExtraUserStatus,
} from "@/lib/partner/user-store";

async function requireUsers(locale: Locale) {
  const actor = await getPartnerActor();
  if (!actor) redirect(localizedPath(locale, "/partner/login"));
  if (actor.mustChangePassword) redirect(localizedPath(locale, "/partner/change-password"));
  if (!partnerHasTab(actor, "users")) redirect(localizedPath(locale, firstPartnerTabPath(actor)));
  return actor;
}

function localeFrom(formData: FormData): Locale {
  const value = String(formData.get("locale") ?? "");
  return isLocale(value) ? value : "tr";
}

export async function createPartnerUserAction(_previous: { error: string | null; ok: boolean }, formData: FormData) {
  const locale = localeFrom(formData);
  const actor = await requireUsers(locale);
  const result = await createPartnerExtraUser({
    partnerId: actor.partnerId,
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
    passwordAgain: String(formData.get("passwordAgain") ?? ""),
    tabs: formData.getAll("tab").map(String),
  });
  if (!result.ok) return { error: result.error, ok: false };
  revalidatePath(localizedPath(locale, "/partner/users"));
  return { error: null, ok: true };
}

export async function updatePartnerUserTabsAction(formData: FormData) {
  const locale = localeFrom(formData);
  const actor = await requireUsers(locale);
  await replacePartnerExtraUserTabs({
    partnerId: actor.partnerId,
    userId: String(formData.get("userId") ?? ""),
    tabs: formData.getAll("tab").map(String),
  });
  revalidatePath(localizedPath(locale, "/partner/users"));
}

export async function setPartnerUserStatusAction(formData: FormData) {
  const locale = localeFrom(formData);
  const actor = await requireUsers(locale);
  const status = formData.get("status") === "inactive" ? "inactive" : "active";
  await setPartnerExtraUserStatus({
    partnerId: actor.partnerId,
    userId: String(formData.get("userId") ?? ""),
    status,
  });
  revalidatePath(localizedPath(locale, "/partner/users"));
}

export async function deletePartnerUserAction(formData: FormData) {
  const locale = localeFrom(formData);
  const actor = await requireUsers(locale);
  await deletePartnerExtraUser(actor.partnerId, String(formData.get("userId") ?? ""));
  revalidatePath(localizedPath(locale, "/partner/users"));
}
