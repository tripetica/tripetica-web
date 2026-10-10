"use client";

import { useEffect, useId, useRef, useState } from "react";
import { type GpsCopy } from "@/lib/gps/copy";
import {
  groupOpsFleet,
  partnerSelection,
  searchOpsFleet,
  togglePartnerSelection,
  toggleVehicleSelection,
  type OpsFleetChoice,
} from "@/lib/gps/ops-fleet-filter";

export function OpsFleetFilter({
  copy,
  vehicles,
  selected,
  onChange,
}: {
  copy: GpsCopy;
  vehicles: readonly OpsFleetChoice[];
  selected: ReadonlySet<string>;
  onChange: (next: Set<string>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [openPartners, setOpenPartners] = useState<ReadonlySet<string>>(new Set());
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const groups = groupOpsFleet(vehicles);
  const listed = searchOpsFleet(groups, query);
  const searching = query.trim().length > 0;
  const total = vehicles.length;
  const chosen = vehicles.filter((vehicle) => selected.has(vehicle.id)).length;

  useEffect(() => {
    if (!open) return;
    searchRef.current?.focus();
    function onPointer(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="ops-gps-filter" ref={rootRef}>
      <button
        type="button"
        className="ops-gps-filter-trigger"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((current) => !current)}
      >
        <span>{copy.fleetFilter}</span>
        <span>{copy.fleetFilterCount.replace("{selected}", String(chosen)).replace("{total}", String(total))}</span>
      </button>
      {open ? (
        <div className="ops-gps-filter-panel" id={listId}>
          <input
            ref={searchRef}
            type="search"
            value={query}
            placeholder={copy.fleetFilterSearch}
            aria-label={copy.fleetFilterSearch}
            onChange={(event) => setQuery(event.target.value)}
          />
          <div className="ops-gps-filter-actions">
            <button type="button" onClick={() => onChange(new Set(vehicles.map((vehicle) => vehicle.id)))}>{copy.fleetFilterAll}</button>
            <button type="button" onClick={() => onChange(new Set())}>{copy.fleetFilterNone}</button>
          </div>
          <ul className="ops-gps-partners">
            {listed.map((group) => {
              const ids = groups.find((item) => item.partnerId === group.partnerId)?.vehicles.map((vehicle) => vehicle.id) ?? group.vehicles.map((vehicle) => vehicle.id);
              const state = partnerSelection(ids, selected);
              const expanded = searching || openPartners.has(group.partnerId);
              return (
                <li key={group.partnerId}>
                  <div className="ops-gps-partner">
                    <input
                      type="checkbox"
                      aria-label={group.partnerName}
                      checked={state === "all"}
                      ref={(node) => {
                        if (node) node.indeterminate = state === "some";
                      }}
                      onChange={() => onChange(togglePartnerSelection(selected, ids, state !== "all"))}
                    />
                    <button
                      type="button"
                      aria-expanded={expanded}
                      onClick={() => {
                        setOpenPartners((current) => {
                          const next = new Set(current);
                          if (next.has(group.partnerId)) next.delete(group.partnerId);
                          else next.add(group.partnerId);
                          return next;
                        });
                      }}
                    >
                      {group.partnerName}
                    </button>
                  </div>
                  {expanded ? (
                    <ul className="ops-gps-vehicles">
                      {group.vehicles.map((vehicle) => (
                        <li key={vehicle.id}>
                          <label>
                            <input
                              type="checkbox"
                              checked={selected.has(vehicle.id)}
                              onChange={() => onChange(toggleVehicleSelection(selected, vehicle.id))}
                            />
                            <span>{vehicleLabel(vehicle, copy)}</span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function vehicleLabel(vehicle: OpsFleetChoice, copy: GpsCopy) {
  const source = vehicle.source === "mobile" ? copy.sourceMobile : copy.sourcePhysical;
  const identity = vehicle.plate?.trim() || (vehicle.source === "device" ? vehicle.deviceCode : "");
  const driver = vehicle.driverName?.trim() ?? "";
  return [identity, driver, source].filter((part) => part.length > 0).join(" — ");
}
