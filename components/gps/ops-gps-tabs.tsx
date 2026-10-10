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
  gps,
  devices,
}: {
  initialTab: "gps" | "devices";
  gpsLabel: string;
  devicesLabel: string;
  gps: ReactNode;
  devices: ReactNode;
}) {
  const [tab, setTab] = useState(initialTab);
  return (
    <div className="gps-screen">
      <div className="gps-tabs ops-gps-tabs" role="tablist">
        <button type="button" role="tab" id="ops-gps-tab" aria-selected={tab === "gps"} aria-controls="ops-gps-panel" onClick={() => setTab("gps")}>{gpsLabel}</button>
        <button type="button" role="tab" id="ops-devices-tab" aria-selected={tab === "devices"} aria-controls="ops-devices-panel" onClick={() => setTab("devices")}>{devicesLabel}</button>
      </div>
      <OpsGpsPanelContext.Provider value={tab === "gps"}>
        <div id="ops-gps-panel" role="tabpanel" aria-labelledby="ops-gps-tab" hidden={tab !== "gps"}>{gps}</div>
      </OpsGpsPanelContext.Provider>
      <div id="ops-devices-panel" role="tabpanel" aria-labelledby="ops-devices-tab" hidden={tab !== "devices"}>{devices}</div>
    </div>
  );
}
