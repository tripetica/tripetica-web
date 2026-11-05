import { setGpsDeviceStatusAction, updateGpsImeiAction, updateGpsSimOperatorAction, updateGpsSimPhoneAction } from "@/lib/gps/actions";
import { gpsErrorText, type GpsCopy } from "@/lib/gps/copy";
import { gpsClock } from "@/lib/gps/format";
import { gpsPartnerLivePayload, readGpsLiveSnapshot, type GpsLiveSnapshot } from "@/lib/gps/live";
import { listGpsRecentFixes, type GpsDeviceListItem, type GpsRoutePoint, type GpsVehicleChoice } from "@/lib/gps/queries";
import { type Locale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/path";
import { GpsDeviceAssignmentForm } from "@/components/gps/device-assignment-form";
import { GpsDeviceDelete } from "@/components/gps/device-delete";
import { loadGpsAtsPanel } from "@/lib/gps/ats-control";
import { GpsLiveSection, type GpsSectionVisibility } from "@/components/gps/live-section";
import { type DriveReport, type DriveVehicleInfo } from "@/lib/gps/drive";
import { type GpsFleetVehicle } from "@/lib/gps/fleet";
import { gpsPresence } from "@/lib/gps/presence";
import { GPS_SIM_OPERATORS, gpsSimOperator } from "@/lib/gps/registration";
import { loadImmobilizerPanel } from "@/lib/teltonika/immobilizer-store";
import { type DriveGreenView } from "@/lib/teltonika/green-driving";
import { AtsFaultSection } from "@/components/gps/ats-fault-section";
import { atsFaultCopy } from "@/lib/gps/ats-fault-copy";

export async function GpsDeviceWorkspace({
  locale,
  copy,
  surface,
  device,
  vehicles,
  partners = [],
  assignments = [],
  route,
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
  drive = null,
  driveVehicle = null,
  green = null,
  faultNotice = null,
  portalPath,
  sections,
  liveUrl,
  maintenanceBase,
  fleetUrl,
  loadImmobilizer = false,
}: {
  locale: Locale;
  copy: GpsCopy;
  surface: "ops" | "partner";
  device: GpsDeviceListItem | null;
  vehicles: GpsVehicleChoice[];
  partners?: { id: string; partner_code: string; name: string }[];
  assignments?: { assignedAt: string; partnerName: string | null; partnerCode: string | null; plate: string | null }[];
  route: { total: number; step: number; points: GpsRoutePoint[] };
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
  drive?: DriveReport | null;
  driveVehicle?: DriveVehicleInfo | null;
  green?: DriveGreenView | null;
  faultNotice?: string | null;
  portalPath?: string;
  sections?: GpsSectionVisibility;
  liveUrl?: string;
  maintenanceBase?: string;
  fleetUrl?: string;
  loadImmobilizer?: boolean;
}) {
  const listPath = portalPath
    ? localizedPath(locale, portalPath)
    : `${localizedPath(locale, surface === "ops" ? "/ops/gps" : "/partner/gps")}${surface === "ops" && showDeviceList ? "?tab=devices" : ""}`;
  const recentByDevice = await listGpsRecentFixes([
    device?.id ?? "",
    ...(fleetVehicles?.filter((vehicle) => vehicle.source !== "mobile").map((vehicle) => vehicle.id) ?? []),
  ]);
  if (sections && !sections.live) recentByDevice.clear();
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
          simOperator={null}
          status="active"
          company={null}
          partnerLabel={null}
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
          locale={locale === "en" || locale === "ru" || locale === "tr" ? locale : "tr"}
          drive={drive}
          driveVehicle={driveVehicle}
          green={green}
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
          sections={sections}
          liveUrl={liveUrl}
          maintenanceUrl={maintenanceBase}
          fleetUrl={fleetUrl}
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
    accState: device.accState,
    din1State: device.din1State,
    manufacturer: device.manufacturer,
    recent: recentByDevice.get(device.id) ?? [],
  };
  if (sections && !sections.live) {
    initialLive.latitude = null;
    initialLive.longitude = null;
    initialLive.speedMps = null;
    initialLive.headingDeg = null;
    initialLive.recent = [];
  }
  const partnerLive = surface === "partner" ? readGpsLiveSnapshot(gpsPartnerLivePayload(initialLive)) : null;
  const errorText = gpsErrorText(copy, error);
  const immobilizer = device.vehicleId && ((surface === "ops" && canManage) || (surface === "partner" && (deviceControls || loadImmobilizer)))
    ? await loadImmobilizerPanel(device.vehicleId, surface === "partner" ? device.partnerId : null)
    : null;

  return (
    <div className="gps-screen">
      <GpsLiveSection
        copy={copy}
        listPath={listPath}
        plate={device.plate}
        deviceCode={device.deviceCode}
        deviceId={device.id}
        surface={surface}
        initial={partnerLive ?? initialLive}
        imei={device.imei}
        simOperator={device.simOperator}
        status={device.status}
        company={device.uetdsCompany}
        partnerLabel={surface === "ops" ? (device.partnerCode ? `${device.partnerCode} · ${device.partnerName}` : copy.stock) : null}
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
        locale={locale === "en" || locale === "ru" || locale === "tr" ? locale : "tr"}
        drive={drive}
        driveVehicle={driveVehicle}
        green={green}
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
        ats={surface === "ops" ? await loadGpsAtsPanel(device.id) : null}
        canControlAts={surface === "ops" && canManage}
        immobilizer={immobilizer}
        sections={sections}
        liveUrl={liveUrl}
        maintenanceUrl={maintenanceBase}
        fleetUrl={fleetUrl}
      />

      {surface === "ops" ? (
        <AtsFaultSection locale={locale} deviceId={device.id} canManage={canManage} notice={faultNotice} />
      ) : null}

      {surface === "ops" && canManage ? (
        <section className="gps-section">
          <h2>{copy.inventory}</h2>
          <p><a className="ops-btn" href="#ats-fault">{atsFaultCopy(locale).report}</a></p>
          <dl className="gps-facts">
            <div><dt>{copy.deviceId}</dt><dd>{device.deviceCode}</dd></div>
            <div><dt>{copy.imei}</dt><dd>{device.imei ?? copy.unavailable}</dd></div>
            <div><dt>{copy.partner}</dt><dd>{device.partnerName || copy.stock}</dd></div>
            <div><dt>{copy.vehicle}</dt><dd>{device.plate ?? copy.unassigned}</dd></div>
            <div><dt>{copy.manufacturer}</dt><dd>{copy.receiverTeltonika}</dd></div>
            <div><dt>{copy.trackerModel}</dt><dd>{device.trackerModel ? device.trackerModel.toUpperCase() : copy.unavailable}</dd></div>
            <div><dt>{copy.link}</dt><dd>{device.linkTechnology === "4g" ? copy.link4g : device.linkTechnology === "2g" ? copy.link2g : copy.unavailable}</dd></div>
            <div><dt>{copy.installStatus}</dt><dd>{device.installationStatus === "pending" ? copy.installPending : copy.installInstalled}</dd></div>
            <div><dt>{copy.serial}</dt><dd>{device.serialNumber ?? copy.unavailable}</dd></div>
            <div><dt>{copy.simApn}</dt><dd>{device.simApn ?? copy.unavailable}</dd></div>
            <div><dt>{copy.simOperator}</dt><dd>{device.simOperator ?? copy.unavailable}</dd></div>
            <div><dt>{copy.simPhone}</dt><dd>{device.simPhone ?? copy.simPhoneMissing}</dd></div>
            <div><dt>{copy.status}</dt><dd>{device.status === "active" ? copy.active : copy.disabled}</dd></div>
            <div><dt>{copy.heartbeat}</dt><dd>{gpsClock(device.lastHeartbeatAt)}</dd></div>
            <div><dt>{copy.gnssTime}</dt><dd>{gpsClock(device.recordedAt)}</dd></div>
            <div><dt>{copy.popupCoordinates}</dt><dd>{device.latitude === null || device.longitude === null ? copy.unavailable : `${device.latitude.toFixed(6)}, ${device.longitude.toFixed(6)}`}</dd></div>
            <div><dt>{copy.firmware}</dt><dd>{device.firmware ?? copy.unavailable}</dd></div>
            <div><dt>{copy.createdAt}</dt><dd>{gpsClock(device.createdAt)}</dd></div>
          </dl>
          <form action={updateGpsSimOperatorAction} className="gps-inline">
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="deviceId" value={device.id} />
            <label>
              <span>{copy.simOperator}</span>
              <select name="simOperator" required defaultValue={gpsSimOperator(device.simOperator ?? "") ?? ""}>
                <option value="" disabled>{copy.simOperatorChoose}</option>
                {GPS_SIM_OPERATORS.map((operator) => <option key={operator} value={operator}>{operator}</option>)}
              </select>
            </label>
            <button type="submit" className="ops-btn">{copy.save}</button>
          </form>
          <form action={updateGpsSimPhoneAction} className="gps-inline">
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="deviceId" value={device.id} />
            <label>
              <span>{copy.simPhone}</span>
              <input name="simPhone" inputMode="tel" autoComplete="tel" defaultValue={device.simPhone ?? ""} placeholder={copy.simPhoneExample} />
            </label>
            <button type="submit" className="ops-btn">{copy.save}</button>
          </form>
          {immobilizer ? (
            <div className="gps-stack">
              <h3>{copy.immobilizer}</h3>
              <dl className="gps-facts">
                <div><dt>{copy.immobilizerConnection}</dt><dd>{gpsPresence(immobilizer.lastHeartbeatAt, new Date()) === "online" ? copy.online : copy.immobilizerOffline}</dd></div>
                <div><dt>{copy.immobilizerIgnition}</dt><dd>{immobilizer.ignition === "on" ? copy.immobilizerYes : immobilizer.ignition === "off" ? copy.immobilizerNo : copy.immobilizerUnknown}</dd></div>
                <div><dt>{copy.immobilizerOutput}</dt><dd>{immobilizer.output === "unknown" ? copy.immobilizerUnknown : immobilizer.output === "on" ? copy.immobilizerActive : copy.immobilizerPassive}{immobilizer.outputObservedAt ? ` · ${gpsClock(immobilizer.outputObservedAt)}` : ""}</dd></div>
                <div><dt>{copy.immobilizerRequest}</dt><dd>{immobilizer.request === "on" ? copy.immobilizerOpen : copy.immobilizerClosed}</dd></div>
                <div><dt>{copy.immobilizerLastCommand}</dt><dd>{immobilizer.commandText ? `${immobilizer.commandText} · ${immobilizer.phase}` : copy.unavailable}{immobilizer.commandAt ? ` · ${gpsClock(immobilizer.commandAt)}` : ""}</dd></div>
                <div><dt>{copy.immobilizerLastResponse}</dt><dd>{immobilizer.responseText ?? copy.unavailable}</dd></div>
                <div><dt>{copy.immobilizerStarter}</dt><dd>{immobilizer.starterCircuitVerified ? copy.immobilizerYes : copy.immobilizerNo}</dd></div>
              </dl>
            </div>
          ) : null}
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
        </section>
      ) : null}

      {canDelete ? (
        <GpsDeviceDelete locale={locale} copy={copy} device={device} />
      ) : null}
    </div>
  );
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
    accState: null,
    din1State: null,
    manufacturer: "teltonika",
  };
}
