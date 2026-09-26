"use server";

import { revalidatePath } from "next/cache";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/path";
import { actorCan, getOpsActor } from "@/lib/ops/session";
import {
  getOpsUetdsCompanyEditor,
  saveOpsUetdsCompany,
} from "@/lib/ops/uetds-companies";
import {
  parseUetdsCompanyInput,
  type UetdsCompanyEditor,
} from "@/lib/ops/uetds-company-fields";

export type UetdsCompanyFormState = {
  error: "forbidden" | "invalid" | "failed" | null;
  ok: boolean;
  id: string;
};

function localeFromForm(formData: FormData): Locale {
  const value = String(formData.get("locale") ?? "");
  return isLocale(value) ? value : "tr";
}

function refreshCompanies(locale: Locale) {
  revalidatePath(localizedPath(locale, "/ops/uetds/companies"));
  revalidatePath(localizedPath(locale, "/ops/uetds"));
}

async function requireUetdsManage() {
  const actor = await getOpsActor();
  if (!actor || !actorCan(actor, "uetds.manage")) {
    return false;
  }
  return true;
}

export async function loadUetdsCompanyEditorAction(
  id: string,
): Promise<UetdsCompanyEditor | null> {
  const actor = await getOpsActor();
  if (!actor || !actorCan(actor, "uetds.view")) {
    return null;
  }
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return null;
  }
  return getOpsUetdsCompanyEditor(id);
}

export async function saveUetdsCompanyAction(
  _prev: UetdsCompanyFormState,
  formData: FormData,
): Promise<UetdsCompanyFormState> {
  const locale = localeFromForm(formData);
  const id = String(formData.get("id") ?? "").trim();
  if (!(await requireUetdsManage())) {
    return { error: "forbidden", ok: false, id };
  }
  const fields = parseUetdsCompanyInput({
    shortName: String(formData.get("shortName") ?? ""),
    legalName: String(formData.get("legalName") ?? ""),
    taxNumber: String(formData.get("taxNumber") ?? ""),
    authorityDocumentType: String(formData.get("authorityDocumentType") ?? ""),
    authorityDocumentNumber: String(formData.get("authorityDocumentNumber") ?? ""),
    status: String(formData.get("status") ?? ""),
    testUsername: String(formData.get("testUsername") ?? ""),
    liveUsername: String(formData.get("liveUsername") ?? ""),
    testPassword: String(formData.get("testPassword") ?? ""),
    livePassword: String(formData.get("livePassword") ?? ""),
  });
  if (!fields) {
    return { error: "invalid", ok: false, id };
  }
  const result = await saveOpsUetdsCompany({
    id: id || undefined,
    fields,
  });
  if (!result.ok) {
    return { error: result.error, ok: false, id };
  }
  refreshCompanies(locale);
  return { error: null, ok: true, id: result.id };
}
