"use client";

import { useState } from "react";
import { OpsConfirmDialog } from "@/components/ops/ops-confirm-dialog";
import { type UetdsFormCopy } from "@/lib/uetds/copy";
import { type UetdsPassengerDraft } from "@/lib/uetds/draft";

type Props = {
  passenger: UetdsPassengerDraft;
  nationalityLabel: string;
  copy: UetdsFormCopy;
  onConfirm: () => void;
};

export function UetdsPassengerRemoveButton({ passenger, nationalityLabel, copy, onConfirm }: Props) {
  const [open, setOpen] = useState(false);
  const summary = [
    [copy.nationality, nationalityLabel],
    [copy.identity, passenger.identityNumber],
    [copy.firstName, passenger.firstName],
    [copy.lastName, passenger.lastName],
    [copy.gender, passenger.gender === "male" ? copy.genderMale : passenger.gender === "female" ? copy.genderFemale : copy.genderEmpty],
  ];

  return (
    <>
      <button
        type="button"
        className="ops-btn-secondary uetds-remove-passenger"
        aria-label={copy.removePassenger}
        onClick={() => setOpen(true)}
      >
        <span aria-hidden="true">−</span>
      </button>
      {open ? (
        <OpsConfirmDialog
          title={copy.removePassengerTitle}
          pending={false}
          cancelLabel={copy.confirmNo}
          confirmLabel={copy.removePassengerYes}
          confirmTone="danger"
          onClose={() => setOpen(false)}
          onConfirm={() => {
            setOpen(false);
            onConfirm();
          }}
        >
          <dl className="uetds-confirm-dl">
            {summary.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value.trim() || copy.missing}</dd>
              </div>
            ))}
          </dl>
          <p>{copy.removePassengerPrompt}</p>
        </OpsConfirmDialog>
      ) : null}
    </>
  );
}
