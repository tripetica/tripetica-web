import { type PartnerCopy } from "@/lib/partner/copy";
import { type EmployerBillingProfile } from "@/lib/partner/employer-billing-profile";

type PartnerEmployerBillingCardProps = {
  copy: PartnerCopy;
  profile: EmployerBillingProfile;
};

const FIELDS = [
  ["billingLegalName", "legalName"],
  ["billingTaxOffice", "taxOffice"],
  ["billingTaxNumber", "taxNumber"],
  ["billingAddress", "addressLine"],
  ["billingEmail", "email"],
  ["billingPhone", "phone"],
  ["billingAuthorizedPerson", "authorizedPerson"],
] as const;

export function PartnerEmployerBillingCard({
  copy,
  profile,
}: PartnerEmployerBillingCardProps) {
  return (
    <section className="partner-billing-card" aria-labelledby="partner-billing-title">
      <p className="partner-billing-lead">{copy.employerBillingLead}</p>
      <dl className="partner-billing-fields">
        {FIELDS.map(([labelKey, valueKey]) => (
          <div key={valueKey} className="partner-billing-field">
            <dt className="partner-billing-label">{copy[labelKey]}</dt>
            <dd className="partner-billing-value">{profile[valueKey]}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
