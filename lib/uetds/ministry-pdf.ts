import "server-only";

import { isUuid } from "@/lib/ops/process-filters";
import { loadUetdsMinistryCredentials } from "@/lib/uetds/ministry-credentials";
import { resolveUetdsMinistryRuntime, UETDS_SOAP_ACTIONS } from "@/lib/uetds/ministry-env";
import { extractUetdsSoapPdfBytes } from "@/lib/uetds/ministry-pdf-parse";
import { callUetdsTestSoap, soapField, soapUserXml } from "@/lib/uetds/ministry-soap";
import { getUetdsNotification } from "@/lib/uetds/notifications";

export { extractUetdsSoapPdfBytes };

export async function fetchUetdsTestSeferDetailPdf(input: {
  username: string;
  password: string;
  seferReferansNo: string;
}) {
  if (!resolveUetdsMinistryRuntime()) {
    throw new Error("uetds_live_blocked");
  }
  const userXml = soapUserXml(input.username, input.password);
  const result = await callUetdsTestSoap({
    operation: "seferDetayCiktisiAl",
    soapAction: UETDS_SOAP_ACTIONS.seferDetayCiktisiAl,
    username: input.username,
    password: input.password,
    innerXml: `${userXml}${soapField("uetdsSeferReferansNo", input.seferReferansNo)}`,
  });
  if (result.sonucKodu !== 0) {
    return {
      ok: false as const,
      error: result.sonucMesaji || "unavailable",
      pdf: null,
    };
  }
  const pdf = extractUetdsSoapPdfBytes(result.values.sonucpdf ?? "");
  if (!pdf) {
    return { ok: false as const, error: "unavailable", pdf: null };
  }
  return { ok: true as const, error: null, pdf };
}

export async function loadAuthorizedUetdsMinistryPdf(input: {
  notificationId: string;
  actor:
    | { type: "partner"; partnerId: string }
    | { type: "ops"; partnerId?: null };
}) {
  if (!isUuid(input.notificationId)) {
    return { ok: false as const, error: "not-found" as const };
  }
  if (input.actor.type === "partner" && !isUuid(input.actor.partnerId)) {
    return { ok: false as const, error: "forbidden" as const };
  }
  const notification = await getUetdsNotification({
    id: input.notificationId,
    partnerId: input.actor.type === "partner" ? input.actor.partnerId : null,
  });
  if (!notification) {
    return { ok: false as const, error: "not-found" as const };
  }
  if (!notification.ministryReference || !notification.companyId) {
    return { ok: false as const, error: "unavailable" as const };
  }
  const credentials = await loadUetdsMinistryCredentials(notification.companyId);
  if (!credentials) {
    return { ok: false as const, error: "unavailable" as const };
  }
  try {
    const fetched = await fetchUetdsTestSeferDetailPdf({
      username: credentials.username,
      password: credentials.password,
      seferReferansNo: notification.ministryReference,
    });
    if (!fetched.ok || !fetched.pdf) {
      return { ok: false as const, error: "unavailable" as const };
    }
    const prefix = credentials.env === "live" ? "UETDS" : "UETDS-TEST";
    return {
      ok: true as const,
      pdf: fetched.pdf,
      filename: `${prefix}-${notification.ministryReference}.pdf`,
    };
  } catch (error) {
    if (error instanceof Error && (error.message === "uetds_live_blocked" || error.message === "uetds_dev_only")) {
      return { ok: false as const, error: "live-blocked" as const };
    }
    return { ok: false as const, error: "unavailable" as const };
  }
}
