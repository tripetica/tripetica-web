"use client";

import Form from "next/form";
import { GpsRebootControl } from "@/components/gps/reboot-control";
import { GPS_WIFI_MAX_CLIENTS_MAX, GPS_WIFI_MAX_CLIENTS_MIN } from "@/lib/gps/contract";
import { type GpsCopy } from "@/lib/gps/copy";
import { queueGpsWifiAction } from "@/lib/gps/actions";
import { type GpsLiveSnapshot } from "@/lib/gps/live";
import { gpsPresence, type GpsPresence } from "@/lib/gps/presence";
import { wifiHotspotOn, wifiTelemetryKind } from "@/lib/gps/wifi-view";

export type GpsWifiPanelDevice = {
  locale: string;
  deviceId: string;
  surface: "ops" | "partner";
  canManage: boolean;
  partnerId: string | null;
  lte: string | null;
  network: string | null;
  reportedSsid: string | null;
  clients: number | null;
  reportedMaxClients: number | null;
  passwordSet: boolean;
  wifiMode: "on" | "off" | "auto";
  wifiSsid: string | null;
  wifiMaxClients: number;
  lastHeartbeatAt: string | null;
  manufacturer: "esp32" | "teltonika" | null;
  reportedEnabled: boolean | null;
  rssi: number | null;
  pppStatus: string | null;
  naptStatus: string | null;
  apStatus: string | null;
  wifiPolicy: string | null;
};

export type GpsWifiFleetItem = {
  id: string;
  plate: string | null;
  deviceCode: string;
  source?: "device" | "mobile";
  manufacturer?: "esp32" | "teltonika" | null;
  lastHeartbeatAt: string | null;
  wifiEnabled?: boolean | null;
  reportedWifiSsid?: string | null;
  wifiClients?: number | null;
  lteRegistration?: string | null;
  network?: string | null;
  apStatus?: string | null;
};

export function mergeWifiLive(device: GpsWifiPanelDevice, snapshot: GpsLiveSnapshot): GpsWifiPanelDevice {
  return {
    ...device,
    lastHeartbeatAt: snapshot.lastHeartbeatAt ?? device.lastHeartbeatAt,
    manufacturer: snapshot.manufacturer ?? device.manufacturer,
    lte: snapshot.lteRegistration ?? snapshot.network ?? device.lte,
    network: snapshot.network ?? device.network,
    rssi: snapshot.rssi ?? device.rssi,
    pppStatus: snapshot.pppStatus ?? device.pppStatus,
    naptStatus: snapshot.naptStatus ?? device.naptStatus,
    apStatus: snapshot.apStatus ?? device.apStatus,
    wifiPolicy: snapshot.wifiPolicy ?? device.wifiPolicy,
    reportedEnabled: snapshot.wifiEnabled ?? device.reportedEnabled,
    clients: snapshot.wifiClients ?? device.clients,
    reportedMaxClients: snapshot.reportedMaxClients ?? device.reportedMaxClients,
  };
}

function presenceLabel(copy: GpsCopy, presence: GpsPresence) {
  if (presence === "online") return copy.online;
  if (presence === "stale") return copy.stale;
  return copy.offline;
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

export function GpsWifiPanel({
  copy,
  device,
  presence,
  clockMs,
}: {
  copy: GpsCopy;
  device: GpsWifiPanelDevice;
  presence?: GpsPresence;
  clockMs?: number;
}) {
  const link = presence ?? gpsPresence(device.lastHeartbeatAt, new Date(clockMs ?? Date.now()));
  const kind = wifiTelemetryKind({
    presence: link,
    manufacturer: device.manufacturer,
    wifiEnabled: device.reportedEnabled,
    ssid: device.reportedSsid,
    clients: device.clients,
    apStatus: device.apStatus,
  });
  const hotspot = wifiHotspotOn(device.reportedEnabled, device.apStatus);
  const notice = kind === "offline"
    ? copy.wifiOfflineNotice
    : kind === "pending"
      ? copy.wifiPendingNotice
      : kind === "unsupported"
        ? copy.wifiUnsupported
        : null;
  return (
    <div className="gps-wifi-panel">
      {notice ? <p className="gps-wifi-notice">{notice}</p> : null}
      <dl className="gps-facts">
        <Fact label={copy.status} value={presenceLabel(copy, link)} />
        {kind === "unsupported" ? null : (
          <Fact
            label={copy.wifiHotspot}
            value={hotspot === null ? copy.unavailable : hotspot ? copy.wifiOn : copy.wifiOff}
          />
        )}
        <Fact label={copy.ssid} value={device.reportedSsid ?? copy.unavailable} />
        <Fact label={copy.clients} value={device.clients === null ? copy.unavailable : String(device.clients)} />
        <Fact label={copy.maxClients} value={device.reportedMaxClients === null ? copy.unavailable : String(device.reportedMaxClients)} />
        <Fact label={copy.lte} value={device.lte ?? copy.unavailable} />
        <Fact label={copy.ppp} value={device.pppStatus ?? copy.unavailable} />
        <Fact label={copy.napt} value={device.naptStatus ?? copy.unavailable} />
        <Fact label={copy.signal} value={device.rssi === null ? copy.unavailable : String(device.rssi)} />
        <Fact label={copy.password} value={device.passwordSet ? copy.passwordSet : copy.passwordMissing} />
      </dl>
      {(device.canManage || device.surface === "partner") && device.partnerId ? (
        <div>
          <Form action={queueGpsWifiAction} className="gps-form">
            <input type="hidden" name="locale" value={device.locale} />
            <input type="hidden" name="deviceId" value={device.deviceId} />
            <input type="hidden" name="surface" value={device.surface} />
            {device.surface === "ops" ? (
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
          </Form>
          <GpsRebootControl
            locale={device.locale}
            deviceId={device.deviceId}
            surface={device.surface}
            label={copy.rebootDevice}
            confirm={copy.confirmReboot}
          />
        </div>
      ) : null}
    </div>
  );
}

export function GpsWifiFleetList({
  copy,
  items,
  mobileSelected,
  listPath,
  rangeSearch = "",
}: {
  copy: GpsCopy;
  items: GpsWifiFleetItem[];
  mobileSelected: boolean;
  listPath: string;
  rangeSearch?: string;
}) {
  const devices = items.filter((item) => item.source !== "mobile");
  return (
    <div className="gps-wifi-panel">
      <p className="gps-wifi-notice">{mobileSelected ? copy.wifiMobileOnly : devices.length ? copy.wifiPick : copy.wifiNoDevices}</p>
      {devices.length ? (
        <ul className="gps-wifi-fleet">
          {devices.map((item) => {
            const presence = gpsPresence(item.lastHeartbeatAt, new Date());
            const hotspot = wifiHotspotOn(item.wifiEnabled ?? null, item.apStatus ?? null);
            const params = new URLSearchParams(rangeSearch);
            params.set("vehicle", item.id);
            params.set("tab", "wifi");
            return (
              <li key={item.id}>
                <a href={`${listPath}?${params.toString()}`}>
                  <strong>{item.plate ?? item.deviceCode}</strong>
                  <span>{presenceLabel(copy, presence)}</span>
                  <span>
                    {item.manufacturer === "teltonika"
                      ? copy.wifiUnsupported
                      : hotspot === null
                        ? copy.unavailable
                        : hotspot
                          ? copy.wifiOn
                          : copy.wifiOff}
                  </span>
                  <span>{item.reportedWifiSsid ?? copy.unavailable}</span>
                  <em>{copy.wifiSelectDevice}</em>
                </a>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
