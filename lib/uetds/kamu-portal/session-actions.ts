"use server";

import { hasKamuPortalSession, saveKamuPortalSession } from "@/lib/uetds/kamu-portal/session";
import { probeKamuPortalSession } from "@/lib/uetds/kamu-portal/client";
import { uetdsFormCopyFor } from "@/lib/uetds/copy";
import { isLocale } from "@/lib/i18n/config";

export type KamuSessionBindState = {
  ok: boolean;
  error: "forbidden" | "invalid" | "unavailable" | "expired" | "firm-required" | null;
  message: string | null;
  /** Safe diagnostics only — never cookies/HTML. */
  probe?: {
    status: number;
    finalHost: string;
    finalPath: string;
    htmlLength: number;
    loginWall: boolean;
    firmSelect: boolean;
    authenticatedShell: boolean;
  } | null;
};

export async function bindKamuPortalSessionAction(
  _prev: KamuSessionBindState,
  formData: FormData,
): Promise<KamuSessionBindState> {
  const localeRaw = String(formData.get("locale") || "tr");
  const locale = isLocale(localeRaw) ? localeRaw : "tr";
  const copy = uetdsFormCopyFor(locale);
  const cookieHeader = String(formData.get("cookieHeader") || "");
  const saved = await saveKamuPortalSession(cookieHeader);
  if (!saved.ok) {
    return {
      ok: false,
      error: saved.error,
      message:
        saved.error === "forbidden"
          ? copy.editKamuSessionRequired
          : saved.error === "unavailable"
            ? copy.kamuSessionBindUnavailable
            : copy.kamuSessionBindInvalid,
      probe: null,
    };
  }
  const probe = await probeKamuPortalSession();
  const summary = "summary" in probe ? probe.summary ?? null : null;
  if (!probe.ok) {
    // Cookie is stored; firm selection is a follow-up step on Kamu, not a bind failure.
    if (probe.error === "kamu-firm-required") {
      return {
        ok: true,
        error: "firm-required",
        message: `${copy.kamuSessionBound} ${copy.editKamuFirmRequired}`,
        probe: summary,
      };
    }
    if (probe.error === "kamu-session-expired" || probe.error === "kamu-session-required") {
      return {
        ok: false,
        error: "expired",
        message: copy.editKamuSessionExpired,
        probe: summary,
      };
    }
    return {
      ok: false,
      error: "invalid",
      message: copy.kamuSessionBindInvalid,
      probe: summary,
    };
  }
  if (!(await hasKamuPortalSession())) {
    return {
      ok: false,
      error: "unavailable",
      message: copy.kamuSessionBindUnavailable,
      probe: summary,
    };
  }
  return { ok: true, error: null, message: copy.kamuSessionBound, probe: summary };
}
