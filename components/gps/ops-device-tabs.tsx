"use client";

import { useState, type ReactNode } from "react";

export function OpsDeviceTabs({
  initial,
  devicesLabel,
  faultsLabel,
  historyLabel,
  devices,
  faults,
  history,
}: {
  initial: "devices" | "faults" | "history";
  devicesLabel: string;
  faultsLabel: string;
  historyLabel: string;
  devices: ReactNode;
  faults: ReactNode;
  history: ReactNode;
}) {
  const [tab, setTab] = useState(initial);
  return (
    <div>
      <div className="gps-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === "devices"} onClick={() => setTab("devices")}>{devicesLabel}</button>
        <button type="button" role="tab" aria-selected={tab === "faults"} onClick={() => setTab("faults")}>{faultsLabel}</button>
        <button type="button" role="tab" aria-selected={tab === "history"} onClick={() => setTab("history")}>{historyLabel}</button>
      </div>
      <div hidden={tab !== "devices"}>{devices}</div>
      <div hidden={tab !== "faults"}>{faults}</div>
      <div hidden={tab !== "history"}>{history}</div>
    </div>
  );
}
