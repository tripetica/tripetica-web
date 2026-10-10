import { revokeGpsDeviceTokenAction, setGpsDeviceStatusAction, updateGpsImeiAction } from "@/lib/gps/actions";
import { commandAuditState, type GpsAuditState } from "@/lib/gps/commands";
import { gpsErrorText, type GpsCopy } from "@/lib/gps/copy";
import { gpsClock } from "@/lib/gps/format";
import { type GpsLiveSnapshot } from "@/lib/gps/live";
import { listGpsRecentFixes, type GpsCommandView, type GpsDeviceListItem, type GpsRoutePoint, type GpsVehicleChoice } from "@/lib/gps/queries";
import { type Locale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/path";
import { GpsDeviceAssignmentForm } from "@/components/gps/device-assignment-form";
import { GpsDeviceDelete } from "@/components/gps/device-delete";
import { loadGpsAtsPanel } from "@/lib/gps/ats-control";
import { GpsLiveSection } from "@/components/gps/live-section";
import { type GpsFleetVehicle } from "@/lib/gps/fleet";
import { GpsRemoteCommands } from "@/components/gps/remote-commands";
import { GpsTokenRotateForm } from "@/components/gps/token-rotate-form";
import { loadImmobilizerPanel } from "@/lib/teltonika/immobilizer-store";

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
  deviceControls = true,
  mobileFocus = null,
  shareEvents = [],
  sharePreset = "week",
  shareFromLocal = "",
  shareToLocal = "",
  mobileRoute = null,
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
  deviceControls?: boolean;
  mobileFocus?: GpsFleetVehicle | null;
  shareEvents?: { id: string; kind: string; createdAt: string }[];
  sharePreset?: "today" | "yesterday" | "3d" | "week" | "range";
  shareFromLocal?: string;
  shareToLocal?: string;
  mobileRoute?: { total: number; step: number; points: { id: string; recordedAt: string; latitude: number; longitude: number; speedMps: number | null; headingDeg: number | null }[] } | null;
}) {
  const listPath = `${localizedPath(locale, surface === "ops" ? "/ops/gps" : "/partner/gps")}${surface === "ops" && showDeviceList ? "?tab=devices" : ""}`;
  const recentByDevice = await listGpsRecentFixes([
    device?.id ?? "",
    ...(fleetVehicles?.filter((vehicle) => vehicle.source !== "mobile").map((vehicle) => vehicle.id) ?? []),
  ]);
  const fleetWithMotion = fleetVehicles?.map((vehicle) => ({
    ...vehicle,
    recent: vehicle.source === "mobile" ? vehicle.recent ?? [] : recentByDevice.get(vehicle.id) ?? [],
  }));
  if (!device) {
    return (
      <div className="gps-screen">
        <GpsLiveSection
          copy={copy}
          listPath={listPath}
          plate={mobileFocus?.plate ?? null}
          deviceCode={mobileFocus?.driverName ?? ""}
          deviceId={mobileFocus?.id ?? ""}
          surface={surface}
          initial={{
            ...emptyGpsSnapshot(),
            recordedAt: mobileFocus?.recordedAt ?? null,
            latitude: mobileFocus?.latitude ?? null,
            longitude: mobileFocus?.longitude ?? null,
            speedMps: mobileFocus?.speedMps ?? null,
            headingDeg: mobileFocus?.headingDeg ?? null,
            gnssFix: mobileFocus ? true : null,
            lastHeartbeatAt: mobileFocus?.lastHeartbeatAt ?? null,
            recent: mobileFocus?.recent ?? [],
          }}
          imei={null}
          status="active"
          company={null}
          partnerLabel={null}
          wifiMode="off"
          canToggleWifi={false}
          showDeviceList={false}
          viewerId={viewerId}
          historyQuery=""
          awaitingPick={!mobileFocus}
          fleetVehicles={fleetWithMotion}
          selectedVehicleId={mobileFocus?.id ?? null}
          rangeSearch={rangeSearch}
          shareEvents={shareEvents}
          sharePreset={sharePreset}
          shareFromLocal={shareFromLocal}
          shareToLocal={shareToLocal}
          history={mobileFocus ? {
            mode: "mobile",
            plate: mobileFocus.plate,
            vehicleId: mobileFocus.id,
            points: mobileRoute?.points ?? [],
            fromLocal,
            toLocal,
            fromIso,
            toIso,
            historyPath: listPath,
          } : null}
          wifi={null}
          camera={null}
          deviceControls={deviceControls}
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
    recent: recentByDevice.get(device.id) ?? [],
  };
  const errorText = gpsErrorText(copy, error);

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
        canToggleWifi={deviceControls && (surface === "partner" || canManage) && Boolean(device.partnerId)}
        deviceControls={deviceControls}
        showDeviceList={showDeviceList}
        viewerId={viewerId}
        historyQuery={`${fromIso}|${toIso}`}
        fleetVehicles={fleetWithMotion}
        selectedVehicleId={device.id}
        rangeSearch={rangeSearch}
        shareEvents={shareEvents}
        sharePreset={sharePreset}
        shareFromLocal={shareFromLocal}
        shareToLocal={shareToLocal}
        history={{
          mode: "device",
          locale,
          surface,
          deviceId: device.id,
          plate: device.plate,
          points: route.points,
          total: route.total,
          step: route.step,
          fromLocal,
          toLocal,
          fromIso,
          toIso,
          errorText,
          historyPath: detailPath,
          includeVehicle: Boolean(fleetVehicles && fleetVehicles.length > 1),
        }}
        wifi={null}
        camera={null}
        wifiDevice={deviceControls ? {
          locale,
          deviceId: device.id,
          surface,
          canManage,
          partnerId: device.partnerId,
          lte: device.lteRegistration ?? device.network,
          reportedSsid: device.reportedWifiSsid,
          clients: device.wifiClients,
          reportedMaxClients: device.reportedMaxClients,
          passwordSet: device.wifiPasswordSet,
          wifiMode: device.wifiMode,
          wifiSsid: device.wifiSsid,
          wifiMaxClients: device.wifiMaxClients,
        } : null}
        cameraDevice={deviceControls ? {
          deviceId: device.id,
          surface,
          lowBatteryState: device.lowBatteryState,
          batteryPercent: device.batteryPercent,
          lastHeartbeatAt: device.lastHeartbeatAt,
          cameraAvailable: device.cameraAvailable,
          cameraReady: device.cameraReady,
        } : null}
        ats={surface === "ops" ? await loadGpsAtsPanel(device.id) : null}
        canControlAts={surface === "ops" && canManage}
        immobilizer={device.vehicleId && ((surface === "ops" && canManage) || (surface === "partner" && deviceControls))
          ? await loadImmobilizerPanel(device.vehicleId, surface === "partner" ? device.partnerId : null)
          : null}
      />

      {surface === "ops" && canManage ? (
        <section className="gps-section">
          <h2>{copy.inventory}</h2>
          <dl className="gps-facts">
            <div><dt>{copy.deviceId}</dt><dd>{device.deviceCode}</dd></div>
            <div><dt>{copy.imei}</dt><dd>{device.imei ?? copy.unavailable}</dd></div>
            <div><dt>{copy.partner}</dt><dd>{device.partnerName || copy.stock}</dd></div>
            <div><dt>{copy.vehicle}</dt><dd>{device.plate ?? copy.unassigned}</dd></div>
            <div><dt>{copy.manufacturer}</dt><dd>{device.manufacturer === "teltonika" ? copy.receiverTeltonika : copy.receiverEsp32}</dd></div>
            <div><dt>{copy.trackerModel}</dt><dd>{device.trackerModel ? device.trackerModel.toUpperCase() : copy.unavailable}</dd></div>
            <div><dt>{copy.link}</dt><dd>{device.linkTechnology === "4g" ? copy.link4g : device.linkTechnology === "2g" ? copy.link2g : copy.unavailable}</dd></div>
            <div><dt>{copy.installStatus}</dt><dd>{device.installationStatus === "pending" ? copy.installPending : copy.installInstalled}</dd></div>
            <div><dt>{copy.serial}</dt><dd>{device.serialNumber ?? copy.unavailable}</dd></div>
            {device.manufacturer === "teltonika" ? (
              <>
                <div><dt>{copy.simPhone}</dt><dd>{device.simPhone ?? copy.unavailable}</dd></div>
                <div><dt>{copy.simOperator}</dt><dd>{device.simOperator ?? copy.unavailable}</dd></div>
                <div><dt>{copy.simApn}</dt><dd>{device.simApn ?? copy.unavailable}</dd></div>
              </>
            ) : null}
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
