import { queueGpsWifiAction, revokeGpsDeviceTokenAction, setGpsDeviceStatusAction, updateGpsImeiAction } from "@/lib/gps/actions";
import { commandAuditState, type GpsAuditState } from "@/lib/gps/commands";
import { GPS_WIFI_MAX_CLIENTS_MAX, GPS_WIFI_MAX_CLIENTS_MIN } from "@/lib/gps/contract";
import { gpsErrorText, type GpsCopy } from "@/lib/gps/copy";
import { gpsClock } from "@/lib/gps/format";
import { type GpsLiveSnapshot } from "@/lib/gps/live";
import { type GpsCommandView, type GpsDeviceListItem, type GpsRoutePoint, type GpsVehicleChoice } from "@/lib/gps/queries";
import { type Locale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/path";
import Form from "next/form";
import { type ReactNode } from "react";
import { GpsCameraLive } from "@/components/gps/camera-live";
import { cameraIdlePhase } from "@/lib/gps/camera";
import { gpsPresence } from "@/lib/gps/presence";
import { GpsDeviceAssignmentForm } from "@/components/gps/device-assignment-form";
import { GpsDeviceDelete } from "@/components/gps/device-delete";
import { GpsRebootControl } from "@/components/gps/reboot-control";
import { loadGpsAtsPanel } from "@/lib/gps/ats-control";
import { GpsHistoryPlayback } from "@/components/gps/history-playback";
import { GpsLiveSection } from "@/components/gps/live-section";
import { type GpsFleetVehicle } from "@/lib/gps/fleet";
import { GpsRemoteCommands } from "@/components/gps/remote-commands";
import { GpsTokenRotateForm } from "@/components/gps/token-rotate-form";

export async function GpsDeviceWorkspace({
  locale,
  copy,
  surface,
  device,
  vehicles,
  partners = [],
  assignments = [],
  route,
  commands,
  fromLocal,
  toLocal,
  fromIso,
  toIso,
  error,
  canManage,
  canDelete = false,
  showDeviceList,
  viewerId,
  fleetVehicles,
  historyPath,
  rangeSearch = "",
}: {
  locale: Locale;
  copy: GpsCopy;
  surface: "ops" | "partner";
  device: GpsDeviceListItem | null;
  vehicles: GpsVehicleChoice[];
  partners?: { id: string; partner_code: string; name: string }[];
  assignments?: { assignedAt: string; partnerName: string | null; partnerCode: string | null; plate: string | null }[];
  route: { total: number; step: number; points: GpsRoutePoint[] };
  commands: GpsCommandView[];
  fromLocal: string;
  toLocal: string;
  fromIso: string;
  toIso: string;
  error?: string;
  canManage: boolean;
  canDelete?: boolean;
  showDeviceList: boolean;
  viewerId: string;
  fleetVehicles?: GpsFleetVehicle[];
  historyPath?: string;
  rangeSearch?: string;
}) {
  const listPath = localizedPath(locale, surface === "ops" ? "/ops/gps" : "/partner/gps");
  if (!device) {
    return (
      <div className="gps-screen">
        <GpsLiveSection
          copy={copy}
          listPath={listPath}
          plate={null}
          deviceCode=""
          deviceId=""
          surface={surface}
          initial={emptyGpsSnapshot()}
          imei={null}
          status="active"
          company={null}
          partnerLabel={null}
          wifiMode="off"
          canToggleWifi={false}
          showDeviceList={false}
          viewerId={viewerId}
          historyQuery=""
          awaitingPick
          fleetVehicles={fleetVehicles}
          selectedVehicleId={null}
          rangeSearch={rangeSearch}
          gps={null}
          wifi={<p className="gps-inline-note">{copy.fleetPick}</p>}
          camera={<p className="gps-inline-note">{copy.fleetPick}</p>}
        />
      </div>
    );
  }
  const detailPath = historyPath ?? localizedPath(locale, `${surface === "ops" ? "/ops/gps" : "/partner/gps"}/${device.id}`);
  const initialLive: GpsLiveSnapshot = {
    seq: device.ackedThrough,
    recordedAt: device.recordedAt,
    latitude: device.latitude,
    longitude: device.longitude,
    speedMps: device.speedMps,
    headingDeg: device.headingDeg,
    satellites: device.satellites,
    gnssFix: device.gnssFix,
    lastHeartbeatAt: device.lastHeartbeatAt,
    firmware: device.firmware,
    rssi: device.rssi,
    operatorName: device.operatorName,
    network: device.network,
    uptimeSeconds: device.uptimeSeconds,
    simStatus: device.simStatus,
    lteRegistration: device.lteRegistration,
    pppStatus: device.pppStatus,
    naptStatus: device.naptStatus,
    ipAddress: device.ipAddress,
    gnssResponse: device.gnssResponse,
    wifiPolicy: device.wifiPolicy,
    apStatus: device.apStatus,
    wifiClients: device.wifiClients,
    reportedMaxClients: device.reportedMaxClients,
    lastRecoveryReason: device.lastRecoveryReason,
    lastModemRecoveryAt: device.lastModemRecoveryAt,
    lastGnssRecoveryAt: device.lastGnssRecoveryAt,
    resetReason: device.resetReason,
    powerSource: device.powerSource,
    vehicleBatteryVoltage: device.vehicleBatteryVoltage,
    accState: device.accState,
    powerMode: device.powerMode,
    batteryPercent: device.batteryPercent,
    wifiEnabled: device.reportedWifiEnabled,
    wifiShareCommand: null,
    lowBatteryState: device.lowBatteryState,
    lowBatteryGraceRemainingSeconds: device.lowBatteryGraceRemainingSeconds,
  };
  const errorText = gpsErrorText(copy, error);
  const panels = gpsWorkspacePanels({
    locale,
    copy,
    surface,
    device,
    route,
    fromLocal,
    toLocal,
    fromIso,
    toIso,
    errorText,
    canManage,
    historyPath: detailPath,
    includeVehicle: Boolean(fleetVehicles && fleetVehicles.length > 1),
  });

  return (
    <div className="gps-screen">
      <GpsLiveSection
        copy={copy}
        listPath={listPath}
        plate={device.plate}
        deviceCode={device.deviceCode}
        deviceId={device.id}
        surface={surface}
        initial={initialLive}
        imei={device.imei}
        status={device.status}
        company={device.uetdsCompany}
        partnerLabel={surface === "ops" ? (device.partnerCode ? `${device.partnerCode} · ${device.partnerName}` : copy.stock) : null}
        wifiMode={device.wifiMode}
        canToggleWifi={(surface === "partner" || canManage) && Boolean(device.partnerId)}
        showDeviceList={showDeviceList}
        viewerId={viewerId}
        historyQuery={`${fromIso}|${toIso}`}
        fleetVehicles={fleetVehicles}
        selectedVehicleId={device.id}
        rangeSearch={rangeSearch}
        gps={panels.gps}
        wifi={panels.wifi}
        camera={panels.camera}
        ats={surface === "ops" ? await loadGpsAtsPanel(device.id) : null}
        canControlAts={surface === "ops" && canManage}
      />

      {surface === "ops" && canManage ? (
        <section className="gps-section">
          <h2>{copy.inventory}</h2>
          <dl className="gps-facts">
            <div><dt>{copy.deviceId}</dt><dd>{device.deviceCode}</dd></div>
            <div><dt>{copy.imei}</dt><dd>{device.imei ?? copy.unavailable}</dd></div>
            <div><dt>{copy.partner}</dt><dd>{device.partnerName || copy.stock}</dd></div>
            <div><dt>{copy.vehicle}</dt><dd>{device.plate ?? copy.unassigned}</dd></div>
            <div><dt>{copy.status}</dt><dd>{device.status === "active" ? copy.active : copy.disabled}</dd></div>
            <div><dt>{copy.heartbeat}</dt><dd>{gpsClock(device.lastHeartbeatAt)}</dd></div>
            <div><dt>{copy.gnssTime}</dt><dd>{gpsClock(device.recordedAt)}</dd></div>
            <div><dt>{copy.popupCoordinates}</dt><dd>{device.latitude === null || device.longitude === null ? copy.unavailable : `${device.latitude.toFixed(6)}, ${device.longitude.toFixed(6)}`}</dd></div>
            <div><dt>{copy.firmware}</dt><dd>{device.firmware ?? copy.unavailable}</dd></div>
            <div><dt>{copy.credential}</dt><dd>{credentialLabel(copy, device.credentialState)}</dd></div>
            <div><dt>{copy.createdAt}</dt><dd>{gpsClock(device.createdAt)}</dd></div>
          </dl>
          <form action={updateGpsImeiAction} className="gps-inline">
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="deviceId" value={device.id} />
            <label>
              <span>{copy.imei}</span>
              <input name="imei" inputMode="numeric" autoComplete="off" defaultValue={device.imei ?? ""} />
            </label>
            <button type="submit" className="ops-btn">{copy.save}</button>
          </form>
          <GpsDeviceAssignmentForm
            locale={locale}
            copy={copy}
            deviceId={device.id}
            partnerId={device.partnerId}
            vehicleId={device.vehicleId}
            partners={partners}
            vehicles={vehicles}
          />
          {assignments.length > 0 ? (
            <div className="ops-table-wrap">
              <table className="ops-table">
                <thead>
                  <tr>
                    <th>{copy.assignment}</th>
                    <th>{copy.partner}</th>
                    <th>{copy.vehicle}</th>
                  </tr>
                </thead>
                <tbody>
                  {assignments.map((row) => (
                    <tr key={row.assignedAt}>
                      <td>{gpsClock(row.assignedAt)}</td>
                      <td>{row.partnerCode ? `${row.partnerCode} · ${row.partnerName}` : copy.stock}</td>
                      <td>{row.plate ?? copy.unassigned}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          <form action={setGpsDeviceStatusAction}>
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="deviceId" value={device.id} />
            <input type="hidden" name="status" value={device.status === "active" ? "disabled" : "active"} />
            <button type="submit" className="ops-btn-ghost">{device.status === "active" ? copy.disable : copy.enable}</button>
          </form>
          <GpsTokenRotateForm locale={locale} copy={copy} deviceId={device.id} />
          <form action={revokeGpsDeviceTokenAction}>
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="deviceId" value={device.id} />
            <button type="submit" className="ops-btn-ghost" disabled={device.credentialState !== "active"}>{copy.revoke}</button>
          </form>
        </section>
      ) : null}

      {surface === "ops" && canManage && device.partnerId ? (
        <section className="gps-section">
          <h2>{copy.remote}</h2>
          <GpsRemoteCommands locale={locale} copy={copy} deviceId={device.id} />
        </section>
      ) : null}

      {surface === "ops" ? <CommandAudit copy={copy} commands={commands} /> : null}
      {canDelete ? (
        <GpsDeviceDelete locale={locale} copy={copy} device={device} used={error === "device_used"} />
      ) : null}
    </div>
  );
}

export function gpsWorkspacePanels({
  locale,
  copy,
  surface,
  device,
  route,
  fromLocal,
  toLocal,
  fromIso,
  toIso,
  errorText,
  canManage,
  historyPath,
  includeVehicle = false,
}: {
  locale: Locale;
  copy: GpsCopy;
  surface: "ops" | "partner";
  device: GpsDeviceListItem;
  route: { total: number; step: number; points: GpsRoutePoint[] };
  fromLocal: string;
  toLocal: string;
  fromIso: string;
  toIso: string;
  errorText?: string;
  canManage: boolean;
  historyPath: string;
  includeVehicle?: boolean;
}): { gps: ReactNode; wifi: ReactNode; camera: ReactNode } {
  return {
    gps: (
      <>
        {errorText ? <p className="ops-form-error">{errorText}</p> : null}
        <h2>{copy.route}</h2>
        <Form className="gps-range" action={historyPath} scroll={false}>
          {includeVehicle ? <input type="hidden" name="vehicle" value={device.id} /> : null}
          <div className="gps-range-fields">
            <label>
              <span>{copy.from}</span>
              <span className="gps-range-picker">
                <input type="datetime-local" name="from" defaultValue={fromLocal} required />
                <span className="gps-range-chevron" aria-hidden="true" />
              </span>
            </label>
            <label>
              <span>{copy.to}</span>
              <span className="gps-range-picker">
                <input type="datetime-local" name="to" defaultValue={toLocal} required />
                <span className="gps-range-chevron" aria-hidden="true" />
              </span>
            </label>
          </div>
          <button type="submit" className="gps-range-submit">{copy.showRoute}</button>
        </Form>
        {route.total === 0 ? <p>{copy.routeEmpty}</p> : (
          <>
            {surface === "ops" && route.step > 1 ? <p>{copy.routeSampled} ({route.points.length}/{route.total})</p> : null}
            <GpsHistoryPlayback
              key={`${device.id}:${fromIso}:${toIso}`}
              deviceId={device.id}
              plate={device.plate ?? copy.unassigned}
              points={route.points}
              fromIso={fromIso}
              toIso={toIso}
              copy={copy}
            />
          </>
        )}
      </>
    ),
    wifi: (
      <>
        <dl className="gps-facts">
          <div><dt>{copy.lte}</dt><dd>{device.lteRegistration ?? device.network ?? copy.unavailable}</dd></div>
          <div><dt>{copy.ssid}</dt><dd>{device.reportedWifiSsid ?? copy.unavailable}</dd></div>
          <div><dt>{copy.clients}</dt><dd>{device.wifiClients === null ? copy.unavailable : String(device.wifiClients)}</dd></div>
          <div><dt>{copy.maxClients}</dt><dd>{device.reportedMaxClients === null ? copy.unavailable : String(device.reportedMaxClients)}</dd></div>
          <div><dt>{copy.password}</dt><dd>{device.wifiPasswordSet ? copy.passwordSet : copy.passwordMissing}</dd></div>
        </dl>
        {(canManage || surface === "partner") && device.partnerId ? (
          <>
            <form action={queueGpsWifiAction} className="gps-form">
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="deviceId" value={device.id} />
              <input type="hidden" name="surface" value={surface} />
              {surface === "ops" ? (
                <label>
                  <span>{copy.mode}</span>
                  <select name="mode" defaultValue={device.wifiMode}>
                    <option value="on">{copy.modeOn}</option>
                    <option value="off">{copy.modeOff}</option>
                    <option value="auto">{copy.modeAuto}</option>
                  </select>
                </label>
              ) : null}
              <label>
                <span>{copy.ssid}</span>
                <input name="ssid" defaultValue={device.wifiSsid ?? ""} maxLength={32} autoComplete="off" />
              </label>
              <label>
                <span>{copy.password}</span>
                <input name="password" type="password" autoComplete="new-password" />
              </label>
              <p className="gps-hint">{copy.passwordHint}</p>
              <label>
                <span>{copy.maxClients}</span>
                <input name="maxClients" type="number" min={GPS_WIFI_MAX_CLIENTS_MIN} max={GPS_WIFI_MAX_CLIENTS_MAX} defaultValue={device.wifiMaxClients} required />
              </label>
              <button type="submit" className="ops-btn">{copy.queueWifi}</button>
            </form>
            <GpsRebootControl
              locale={locale}
              deviceId={device.id}
              surface={surface}
              label={copy.rebootDevice}
              confirm={copy.confirmReboot}
            />
          </>
        ) : null}
      </>
    ),
    camera: (
      <GpsCameraLive
        copy={copy}
        deviceId={device.id}
        surface={surface}
        initialLowBatteryState={device.lowBatteryState}
        initialBatteryPercent={device.batteryPercent}
        initialPhase={cameraIdlePhase({
          presence: gpsPresence(device.lastHeartbeatAt, new Date()),
          cameraAvailable: device.cameraAvailable,
          cameraReady: device.cameraReady,
        })}
      />
    ),
  };
}

function CommandAudit({ copy, commands }: { copy: GpsCopy; commands: GpsCommandView[] }) {
  return (
    <section className="gps-section">
      <h2>{copy.audit}</h2>
      {commands.length === 0 ? <p>{copy.commandsEmpty}</p> : (
        <div className="ops-table-wrap">
          <table className="ops-table">
            <thead>
              <tr>
                <th>{copy.audit}</th>
                <th>{copy.remote}</th>
                <th>{copy.actor}</th>
                <th>{copy.seen}</th>
                <th>{copy.commandError}</th>
              </tr>
            </thead>
            <tbody>
              {commands.map((command) => (
                <tr key={command.id}>
                  <td>{commandStatusLabel(copy, commandAuditState(command.status, command.error))}</td>
                  <td>{command.kind}{command.ssid ? ` · ${command.ssid}` : ""}{command.maxClients ? ` · ${command.maxClients}` : ""}{command.intervalSeconds ? ` · ${command.intervalSeconds}s` : ""}</td>
                  <td>{command.actorLabel ?? command.createdBy}</td>
                  <td>{gpsClock(command.createdAt)}</td>
                  <td>{command.error ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function modeLabel(copy: GpsCopy, mode: "on" | "off" | "auto") {
  if (mode === "on") return copy.modeOn;
  if (mode === "auto") return copy.modeAuto;
  return copy.modeOff;
}

function commandStatusLabel(copy: GpsCopy, state: GpsAuditState) {
  if (state === "PENDING") return copy.commandPending;
  if (state === "DELIVERED") return copy.commandDelivered;
  if (state === "SUCCESS") return copy.commandApplied;
  if (state === "EXPIRED") return copy.commandExpired;
  if (state === "CANCELLED") return copy.commandCancelled;
  return copy.commandFailed;
}

function emptyGpsSnapshot(): GpsLiveSnapshot {
  return {
    seq: 0,
    recordedAt: null,
    latitude: null,
    longitude: null,
    speedMps: null,
    headingDeg: null,
    satellites: null,
    gnssFix: null,
    lastHeartbeatAt: null,
    firmware: null,
    rssi: null,
    operatorName: null,
    network: null,
    uptimeSeconds: null,
    simStatus: null,
    lteRegistration: null,
    pppStatus: null,
    naptStatus: null,
    ipAddress: null,
    gnssResponse: null,
    wifiPolicy: null,
    apStatus: null,
    wifiClients: null,
    reportedMaxClients: null,
    lastRecoveryReason: null,
    lastModemRecoveryAt: null,
    lastGnssRecoveryAt: null,
    resetReason: null,
    powerSource: null,
    vehicleBatteryVoltage: null,
    accState: null,
    powerMode: null,
    batteryPercent: null,
    wifiEnabled: null,
    wifiShareCommand: null,
    lowBatteryState: null,
    lowBatteryGraceRemainingSeconds: null,
  };
}

function credentialLabel(copy: GpsCopy, state: "active" | "revoked" | "missing") {
  if (state === "active") return copy.credentialActive;
  if (state === "revoked") return copy.credentialRevoked;
  return copy.credentialMissing;
}
