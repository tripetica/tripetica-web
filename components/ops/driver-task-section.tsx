"use client";

import { useEffect, useState, useTransition } from "react";
import { updateDriverTaskVisibilityAction } from "@/lib/ops/driver-task-actions";
import { type OpsCopy } from "@/lib/ops/copy";
import {
  driverTaskHistoryLabel,
  driverTaskStatusLine,
  formatDriverTaskClock,
} from "@/lib/ops/driver-task-copy";
import { type OpsRecordDetail } from "@/lib/ops/record-detail";

export function DriverTaskSection({
  copy,
  reservationId,
  driverTask,
  allowVisibilityControls = true,
}: {
  copy: OpsCopy;
  reservationId: string;
  driverTask: NonNullable<OpsRecordDetail["driverTask"]>;
  allowVisibilityControls?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();
  const [showPriceInfo, setShowPriceInfo] = useState(driverTask.showPriceInfo);
  const [showPassengerContact, setShowPassengerContact] = useState(
    driverTask.showPassengerContact,
  );

  useEffect(() => {
    setShowPriceInfo(driverTask.showPriceInfo);
    setShowPassengerContact(driverTask.showPassengerContact);
  }, [driverTask.showPriceInfo, driverTask.showPassengerContact]);

  async function copyLink() {
    const url = new URL(driverTask.openPath, window.location.origin).toString();
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  function saveFlags(next: { showPriceInfo: boolean; showPassengerContact: boolean }) {
    const previous = { showPriceInfo, showPassengerContact };
    setShowPriceInfo(next.showPriceInfo);
    setShowPassengerContact(next.showPassengerContact);
    startTransition(async () => {
      const result = await updateDriverTaskVisibilityAction(reservationId, next);
      if (!result.ok) {
        setShowPriceInfo(previous.showPriceInfo);
        setShowPassengerContact(previous.showPassengerContact);
      }
    });
  }

  return (
    <section className="ops-driver-task-section">
      <h3>{copy.driverTask}</h3>
      <p className="ops-driver-task-status">
        {copy.status}: {driverTaskStatusLine(driverTask.stage, driverTask.events, copy)}
      </p>
      {allowVisibilityControls ? (
        <div className="ops-driver-task-visibility">
          <label className="ops-check">
            <input
              type="checkbox"
              checked={showPriceInfo}
              disabled={pending}
              onChange={(event) =>
                saveFlags({
                  showPriceInfo: event.target.checked,
                  showPassengerContact,
                })
              }
            />
            {copy.driverTaskShowPrice}
          </label>
          <label className="ops-check">
            <input
              type="checkbox"
              checked={showPassengerContact}
              disabled={pending}
              onChange={(event) =>
                saveFlags({
                  showPriceInfo,
                  showPassengerContact: event.target.checked,
                })
              }
            />
            {copy.driverTaskShowContact}
          </label>
        </div>
      ) : null}
      <div className="ops-driver-task-actions">
        <a
          className="ops-btn-secondary"
          href={driverTask.openPath}
          target="_blank"
          rel="noreferrer"
        >
          {copy.driverTaskOpen}
        </a>
        <button type="button" className="ops-btn-secondary" onClick={() => void copyLink()}>
          {copied ? copy.driverTaskCopied : copy.driverTaskCopy}
        </button>
      </div>
      {driverTask.events.length > 0 ? (
        <div className="ops-driver-task-history">
          <h4 className="ops-assignment-subhead">{copy.operationHistory}</h4>
          <ul>
            {driverTask.events.map((event) => (
              <li key={`${event.stage}-${event.occurredAt}`}>
                {driverTaskHistoryLabel(event.stage, copy)} — {formatDriverTaskClock(event.occurredAt)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
