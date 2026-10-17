"use client";

import { useMemo, useState } from "react";
import { type Locale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/path";
import { type GpsCopy } from "@/lib/gps/copy";
import { gpsClock, gpsSpeed } from "@/lib/gps/format";
import { gpsPresence } from "@/lib/gps/presence";
import { type GpsDeviceListItem, type GpsVehicleChoice } from "@/lib/gps/queries";
import { GpsDeviceCreateForm } from "@/components/gps/device-create-form";

export function GpsDeviceBoard({
  locale,
  copy,
  surface,
  devices,
  canManage,
  partners,
  vehicles,
}: {
  locale: Locale;
  copy: GpsCopy;
  surface: "ops" | "partner";
  devices: GpsDeviceListItem[];
  canManage: boolean;
  partners: { id: string; partner_code: string; name: string }[];
  vehicles: GpsVehicleChoice[];
}) {
  const [creating, setCreating] = useState(false);
  const [partnerId, setPartnerId] = useState("");
  const [query, setQuery] = useState("");
  const [presence, setPresence] = useState("");
  const [wifi, setWifi] = useState("");
  const [fix, setFix] = useState("");
  const [manufacturer, setManufacturer] = useState("");
  const [model, setModel] = useState("");
  const [installation, setInstallation] = useState("");
  const now = Date.now();
  const visible = useMemo(() => {
    const needle = query.trim().toLocaleUpperCase("tr-TR");
    return devices.filter((device) => {
      if (surface === "ops" && partnerId === "stock" && device.partnerId) return false;
      if (surface === "ops" && partnerId && partnerId !== "stock" && device.partnerId !== partnerId) return false;
      if (needle) {
        const haystack = [device.plate, device.deviceCode, device.imei, device.simPhone, device.label, device.partnerName, device.uetdsCompany, device.manufacturer, device.trackerModel, device.serialNumber]
          .filter(Boolean)
          .join(" ")
          .toLocaleUpperCase("tr-TR");
        if (!haystack.includes(needle)) return false;
      }
      const state = gpsPresence(device.lastHeartbeatAt, new Date(now));
      if (presence && state !== presence) return false;
      if (wifi && device.wifiMode !== wifi) return false;
      if (fix === "yes" && device.gnssFix !== true) return false;
      if (fix === "no" && device.gnssFix === true) return false;
      if (manufacturer && device.manufacturer !== manufacturer) return false;
      if (model && device.trackerModel !== model) return false;
      if (installation && device.installationStatus !== installation) return false;
      return true;
    });
  }, [devices, fix, installation, manufacturer, model, now, partnerId, presence, query, surface, wifi]);

  return (
    <div className="gps-screen">
      <header className="gps-head">
        <div>
          <h1>{copy.title}</h1>
          <p>{copy.lead}</p>
        </div>
        {surface === "ops" && canManage ? (
          <button type="button" className="ops-btn-primary" onClick={() => setCreating((open) => !open)}>
            {copy.addDevice}
          </button>
        ) : null}
      </header>
      {surface === "ops" && canManage && creating ? (
        <GpsDeviceCreateForm locale={locale} copy={copy} partners={partners} vehicles={vehicles} />
      ) : null}
      {surface === "ops" ? <h2>{copy.inventory}</h2> : null}
      {surface === "ops" ? (
        <div className="gps-filters">
          <label>
            <span>{copy.partner}</span>
            <select value={partnerId} onChange={(event) => setPartnerId(event.target.value)}>
              <option value="">{copy.all}</option>
              <option value="stock">{copy.stock}</option>
              {partners.map((partner) => (
                <option key={partner.id} value={partner.id}>
                  {partner.partner_code} · {partner.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>{copy.search}</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} />
          </label>
          <label>
            <span>{copy.status}</span>
            <select value={presence} onChange={(event) => setPresence(event.target.value)}>
              <option value="">{copy.all}</option>
              <option value="online">{copy.online}</option>
              <option value="stale">{copy.stale}</option>
              <option value="offline">{copy.offline}</option>
            </select>
          </label>
          <label>
            <span>{copy.wifiFilter}</span>
            <select value={wifi} onChange={(event) => setWifi(event.target.value)}>
              <option value="">{copy.all}</option>
              <option value="on">{copy.modeOn}</option>
              <option value="off">{copy.modeOff}</option>
              <option value="auto">{copy.modeAuto}</option>
            </select>
          </label>
          <label>
            <span>{copy.manufacturer}</span>
            <select value={manufacturer} onChange={(event) => setManufacturer(event.target.value)}>
              <option value="">{copy.all}</option>
              <option value="teltonika">{copy.receiverTeltonika}</option>
              <option value="esp32">{copy.receiverEsp32}</option>
            </select>
          </label>
          <label>
            <span>{copy.trackerModel}</span>
            <select value={model} onChange={(event) => setModel(event.target.value)}>
              <option value="">{copy.all}</option>
              <option value="fmb920">FMB920</option>
              <option value="fmc920">FMC920</option>
            </select>
          </label>
          <label>
            <span>{copy.installStatus}</span>
            <select value={installation} onChange={(event) => setInstallation(event.target.value)}>
              <option value="">{copy.all}</option>
              <option value="pending">{copy.installPending}</option>
              <option value="installed">{copy.installInstalled}</option>
            </select>
          </label>
          <label>
            <span>{copy.anyFix}</span>
            <select value={fix} onChange={(event) => setFix(event.target.value)}>
              <option value="">{copy.all}</option>
              <option value="yes">{copy.fixYes}</option>
              <option value="no">{copy.fixNo}</option>
            </select>
          </label>
        </div>
      ) : null}
      {visible.length === 0 ? <p className="gps-empty">{copy.empty}</p> : surface === "ops" ? (
        <div className="ops-table-wrap gps-device-table">
          <table className="ops-table">
            <thead>
              <tr>
                <th>{copy.manufacturer}</th>
                <th>{copy.trackerModel}</th>
                <th>{copy.deviceId}</th>
                <th>{copy.imei}</th>
                <th>{copy.phone}</th>
                <th>{copy.partner}</th>
                <th>{copy.vehicle}</th>
                <th>{copy.company}</th>
                <th>{copy.installStatus}</th>
                <th>{copy.status}</th>
                <th>{copy.lastConnection}</th>
                <th>{copy.gnssTime}</th>
                <th>{copy.coordinates}</th>
                <th>{copy.detail}</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((device) => {
                const href = localizedPath(locale, `/ops/gps/${device.id}`);
                return (
                  <tr key={device.id}>
                    <td>{device.manufacturer === "teltonika" ? copy.receiverTeltonika : copy.receiverEsp32}</td>
                    <td>{modelText(device.trackerModel, device.linkTechnology)}</td>
                    <td>{device.deviceCode}</td>
                    <td>{device.imei ?? "—"}</td>
                    <td>{device.simPhone ?? "—"}</td>
                    <td>{device.partnerName || copy.stock}</td>
                    <td>{device.plate ?? copy.unassigned}</td>
                    <td>{device.plate ? (device.uetdsCompany || copy.companyMissing) : "—"}</td>
                    <td>{device.installationStatus === "pending" ? copy.installPending : copy.installInstalled}</td>
                    <td>{device.status === "active" ? copy.active : copy.disabled}</td>
                    <td>{gpsClock(device.lastHeartbeatAt)}</td>
                    <td>{gpsClock(device.recordedAt)}</td>
                    <td>{coordinateText(device.latitude, device.longitude)}</td>
                    <td><a className="ops-btn-secondary" href={href}>{copy.detail}</a></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="gps-grid">
          {visible.map((device) => {
            const state = gpsPresence(device.lastHeartbeatAt, new Date(now));
            const href = localizedPath(locale, `/partner/gps/${device.id}`);
            return (
              <a key={device.id} className="gps-card" href={href}>
                <div className="gps-card-top">
                  <strong>{device.plate ?? copy.unassigned}</strong>
                  <span className={`gps-pill is-${state}`}>{copy[state]}</span>
                </div>
                <p className="gps-card-id">{device.deviceCode}</p>
                <dl>
                  <div><dt>{copy.gpsFix}</dt><dd>{device.gnssFix ? copy.fixYes : copy.fixNo}</dd></div>
                  <div><dt>{copy.wifi}</dt><dd>{modeLabel(copy, device.wifiMode)}</dd></div>
                  <div><dt>{copy.lte}</dt><dd>{device.network ?? copy.unavailable}</dd></div>
                  <div><dt>{copy.signal}</dt><dd>{device.rssi === null ? copy.unavailable : `${device.rssi} dBm`}</dd></div>
                  <div><dt>{copy.gnssTime}</dt><dd>{gpsClock(device.recordedAt)}</dd></div>
                  <div><dt>{copy.seen}</dt><dd>{gpsClock(device.lastHeartbeatAt)}</dd></div>
                  <div><dt>{copy.clients}</dt><dd>{device.wifiClients ?? 0}/{device.wifiMaxClients}</dd></div>
                  <div><dt>{copy.speed}</dt><dd>{gpsSpeed(device.speedMps)}</dd></div>
                </dl>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}

function coordinateText(latitude: number | null, longitude: number | null) {
  if (latitude === null || longitude === null || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return "—";
  return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
}

function modelText(model: "fmb920" | "fmc920" | null, link: "2g" | "4g" | null) {
  if (model === "fmb920") return link === "2g" ? "FMB920 · 2G" : "FMB920";
  if (model === "fmc920") return link === "4g" ? "FMC920 · 4G" : "FMC920";
  return "—";
}

function modeLabel(copy: GpsCopy, mode: "on" | "off" | "auto") {
  if (mode === "on") return copy.modeOn;
  if (mode === "auto") return copy.modeAuto;
  return copy.modeOff;
}
