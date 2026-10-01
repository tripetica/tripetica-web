"use server";

import { getOpsActor, actorCan } from "@/lib/ops/session";
import { getPartnerActor } from "@/lib/partner/session";
import { query } from "@/lib/db/postgres";
import { isUuid } from "@/lib/ops/process-filters";
import { unsealSecret } from "@/lib/security/sealed-secret";
import { getUetdsNotification } from "@/lib/uetds/notifications";
import { runObservedKamuLogin, type KamuPortalCompany } from "@/lib/uetds/kamu-login-flow";
import { type PortalLocation, type PortalTripTarget } from "@/lib/uetds/kamu-portal/edit-plan";
import { type PortalNextDraft } from "@/lib/uetds/ai-edit-snapshot";
import { readUnfinishedPortalSync } from "@/lib/uetds/ai-edit-target";
import { markAiEditPortalSyncFinished } from "@/lib/uetds/ai-edit-target-store";
import { type PortalEditPlan } from "@/lib/uetds/kamu-portal/live-update";
import { chromiumExecutable, openChromiumLoginControls } from "@/lib/uetds/kamu-login-browser";
import { openLiveBridgeControls } from "@/lib/uetds/kamu-login-live-bridge";
import {
  adoptKamuLoginSession,
  closeKamuLoginSession,
  inputKamuLoginSession,
  kamuAssistedLoginAllowed,
  kamuLoginNotificationId,
  openKamuLoginSession,
  rememberPortalEditPlan,
  progressKamuPortalUpdate,
  readKamuLoginSession,
  setKamuLoginControl,
  type KamuLoginControlMode,
  type KamuLoginSessionState,
  type KamuLoginViewport,
} from "@/lib/uetds/kamu-login-session";

export type KamuLoginFailureReason =
  | "browser_launch_failed"
  | "navigation_failed"
  | "login_page_failed"
  | "credential_resolution_failed"
  | "session_rejected"
  | "frame_failed";

export type KamuLoginActionResult =
  | { ok: true; state: KamuLoginSessionState }
  | { ok: false; error: "unavailable" | "forbidden" | "invalid"; reason?: KamuLoginFailureReason };

function kamuLoginFailureReason(error: unknown): KamuLoginFailureReason {
  const name = error instanceof Error ? error.name : "";
  const message = error instanceof Error ? error.message : "";
  if (/ENOENT|executable|Failed to launch|browserType\.launch/i.test(message)) return "browser_launch_failed";
  if (name === "TimeoutError" || /timeout|net::|ERR_/i.test(message)) return "navigation_failed";
  return "login_page_failed";
}

function logKamuLoginFailure(reason: KamuLoginFailureReason, error?: unknown) {
  const name = error instanceof Error ? error.name : "Error";
  console.error(`kamu_login_failed code=${reason} name=${name}`);
}

function browserLaunchCode(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (/user data directory/i.test(message)) return "user_data_dir";
  if (/ENOENT/i.test(message)) return "executable_missing";
  if (/shared librar|error while loading shared libraries/i.test(message)) return "missing_library";
  if (/sandbox/i.test(message)) return "sandbox";
  return "launch_failed";
}

function logBrowserLaunchFailure(error: unknown) {
  console.error(`kamu_browser_launch_failed executable=${chromiumExecutable()} code=${browserLaunchCode(error)}`);
}

function tripTargetFromSnapshot(snapshotJson: string): PortalTripTarget | null {
  try {
    const snapshot = JSON.parse(snapshotJson) as { trip?: Record<string, unknown>; vehicle?: Record<string, unknown>; ministry?: Record<string, unknown> };
    const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");
    const target = {
      startDate: text(snapshot.trip?.startDate),
      startTime: text(snapshot.trip?.startTime),
      endDate: text(snapshot.trip?.endDate),
      endTime: text(snapshot.trip?.endTime),
      plate: text(snapshot.vehicle?.plate),
      seferNumber: text(snapshot.ministry?.seferReferansNo),
    };
    if (!target.startDate || !target.startTime || !target.endDate || !target.endTime || !target.plate) return null;
    return target;
  } catch {
    return null;
  }
}

async function ownerKey() {
  if (!kamuAssistedLoginAllowed()) return null;
  const partner = await getPartnerActor();
  if (partner) return `partner:${partner.partnerId}:${partner.userId}`;
  const ops = await getOpsActor();
  if (ops && actorCan(ops, "uetds.manage")) return `ops:${ops.id}`;
  return null;
}

async function authoritySecrets(input: { authorityId: string; partnerId: string; companyId: string | null }) {
  const result = await query<{
    partner_id: string;
    first_name: string;
    last_name: string;
    identity_sealed: string;
    password_sealed: string;
    company_ids: string[] | null;
  }>(
    `SELECT a.partner_id, a.first_name, a.last_name, a.identity_sealed, a.password_sealed,
            COALESCE(array_agg(ac.company_id) FILTER (WHERE ac.company_id IS NOT NULL), '{}') AS company_ids
     FROM partner_uetds_authorities a
     LEFT JOIN partner_uetds_authority_companies ac ON ac.authority_id = a.id
     WHERE a.id = $1 AND a.partner_id = $2 AND a.deleted_at IS NULL AND a.status = 'active'
     GROUP BY a.id`,
    [input.authorityId, input.partnerId],
  );
  const row = result.rows[0];
  if (!row) return null;
  const companyIds = Array.isArray(row.company_ids) ? row.company_ids.map(String) : [];
  if (input.companyId && companyIds.length > 0 && !companyIds.includes(input.companyId)) return null;
  return {
    label: `${row.first_name} ${row.last_name}`.trim(),
    partnerId: row.partner_id,
    identity: unsealSecret(row.identity_sealed),
    password: unsealSecret(row.password_sealed),
  };
}

async function notificationCompany(companyId: string | null): Promise<KamuPortalCompany | null> {
  if (!companyId || !isUuid(companyId)) return null;
  const result = await query<{
    legal_name: string;
    short_name: string;
    tax_number: string;
    authority_document_type: string;
    authority_document_number: string;
  }>(
    `SELECT legal_name, short_name, tax_number, authority_document_type, authority_document_number
     FROM uetds_companies WHERE id = $1`,
    [companyId],
  );
  const row = result.rows[0];
  if (!row) return null;
  const documentType = row.authority_document_type === "D1" || row.authority_document_type === "D2" ? row.authority_document_type : "";
  return {
    legalName: row.legal_name,
    shortName: row.short_name,
    taxNumber: row.tax_number,
    authorityDocumentType: documentType,
    authorityDocumentNumber: row.authority_document_number,
  };
}

export async function startUetdsLoginSessionAction(input: {
  notificationId: string;
  authorityId: string;
  viewport?: KamuLoginViewport;
  nextDraft?: PortalNextDraft | null;
}): Promise<KamuLoginActionResult> {
  const owner = await ownerKey();
  if (!owner) return { ok: false, error: kamuAssistedLoginAllowed() ? "forbidden" : "unavailable", reason: "session_rejected" };
  if (!isUuid(input.notificationId) || !isUuid(input.authorityId)) return { ok: false, error: "invalid", reason: "session_rejected" };
  const partner = await getPartnerActor();
  const notification = await getUetdsNotification(
    partner ? { id: input.notificationId, partnerId: partner.partnerId } : { id: input.notificationId },
  );
  if (!notification) return { ok: false, error: "forbidden", reason: "session_rejected" };
  const live = await openLiveBridgeControls();
  if (
    live &&
    live.file.authorityId === input.authorityId &&
    live.file.partnerId === notification.partnerId &&
    live.file.notificationId === notification.id
  ) {
    const state = adoptKamuLoginSession({
      ownerKey: owner,
      notificationId: notification.id,
      authorityId: input.authorityId,
      viewport: live.viewport === "desktop" ? "desktop" : "mobile",
      contextId: live.file.contextId,
      phase: live.phase,
      controls: live.controls,
    });
    const plan = composePortalEditPlan(notification.snapshotJson, input.nextDraft ?? null);
    if (plan) rememberPortalEditPlan(state.sessionId, owner, plan);
    return { ok: true, state };
  }
  const secrets = await authoritySecrets({
    authorityId: input.authorityId,
    partnerId: notification.partnerId,
    companyId: notification.companyId,
  });
  if (!secrets) {
    logKamuLoginFailure("credential_resolution_failed");
    return { ok: false, error: "invalid", reason: "credential_resolution_failed" };
  }
  let identity = secrets.identity;
  let password = secrets.password;
  let controls: Awaited<ReturnType<typeof openChromiumLoginControls>> | null = null;
  try {
    const viewport = input.viewport === "desktop" ? "desktop" : "mobile";
    controls = await openChromiumLoginControls(viewport);
    const state = await openKamuLoginSession({
      ownerKey: owner,
      notificationId: notification.id,
      authorityId: input.authorityId,
      viewport,
      company: await notificationCompany(notification.companyId),
      tripTarget: (() => {
        const target = tripTargetFromSnapshot(notification.snapshotJson);
        const seferNumber = notification.ministryReference?.trim() || target?.seferNumber || "";
        return target ? { ...target, seferNumber } : null;
      })(),
      controls,
      login: (page) => runObservedKamuLogin(page, { identity, password }),
    });
    const plan = composePortalEditPlan(notification.snapshotJson, input.nextDraft ?? null);
    if (plan) rememberPortalEditPlan(state.sessionId, owner, plan);
    return { ok: true, state };
  } catch (error) {
    const reason = controls ? kamuLoginFailureReason(error) : "browser_launch_failed";
    logKamuLoginFailure(reason, error);
    if (reason === "browser_launch_failed") logBrowserLaunchFailure(error);
    await controls?.close();
    return { ok: false, error: "unavailable", reason };
  } finally {
    identity = "";
    password = "";
  }
}

function locationOf(value: unknown): PortalLocation {
  const row = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const text = (item: unknown) => (typeof item === "string" ? item.trim() : "");
  return {
    provinceName: text(row.provinceName),
    districtName: text(row.districtOrAirportName),
    placeName: text(row.placeName),
  };
}

function clip(value: unknown) {
  return (typeof value === "string" ? value.trim() : "").slice(0, 80);
}

function composePortalEditPlan(snapshotJson: string, next: PortalNextDraft | null): PortalEditPlan | null {
  const base = editPlanFromSnapshot(snapshotJson);
  if (!base || !next) return base;
  const location = (value: PortalNextDraft["pickup"] | undefined, fallback: PortalLocation): PortalLocation => ({
    provinceName: clip(value?.provinceName) || fallback.provinceName,
    districtName: clip(value?.districtName) || fallback.districtName,
    placeName: clip(value?.placeName),
  });
  const passengers = (Array.isArray(next.passengers) ? next.passengers : []).slice(0, base.oldPassengers.length).map((row, index) => {
    const gender = row?.gender === "male" || row?.gender === "female" ? row.gender : "";
    return {
      index: index + 1,
      nationality: clip(row?.nationality),
      documentNumber: clip(row?.documentNumber),
      firstName: clip(row?.firstName),
      lastName: clip(row?.lastName),
      gender,
    };
  });
  if (!passengers.length) return base;
  return {
    oldPickup: base.oldPickup,
    oldDropoff: base.oldDropoff,
    oldPassengers: base.oldPassengers,
    newPickup: location(next.pickup, base.newPickup),
    newDropoff: location(next.dropoff, base.newDropoff),
    newPassengers: passengers,
  };
}

function editPlanFromSnapshot(snapshotJson: string): PortalEditPlan | null {
  try {
    const snapshot = JSON.parse(snapshotJson) as { trip?: Record<string, unknown>; passengers?: unknown[] };
    const pickup = locationOf(snapshot.trip?.originLocation);
    const dropoff = locationOf(snapshot.trip?.destinationLocation);
    if (!pickup.provinceName || !pickup.districtName || !dropoff.provinceName || !dropoff.districtName) return null;
    const passengers = (Array.isArray(snapshot.passengers) ? snapshot.passengers : []).map((item, index) => {
      const row = item && typeof item === "object" ? item as Record<string, unknown> : {};
      const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");
      const gender = text(row.gender);
      return {
        index: index + 1,
        nationality: text(row.nationality),
        documentNumber: text(row.identityNumber),
        firstName: text(row.firstName),
        lastName: text(row.lastName),
        gender: gender === "male" || gender === "female" ? gender : "",
      };
    });
    const plan = { oldPickup: pickup, newPickup: pickup, oldDropoff: dropoff, newDropoff: dropoff, oldPassengers: passengers, newPassengers: passengers };
    const sync = readUnfinishedPortalSync(snapshot);
    if (!sync) return plan;
    return {
      ...plan,
      oldPickup: sync.pickup,
      oldDropoff: sync.dropoff,
      oldPassengers: sync.passengers,
    };
  } catch {
    return null;
  }
}

export async function readUetdsLoginSessionAction(sessionId: string): Promise<KamuLoginActionResult> {
  const owner = await ownerKey();
  if (!owner || !isUuid(sessionId)) return { ok: false, error: "forbidden" };
  const notificationId = kamuLoginNotificationId(sessionId, owner);
  let plan: PortalEditPlan | null = null;
  let notification: Awaited<ReturnType<typeof getUetdsNotification>> = null;
  if (notificationId) {
    const partner = await getPartnerActor();
    notification = await getUetdsNotification(
      partner ? { id: notificationId, partnerId: partner.partnerId } : { id: notificationId },
    );
    if (notification) plan = editPlanFromSnapshot(notification.snapshotJson);
  }
  const state = await progressKamuPortalUpdate(sessionId, owner, plan);
  if (state?.phase === "update_flow_complete" && !state.error && notification) {
    try {
      await markAiEditPortalSyncFinished(notification.id, notification.snapshotJson);
    } catch {
      // The saved TARGET stays either way. The retry marker can be cleared on the next successful read.
    }
  }
  if (!state) return { ok: false, error: "invalid" };
  return { ok: true, state };
}

export async function controlUetdsLoginSessionAction(input: {
  sessionId: string;
  control: KamuLoginControlMode;
}): Promise<KamuLoginActionResult> {
  const owner = await ownerKey();
  if (!owner || !isUuid(input.sessionId)) return { ok: false, error: "forbidden" };
  const state = await setKamuLoginControl({ sessionId: input.sessionId, ownerKey: owner, control: input.control });
  if (!state) return { ok: false, error: "invalid" };
  return { ok: true, state };
}

export async function inputUetdsLoginSessionAction(input: {
  sessionId: string;
  kind: "key" | "scroll" | "viewport" | "captcha";
  key?: string;
  direction?: "up" | "down";
  viewport?: KamuLoginViewport;
  captcha?: string;
}): Promise<KamuLoginActionResult> {
  const owner = await ownerKey();
  if (!owner || !isUuid(input.sessionId)) return { ok: false, error: "forbidden" };
  const allowedKeys = new Set(["Tab", "Enter", "Backspace"]);
  if (input.kind === "key" && (!input.key || (!allowedKeys.has(input.key) && !/^[0-9A-Za-z]$/.test(input.key)))) {
    return { ok: false, error: "invalid" };
  }
  if (input.kind === "captcha" && input.captcha != null && !/^[0-9A-Za-z]{0,8}$/.test(input.captcha)) {
    return { ok: false, error: "invalid" };
  }
  const state = await inputKamuLoginSession({ ...input, ownerKey: owner });
  if (!state) return { ok: false, error: "invalid" };
  return { ok: true, state };
}

export async function closeUetdsLoginSessionAction(sessionId: string): Promise<KamuLoginActionResult> {
  const owner = await ownerKey();
  if (!owner || !isUuid(sessionId)) return { ok: false, error: "forbidden" };
  const existing = readKamuLoginSession(sessionId, owner);
  await closeKamuLoginSession(sessionId, owner);
  if (!existing) return { ok: false, error: "invalid" };
  return { ok: true, state: { ...existing, phase: "closed" } };
}
