import { type PartnerCopy } from "@/lib/partner/copy";

type PartnerComingSoonProps = {
  title: string;
  copy: PartnerCopy;
};

export function PartnerComingSoon({ title, copy }: PartnerComingSoonProps) {
  return (
    <div className="ops-page">
      <div className="ops-page-head">
        <h1>{title}</h1>
      </div>
      <div className="partner-empty">
        <p className="partner-empty-title">{copy.comingSoon}</p>
        <p className="partner-empty-lead">{copy.comingSoonLead}</p>
      </div>
    </div>
  );
}
