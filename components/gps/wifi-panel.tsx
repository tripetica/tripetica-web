"use client";

import Form from "next/form";
import { GpsRebootControl } from "@/components/gps/reboot-control";
import { GPS_WIFI_MAX_CLIENTS_MAX, GPS_WIFI_MAX_CLIENTS_MIN } from "@/lib/gps/contract";
import { type GpsCopy } from "@/lib/gps/copy";
import { queueGpsWifiAction } from "@/lib/gps/actions";

export type GpsWifiPanelDevice = {
  locale: string;
  deviceId: string;
  surface: "ops" | "partner";
  canManage: boolean;
  partnerId: string | null;
  lte: string | null;
  reportedSsid: string | null;
  clients: number | null;
  reportedMaxClients: number | null;
  passwordSet: boolean;
  wifiMode: "on" | "off" | "auto";
  wifiSsid: string | null;
  wifiMaxClients: number;
};

export function GpsWifiPanel({ copy, device }: { copy: GpsCopy; device: GpsWifiPanelDevice }) {
  return (
    <div>
      <dl className="gps-facts">
        <div><dt>{copy.lte}</dt><dd>{device.lte ?? copy.unavailable}</dd></div>
        <div><dt>{copy.ssid}</dt><dd>{device.reportedSsid ?? copy.unavailable}</dd></div>
        <div><dt>{copy.clients}</dt><dd>{device.clients === null ? copy.unavailable : String(device.clients)}</dd></div>
        <div><dt>{copy.maxClients}</dt><dd>{device.reportedMaxClients === null ? copy.unavailable : String(device.reportedMaxClients)}</dd></div>
        <div><dt>{copy.password}</dt><dd>{device.passwordSet ? copy.passwordSet : copy.passwordMissing}</dd></div>
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
