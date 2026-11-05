"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { deleteGpsDeviceAction } from "@/lib/gps/actions";
import { type GpsCopy } from "@/lib/gps/copy";
import { type GpsDeviceListItem } from "@/lib/gps/queries";
import { type Locale } from "@/lib/i18n/config";

export function GpsDeviceDelete({
  locale,
  copy,
  device,
}: {
  locale: Locale;
  copy: GpsCopy;
  device: GpsDeviceListItem;
}) {
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [pending, setPending] = useState(false);
  const submitting = useRef(false);
  const makeAndModel = [
    "Teltonika",
    device.trackerModel?.toUpperCase(),
  ].filter(Boolean).join(" / ");
  const rows = [
    [copy.deviceId, device.deviceCode],
    [copy.imei, device.imei ?? "—"],
    [copy.simPhone, device.simPhone ?? copy.simPhoneMissing],
    [`${copy.manufacturer} / ${copy.trackerModel}`, makeAndModel],
    [copy.partner, device.partnerName || copy.stock],
    [copy.vehicle, device.plate ?? copy.unassigned],
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
            <p className="gps-delete-warning">{copy.deleteQuestion}</p>
            <form
              action={deleteGpsDeviceAction}
              onSubmit={(event) => {
                if (submitting.current) {
                  event.preventDefault();
                  return;
                }
                submitting.current = true;
                setPending(true);
              }}
            >
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="deviceId" value={device.id} />
              <div className="ops-modal-actions">
                <button type="button" className="ops-btn-secondary" onClick={() => setOpen(false)} disabled={pending}>
                  {copy.deleteCancel}
                </button>
                <button type="submit" className="ops-btn-danger" disabled={pending}>
                  {copy.deleteConfirm}
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
