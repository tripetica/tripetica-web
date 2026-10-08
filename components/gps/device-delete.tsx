"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { deleteGpsDeviceAction } from "@/lib/gps/actions";
import { type GpsCopy } from "@/lib/gps/copy";
import { type GpsDeviceListItem } from "@/lib/gps/queries";
import { type Locale } from "@/lib/i18n/config";

export function GpsDeviceDelete({
  locale,
  copy,
  device,
  used,
}: {
  locale: Locale;
  copy: GpsCopy;
  device: GpsDeviceListItem;
  used: boolean;
}) {
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [pending, setPending] = useState(false);
  const company = device.plate ? (device.uetdsCompany || copy.companyMissing) : "—";
  const rows = [
    [copy.deviceId, device.deviceCode],
    [copy.imei, device.imei ?? "—"],
    [copy.partner, device.partnerName || copy.stock],
    [copy.vehicle, device.plate ?? copy.unassigned],
    [copy.company, company],
    [copy.status, device.status === "active" ? copy.active : copy.disabled],
  ];

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !pending) {
        setOpen(false);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, pending]);

  return (
    <section className="gps-delete-bar">
      {used ? <p className="ops-form-error">{copy.deleteUsed}</p> : null}
      <button type="button" className="ops-btn-danger" onClick={() => setOpen(true)}>
        {copy.deleteDevice}
      </button>
      {open && mounted ? createPortal(
        <div
          className="ops-modal-backdrop"
          role="presentation"
          onClick={() => {
            if (!pending) setOpen(false);
          }}
        >
          <div
            className="ops-modal gps-delete-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id={titleId}>{copy.deleteDevice}</h2>
            <dl className="gps-delete-facts">
              {rows.map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
            <p>{copy.deleteQuestion}</p>
            <p className="gps-delete-warning">{copy.deleteIrreversible}</p>
            <form action={deleteGpsDeviceAction} onSubmit={() => setPending(true)}>
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="deviceId" value={device.id} />
              <div className="ops-modal-actions">
                <button type="button" className="ops-btn-secondary" onClick={() => setOpen(false)} disabled={pending}>
                  {copy.deleteCancel}
                </button>
                <button type="submit" className="ops-btn-danger" disabled={pending}>
                  {copy.deleteDevice}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.getElementById("portal-root") ?? document.body,
      ) : null}
    </section>
  );
}
