"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/path";
import {
  changeOpsSelfPassword,
  updateOpsSelfProfile,
  type OpsAccountPasswordError,
  type OpsAccountProfileError,
} from "@/lib/ops/account";
import {
  createOpsSession,
  getOpsActor,
  writeOpsSessionCookie,
} from "@/lib/ops/session";

export type OpsAccountProfileState = {
  error: OpsAccountProfileError | null;
  ok: boolean;
};

export type OpsAccountPasswordState = {
  error: OpsAccountPasswordError | null;
  ok: boolean;
};

function localeFromForm(formData: FormData): Locale {
  const value = String(formData.get("locale") ?? "");
  return isLocale(value) ? value : "tr";
}

async function requireAccountActor(locale: Locale) {
  const actor = await getOpsActor();
  if (!actor) {
    redirect(localizedPath(locale, "/ops/login"));
  }
  return actor;
}

export async function updateOpsAccountProfileAction(
  _prev: OpsAccountProfileState,
  formData: FormData,
): Promise<OpsAccountProfileState> {
  const locale = localeFromForm(formData);
  const actor = await requireAccountActor(locale);
  const result = await updateOpsSelfProfile({
    actorId: actor.id,
    firstName: String(formData.get("firstName") ?? ""),
    lastName: String(formData.get("lastName") ?? ""),
    email: String(formData.get("email") ?? ""),
  });
  if (!result.ok) {
    return { error: result.error, ok: false };
  }
  revalidatePath(localizedPath(locale, "/ops/account"));
  return { error: null, ok: true };
}

export async function changeOpsAccountPasswordAction(
  _prev: OpsAccountPasswordState,
  formData: FormData,
): Promise<OpsAccountPasswordState> {
  const locale = localeFromForm(formData);
  const actor = await requireAccountActor(locale);
  const result = await changeOpsSelfPassword({
    actorId: actor.id,
    currentPassword: String(formData.get("currentPassword") ?? ""),
    newPassword: String(formData.get("newPassword") ?? ""),
    confirmPassword: String(formData.get("confirmPassword") ?? ""),
  });
  if (!result.ok) {
    return { error: result.error, ok: false };
  }
  const session = await createOpsSession(actor.id);
  await writeOpsSessionCookie(session.token, session.expiresAt);
  revalidatePath(localizedPath(locale, "/ops/account"));
  return { error: null, ok: true };
}
