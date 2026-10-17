"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { istanbulLocalToUtcMs } from "@/lib/booking/istanbul-time";
import {
  faultReportingWindow,
  formatAtsFaultStart,
  isAtsFaultKind,
  nextFaultReport,
} from "@/lib/gps/ats-fault";
import {
  beginMinistryAttempt,
  finishMinistryAttempt,
  insertFault,
  listAcceptedStamps,
  listAttempts,
  loadFaultContext,
  markFaultLimited,
  readFault,
  resolveFault,
} from "@/lib/gps/ats-fault-store";
import { isLocale, locales } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/path";
import { actorCan, getOpsActor } from "@/lib/ops/session";
import { postAtsArizaBildir } from "@/lib/uetds/ats-post";
import { loadUetdsMinistryCredentials } from "@/lib/uetds/ministry-credentials";

function plateKey(plate: string) {
  return plate.replace(/\s+/g, "").toUpperCase();
}

function revalidate(deviceId: string) {
  for (const locale of locales) {
    revalidatePath(`/${locale}/ops/gps`);
    revalidatePath(`/${locale}/ops/gps/${deviceId}`);
  }
}

export async function createGpsAtsFaultAction(formData: FormData) {
  const actor = await getOpsActor();
  const locale = String(formData.get("locale") ?? "");
  if (!actor || !actorCan(actor, "gps.manage") || !isLocale(locale)) {
    redirect("/tr/ops/login");
  }
  const deviceId = String(formData.get("deviceId") ?? "");
  const context = await loadFaultContext(deviceId);
  const back = localizedPath(locale, `/ops/gps/${deviceId}`);
  if (!context?.vehicleId || !context.plate) {
    redirect(`${back}?fault=missing`);
  }
  const kind = String(formData.get("kind") ?? "");
  const description = String(formData.get("description") ?? "").trim();
  const started = istanbulLocalToUtcMs(`${String(formData.get("startDate") ?? "")}T${String(formData.get("startTime") ?? "")}`);
  if (!isAtsFaultKind(kind) || description.length < 1 || description.length > 500 || !Number.isFinite(started)) {
    redirect(`${back}?fault=invalid`);
  }
  if (started > Date.now() + 2 * 60 * 1000) {
    redirect(`${back}?fault=future`);
  }
  const intent = String(formData.get("intent") ?? "");
  const stamps = await listAcceptedStamps(context.vehicleId, plateKey(context.plate));
  const window = faultReportingWindow(stamps, Date.now());
  const next = nextFaultReport(window);
  const faultId = await insertFault({
    vehicleId: context.vehicleId,
    plate: context.plate,
    plateKey: plateKey(context.plate),
    deviceId: context.deviceId,
    imei: context.imei,
    partnerId: context.partnerId,
    companyId: context.companyId,
    driverId: context.driverId,
    driverName: context.driverName,
    driverPhone: context.driverPhone,
    startedAt: new Date(started),
    kind,
    description,
    actorId: actor.id,
  });
  if (!faultId) redirect(`${back}?fault=invalid`);
  revalidate(deviceId);
  if (intent !== "ministry") {
    redirect(`${back}?fault=saved`);
  }
  if (next === "blocked") {
    await markFaultLimited(faultId, actor.id);
    revalidate(deviceId);
    redirect(`${back}?fault=limited`);
  }
  if (next === "second" && formData.get("confirmSecond") !== "yes") {
    redirect(`${back}?fault=${faultId}&need=second`);
  }
  await sendFault(faultId, actor.id, formData.get("confirmUnknown") === "yes");
  revalidate(deviceId);
  redirect(`${back}?fault=${faultId}&sent=1&rank=${next}`);
}

export async function sendGpsAtsFaultAction(formData: FormData) {
  const actor = await getOpsActor();
  const locale = String(formData.get("locale") ?? "");
  const deviceId = String(formData.get("deviceId") ?? "");
  const faultId = String(formData.get("faultId") ?? "");
  if (!actor || !actorCan(actor, "gps.manage") || !isLocale(locale)) {
    redirect("/tr/ops/login");
  }
  const fault = await readFault(faultId);
  const back = localizedPath(locale, `/ops/gps/${deviceId}`);
  if (!fault || fault.ministryStatus === "accepted") {
    redirect(`${back}?fault=saved`);
  }
  const window = faultReportingWindow(await listAcceptedStamps(fault.vehicleId, fault.plateKey), Date.now());
  const next = nextFaultReport(window);
  if (next === "blocked") {
    await markFaultLimited(fault.id, actor.id);
    revalidate(deviceId);
    redirect(`${back}?fault=limited`);
  }
  if (next === "second" && formData.get("confirmSecond") !== "yes") {
    redirect(`${back}?fault=${fault.id}&need=second`);
  }
  const attempts = await listAttempts(fault.id);
  const pending = attempts.some((row) => row.outcome === "unknown" || row.outcome === "sending");
  if (pending && formData.get("confirmUnknown") !== "yes") {
    redirect(`${back}?fault=${fault.id}&need=unknown`);
  }
  await sendFault(fault.id, actor.id, true);
  revalidate(deviceId);
  redirect(`${back}?fault=${fault.id}&sent=1&rank=${next}`);
}

async function sendFault(faultId: string, actorId: string, allowUnknown: boolean) {
  const fault = await readFault(faultId);
  if (!fault || fault.ministryStatus === "accepted" || !fault.companyId) {
    if (fault) {
      await finishWithoutSend(fault.id, actorId, "withheld", "Firma veya kayıt bulunamadı.");
    }
    return;
  }
  const attempts = await listAttempts(fault.id);
  if (attempts.some((row) => row.outcome === "unknown" || row.outcome === "sending") && !allowUnknown) {
    return;
  }
  const begun = await beginMinistryAttempt(fault.id, actorId);
  if (!begun.ok) return;
  const credentials = await loadUetdsMinistryCredentials(fault.companyId);
  if (!credentials) {
    await finishMinistryAttempt({
      faultId: fault.id,
      attemptId: begun.attemptId,
      outcome: "withheld",
      sonucKodu: null,
      sonucMesaji: "Bakanlık kimlik bilgisi yok.",
      referenceText: null,
      rawSafe: "",
    });
    return;
  }
  try {
    const result = await postAtsArizaBildir({
      username: credentials.username,
      password: credentials.password,
      plate: fault.plateKey,
      arizaBaslangicTarihi: formatAtsFaultStart(new Date(fault.startedAt)),
      aciklama: fault.description,
    });
    const reference = result.values.uetdsbildirimreferansno || result.values.referansno || null;
    const outcome = result.sonucKodu === 0 ? "accepted" : result.sonucKodu == null ? "unknown" : "rejected";
    await finishMinistryAttempt({
      faultId: fault.id,
      attemptId: begun.attemptId,
      outcome,
      sonucKodu: result.sonucKodu,
      sonucMesaji: result.sonucMesaji,
      referenceText: reference,
      rawSafe: result.rawSafe,
    });
  } catch (error) {
    const withheld = error instanceof Error && error.message === "ats_fault_withheld";
    await finishMinistryAttempt({
      faultId: fault.id,
      attemptId: begun.attemptId,
      outcome: withheld ? "withheld" : "unknown",
      sonucKodu: null,
      sonucMesaji: withheld ? "Gönderim bu ortamda kapalı." : "Bakanlık sonucu alınamadı.",
      referenceText: null,
      rawSafe: "",
    });
  }
}

async function finishWithoutSend(faultId: string, actorId: string, outcome: "withheld", message: string) {
  const begun = await beginMinistryAttempt(faultId, actorId);
  if (!begun.ok) return;
  await finishMinistryAttempt({
    faultId,
    attemptId: begun.attemptId,
    outcome,
    sonucKodu: null,
    sonucMesaji: message,
    referenceText: null,
    rawSafe: "",
  });
}

export async function resolveGpsAtsFaultAction(formData: FormData) {
  const actor = await getOpsActor();
  const locale = String(formData.get("locale") ?? "");
  const deviceId = String(formData.get("deviceId") ?? "");
  const faultId = String(formData.get("faultId") ?? "");
  if (!actor || !actorCan(actor, "gps.manage") || !isLocale(locale)) {
    redirect("/tr/ops/login");
  }
  const resolved = istanbulLocalToUtcMs(`${String(formData.get("resolvedDate") ?? "")}T${String(formData.get("resolvedTime") ?? "")}`);
  const back = localizedPath(locale, `/ops/gps/${deviceId}`);
  if (!Number.isFinite(resolved) || resolved > Date.now() + 2 * 60 * 1000) {
    redirect(`${back}?fault=invalid`);
  }
  await resolveFault(faultId, actor.id, new Date(resolved));
  revalidate(deviceId);
  redirect(`${back}?fault=resolved`);
}
