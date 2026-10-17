"use client";

import { useEffect, useState } from "react";
import {
  completeVehicleMaintenanceAction,
  correctVehicleMaintenanceAction,
  editVehicleMaintenanceAction,
  startVehicleMaintenanceAction,
} from "@/lib/gps/maintenance-actions";
import { type GpsCopy } from "@/lib/gps/copy";
import { GPS_LIVE_POLL_MS } from "@/lib/gps/live";
import {
  formatMaintenanceDate,
  formatMaintenanceDateTime,
  type MaintenanceError,
  type MaintenanceEventKind,
  type MaintenanceLocale,
  type MaintenanceSnapshot,
} from "@/lib/gps/maintenance";

function newKey() {
  return crypto.randomUUID();
}

function errorText(copy: GpsCopy, error: MaintenanceError) {
  if (error === "interval") return copy.maintenanceIntervalError;
  if (error === "future") return copy.maintenanceFuture;
  if (error === "order") return copy.maintenanceOrder;
  if (error === "exists") return copy.maintenanceExists;
  if (error === "forbidden") return copy.maintenanceForbidden;
  if (error === "conflict") return copy.maintenanceConflict;
  if (error === "failed" || error === "missing") return copy.maintenanceFailed;
  return copy.maintenanceInvalid;
}

function kindLabel(copy: GpsCopy, kind: MaintenanceEventKind) {
  if (kind === "service") return copy.maintenanceKindService;
  if (kind === "correction") return copy.maintenanceKindCorrection;
  if (kind === "edit") return copy.maintenanceKindEdit;
  return copy.maintenanceKindSetup;
}

function noticeLabel(copy: GpsCopy, thresholdKm: number) {
  if (thresholdKm > 0) return `${copy.maintenanceRemaining}: ${thresholdKm} ${copy.maintenanceKmUnit}`;
  if (thresholdKm === 0) return `${copy.maintenanceDue}: 0 ${copy.maintenanceKmUnit}`;
  return `${copy.maintenanceOverdue}: ${-thresholdKm} ${copy.maintenanceKmUnit}`;
}

export function GpsMaintenancePanel({
  vehicleId,
  copy,
  locale,
  maintenanceUrl,
  portalActor = "partner",
}: {
  vehicleId: string;
  copy: GpsCopy;
  locale: MaintenanceLocale;
  maintenanceUrl?: string;
  portalActor?: "partner" | "driver";
}) {
  const [snapshot, setSnapshot] = useState<MaintenanceSnapshot | null>(null);
  const [mode, setMode] = useState<"view" | "update" | "confirm" | "edit">("view");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState(newKey);

  useEffect(() => {
    let stopped = false;
    let timer = 0;
    async function pull() {
      try {
        const response = await fetch(`${maintenanceUrl ?? "/api/gps/maintenance"}/${vehicleId}?locale=${locale}`, {
          headers: { Accept: "application/json" },
          cache: "no-store",
        });
        if (!response.ok) return;
        const body = await response.json() as MaintenanceSnapshot;
        if (!stopped && body && typeof body === "object" && "started" in body) setSnapshot(body);
      } catch {
        return;
      } finally {
        if (!stopped) timer = window.setTimeout(() => void pull(), GPS_LIVE_POLL_MS);
      }
    }
    void pull();
    return () => {
      stopped = true;
      window.clearTimeout(timer);
    };
  }, [locale, maintenanceUrl, vehicleId]);

  async function submit(action: (formData: FormData) => Promise<{ ok: true; snapshot: MaintenanceSnapshot } | { ok: false; error: MaintenanceError }>, formData: FormData) {
    setPending(true);
    setError(null);
    const result = await action(formData);
    setPending(false);
    if (!result.ok) {
      setError(errorText(copy, result.error));
      if (result.error === "conflict") setIdempotencyKey(newKey());
      return;
    }
    setSnapshot(result.snapshot);
    setMode("view");
    setIdempotencyKey(newKey());
  }

  if (!snapshot) return <p className="gps-inline-note">{copy.maintenanceLoading}</p>;

  if (!snapshot.started) {
    return (
      <form className="gps-maintenance-form" action={(formData) => void submit(startVehicleMaintenanceAction, formData)}>
        <input type="hidden" name="vehicleId" value={vehicleId} />
        {portalActor === "driver" ? <input type="hidden" name="actor" value="driver" /> : null}
        <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
        <input type="hidden" name="today" value={snapshot.today} />
        <label className="ops-field">
          {copy.maintenanceStartKm}
          <input name="startKm" inputMode="numeric" autoComplete="off" required />
        </label>
        <fieldset className="gps-maintenance-pair">
          <legend>{copy.maintenancePreviousGroup}</legend>
          <label className="ops-field">
            {copy.maintenancePreviousKm}
            <input name="previousKm" inputMode="numeric" autoComplete="off" required />
          </label>
          <label className="ops-field">
            {copy.maintenancePreviousOn}
            <input name="previousOn" type="date" required />
          </label>
        </fieldset>
        <label className="ops-field">
          {copy.maintenanceInterval}
          <input name="intervalKm" inputMode="numeric" autoComplete="off" required />
        </label>
        {error ? <p className="gps-inline-note" role="alert">{error}</p> : null}
        <div className="gps-maintenance-actions">
          <button type="submit" className="ops-btn-primary" disabled={pending}>{copy.maintenanceSaveStart}</button>
        </div>
      </form>
    );
  }

  const active = snapshot;
  const lineLabel = active.line === "overdue" ? copy.maintenanceOverdue : active.line === "due" ? copy.maintenanceDue : copy.maintenanceRemaining;
  const lineKm = active.line === "overdue" ? -active.remainingKm : active.remainingKm;

  return (
    <div className="gps-maintenance">
      <p className="gps-maintenance-kicker">{copy.maintenanceEstimated}</p>
      <p className="gps-maintenance-km">{active.estimatedKm} {copy.maintenanceKmUnit}</p>
      <dl className="gps-facts">
        <div><dt>{copy.maintenanceStartLabel}</dt><dd>{active.startKm} {copy.maintenanceKmUnit}</dd></div>
        <div><dt>{copy.maintenanceVerified}</dt><dd>{active.verifiedKm} {copy.maintenanceKmUnit}</dd></div>
        <div><dt>{copy.maintenanceVerifiedAt}</dt><dd>{formatMaintenanceDateTime(active.verifiedAt, locale)}</dd></div>
        <div><dt>{copy.maintenanceLastKm}</dt><dd>{active.lastServiceKm} {copy.maintenanceKmUnit}</dd></div>
        <div><dt>{copy.maintenanceLastOn}</dt><dd>{formatMaintenanceDate(active.lastServiceOn, locale)}</dd></div>
        <div><dt>{copy.maintenanceIntervalLabel}</dt><dd>{active.intervalKm} {copy.maintenanceKmUnit}</dd></div>
        <div><dt>{copy.maintenanceNext}</dt><dd>{active.nextServiceKm} {copy.maintenanceKmUnit}</dd></div>
        <div><dt>{lineLabel}</dt><dd>{lineKm} {copy.maintenanceKmUnit}</dd></div>
      </dl>
      <p className="gps-maintenance-note">{copy.maintenanceDisclaimer}</p>
      {active.gap ? <p className="gps-maintenance-note">{copy.maintenanceGap}</p> : null}
      {mode === "view" ? (
        <div className="gps-maintenance-actions">
          <button type="button" className="ops-btn-secondary" onClick={() => { setError(null); setMode("update"); }}>{copy.maintenanceUpdate}</button>
          <button type="button" className="ops-btn-primary" onClick={() => { setError(null); setMode("confirm"); }}>{copy.maintenanceComplete}</button>
          <button type="button" className="ops-btn-secondary" onClick={() => { setError(null); setMode("edit"); }}>{copy.maintenanceEdit}</button>
        </div>
      ) : null}
      {mode === "update" ? (
        <form className="gps-maintenance-form" action={(formData) => void submit(correctVehicleMaintenanceAction, formData)}>
          <input type="hidden" name="vehicleId" value={vehicleId} />
        {portalActor === "driver" ? <input type="hidden" name="actor" value="driver" /> : null}
          <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
          <label className="ops-field">
            {copy.maintenanceUpdateKm}
            <input name="odometerKm" inputMode="numeric" autoComplete="off" required defaultValue={String(active.estimatedKm)} />
          </label>
          {error ? <p className="gps-inline-note" role="alert">{error}</p> : null}
          <div className="gps-maintenance-actions">
            <button type="submit" className="ops-btn-primary" disabled={pending}>{copy.maintenanceUpdateSave}</button>
            <button type="button" className="ops-btn-secondary" onClick={() => { setError(null); setMode("view"); }}>{copy.maintenanceConfirmCancel}</button>
          </div>
        </form>
      ) : null}
      {mode === "confirm" ? (
        <form className="gps-maintenance-form" action={(formData) => void submit(completeVehicleMaintenanceAction, formData)}>
          <input type="hidden" name="vehicleId" value={vehicleId} />
        {portalActor === "driver" ? <input type="hidden" name="actor" value="driver" /> : null}
          <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
          <input type="hidden" name="expectedKm" value={String(active.estimatedKm)} />
          <input type="hidden" name="expectedDate" value={active.today} />
          <p className="gps-maintenance-note">{copy.maintenanceConfirm}</p>
          <dl className="gps-facts">
            <div><dt>{copy.maintenanceLastKm}</dt><dd>{active.estimatedKm} {copy.maintenanceKmUnit}</dd></div>
            <div><dt>{copy.maintenanceLastOn}</dt><dd>{formatMaintenanceDate(active.today, locale)}</dd></div>
            <div><dt>{copy.maintenanceNext}</dt><dd>{active.estimatedKm + active.intervalKm} {copy.maintenanceKmUnit}</dd></div>
          </dl>
          {error ? <p className="gps-inline-note" role="alert">{error}</p> : null}
          <div className="gps-maintenance-actions">
            <button type="submit" className="ops-btn-primary" disabled={pending}>{copy.maintenanceConfirmSave}</button>
            <button type="button" className="ops-btn-secondary" onClick={() => { setError(null); setMode("view"); }}>{copy.maintenanceConfirmCancel}</button>
          </div>
        </form>
      ) : null}
      {mode === "edit" ? (
        <form className="gps-maintenance-form" action={(formData) => void submit(editVehicleMaintenanceAction, formData)}>
          <input type="hidden" name="vehicleId" value={vehicleId} />
        {portalActor === "driver" ? <input type="hidden" name="actor" value="driver" /> : null}
          <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
          <label className="ops-field">
            {copy.maintenanceLastKm}
            <input name="lastServiceKm" inputMode="numeric" autoComplete="off" required defaultValue={String(active.lastServiceKm)} />
          </label>
          <label className="ops-field">
            {copy.maintenanceLastOn}
            <input name="lastServiceOn" type="date" required defaultValue={active.lastServiceOn} />
          </label>
          <label className="ops-field">
            {copy.maintenanceIntervalLabel}
            <input name="intervalKm" inputMode="numeric" autoComplete="off" required defaultValue={String(active.intervalKm)} />
          </label>
          {error ? <p className="gps-inline-note" role="alert">{error}</p> : null}
          <div className="gps-maintenance-actions">
            <button type="submit" className="ops-btn-primary" disabled={pending}>{copy.maintenanceEditSave}</button>
            <button type="button" className="ops-btn-secondary" onClick={() => { setError(null); setMode("view"); }}>{copy.maintenanceConfirmCancel}</button>
          </div>
        </form>
      ) : null}
      <div className="gps-maintenance-actions">
        <button type="button" className="ops-btn-secondary" aria-expanded={historyOpen} onClick={() => setHistoryOpen((open) => !open)}>
          {historyOpen ? copy.maintenanceHistoryHide : copy.maintenanceHistoryShow}
        </button>
      </div>
      {historyOpen ? (
        active.history.length === 0 ? <p className="gps-inline-note">{copy.maintenanceHistoryEmpty}</p> : (
          <ul className="gps-maintenance-history">
            {active.history.map((item) => (
              <li key={item.id}>
                <strong>{kindLabel(copy, item.kind)}</strong>
                {` · ${item.odometerKm} ${copy.maintenanceKmUnit}`}
                {item.serviceOn ? ` · ${formatMaintenanceDate(item.serviceOn, locale)}` : ""}
                {item.actorEmail ? ` · ${item.actorEmail}` : ""}
                {` · ${formatMaintenanceDateTime(item.createdAt, locale)}`}
              </li>
            ))}
          </ul>
        )
      ) : null}
      {active.notices.length > 0 ? (
        <div className="gps-maintenance-notices">
          <h3>{copy.maintenanceNotices}</h3>
          <ul className="gps-maintenance-history">
            {active.notices.map((notice) => (
              <li key={`${notice.thresholdKm}-${notice.createdAt}`}>
                {portalActor === "driver" && notice.driverBody ? (
                  <>
                    <strong>{notice.driverTitle}</strong>
                    <span className="gps-inline-note" style={{ whiteSpace: "pre-line", display: "block" }}>{notice.driverBody}</span>
                  </>
                ) : (
                  <>
                    {noticeLabel(copy, notice.thresholdKm)}
                    {` · ${formatMaintenanceDateTime(notice.createdAt, locale)}`}
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
