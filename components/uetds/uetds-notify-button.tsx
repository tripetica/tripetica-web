import { uetdsEligibilityMessage, type UetdsFormCopy } from "@/lib/uetds/copy";
import { type UetdsEligibility } from "@/lib/uetds/eligibility";

type UetdsNotifyButtonProps = {
  href: string;
  eligibility: UetdsEligibility;
  copy: UetdsFormCopy;
  label?: string;
};

export function UetdsNotifyButton({ href, eligibility, copy, label }: UetdsNotifyButtonProps) {
  const reason = uetdsEligibilityMessage(eligibility.reason, copy);
  const actionLabel = label ?? copy.notifyAction;
  if (eligibility.ok) {
    return (
      <a className="ops-btn-primary" href={href}>
        {actionLabel}
      </a>
    );
  }
  return (
    <div className="uetds-notify-disabled">
      <button type="button" className="ops-btn-primary" disabled>
        {actionLabel}
      </button>
      {reason ? <p className="uetds-notify-reason">{reason}</p> : null}
    </div>
  );
}
