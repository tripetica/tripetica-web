"use client";
import { useEffect, useRef, useState } from "react";
import { missingMandatoryFields, type UetdsDraft } from "@/lib/uetds/draft";
import { isUetdsEndAfterStart } from "@/lib/uetds/trip-time";
import { uetdsMissingFieldMessage, type UetdsFormCopy } from "@/lib/uetds/copy";

/** Shared create/edit validation, including custom select and gender controls. */
export function useUetdsValidation(draft: UetdsDraft, copy: UetdsFormCopy, fleetInvalid: boolean) {
  const rootRef = useRef<HTMLElement>(null);
  const [attempted, setAttempted] = useState(false);
  const errors = missingMandatoryFields(draft);
  if (!isUetdsEndAfterStart(draft.startDate, draft.startTime, draft.endDate, draft.endTime)) errors.push("endTime");
  if (fleetInvalid) errors.push("driverId", "vehicleId");
  function paint(keys: string[]) {
    const root = rootRef.current;
    if (!root) return;
    for (const field of root.querySelectorAll<HTMLElement>("[data-uetds-field]")) {
      const key = field.dataset.uetdsField!;
      const invalid = keys.includes(key);
      const id = `uetds-error-${key.replaceAll(".", "-")}`;
      field.classList.toggle("uetds-invalid-field", invalid);
      for (const control of field.querySelectorAll<HTMLElement>('input:not([type="hidden"]), select, button')) {
        if (control instanceof HTMLInputElement || control instanceof HTMLSelectElement) control.setAttribute("aria-required", "true");
        if (invalid) { control.setAttribute("aria-invalid", "true"); control.setAttribute("aria-describedby", id); }
        else { control.removeAttribute("aria-invalid"); if (control.getAttribute("aria-describedby") === id) control.removeAttribute("aria-describedby"); }
      }
      let hint = field.querySelector<HTMLElement>("[data-uetds-error]");
      if (invalid && !hint) { hint = document.createElement("span"); hint.dataset.uetdsError = "true"; hint.className = "uetds-field-error"; field.append(hint); }
      if (hint) { hint.id = id; hint.textContent = invalid ? (key === "endTime" && !missingMandatoryFields(draft).includes("endTime") ? copy.endBeforeStart : uetdsMissingFieldMessage(key, copy)) : ""; hint.hidden = !invalid; }
    }
  }
  useEffect(() => { paint(attempted ? errors : []); });
  function validate() {
    setAttempted(true);
    paint(errors);
    const first = rootRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]:not(:disabled)');
    if (first) { first.scrollIntoView({ behavior: "smooth", block: "center" }); first.focus({ preventScroll: true }); }
    return errors.length === 0;
  }
  return { rootRef, validate, attempted };
}
