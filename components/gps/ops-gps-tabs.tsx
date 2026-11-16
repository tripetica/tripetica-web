"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

const OpsGpsPanelContext = createContext(true);

export function useOpsGpsPanelVisible() {
  return useContext(OpsGpsPanelContext);
}

export function OpsGpsTabs({
  initialTab,
  gpsLabel,
  devicesLabel,
  configuratorLabel,
  gps,
  devices,
  configurator,
}: {
  initialTab: "gps" | "devices" | "configurator";
  gpsLabel: string;
  devicesLabel: string;
  configuratorLabel: string;
  gps: ReactNode;
  devices: ReactNode;
  configurator: ReactNode;
}) {
  const [tab, setTab] = useState(initialTab);
  return (
    <div className="gps-screen">
      <div className="gps-tabs ops-gps-tabs" role="tablist">
        <button type="button" role="tab" id="ops-gps-tab" aria-selected={tab === "gps"} aria-controls="ops-gps-panel" onClick={() => setTab("gps")}>{gpsLabel}</button>
        <button type="button" role="tab" id="ops-devices-tab" aria-selected={tab === "devices"} aria-controls="ops-devices-panel" onClick={() => setTab("devices")}>{devicesLabel}</button>
        <button type="button" role="tab" id="ops-configurator-tab" aria-selected={tab === "configurator"} aria-controls="ops-configurator-panel" onClick={() => setTab("configurator")}>{configuratorLabel}</button>
      </div>
      <OpsGpsPanelContext.Provider value={tab === "gps"}>
        <div id="ops-gps-panel" role="tabpanel" aria-labelledby="ops-gps-tab" hidden={tab !== "gps"}>{gps}</div>
      </OpsGpsPanelContext.Provider>
      <div id="ops-devices-panel" role="tabpanel" aria-labelledby="ops-devices-tab" hidden={tab !== "devices"}>{devices}</div>
      <div id="ops-configurator-panel" role="tabpanel" aria-labelledby="ops-configurator-tab" hidden={tab !== "configurator"}>{configurator}</div>
    </div>
  );
}
