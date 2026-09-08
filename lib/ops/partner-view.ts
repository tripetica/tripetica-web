import {
  type PartnerBusinessType,
  type PartnerPriorityLevel,
  type PartnerStatus,
} from "@/lib/partner/constants";
import {
  canActivateExternalPartner,
  partnerHasRequiredProfileFields,
} from "@/lib/partner/policy";

export type OpsPartnerListItem = {
  id: string;
  partnerCode: string;
  name: string;
  status: PartnerStatus;
  isPrimaryPartner: boolean;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  priorityLevel: PartnerPriorityLevel | null;
  createdAt: string;
};

export type OpsPartnerDetail = OpsPartnerListItem & {
  businessType: PartnerBusinessType | null;
  addressLine: string | null;
  countryCode: string | null;
  taxOffice: string | null;
  taxNumber: string | null;
  contactFirstName: string | null;
  contactLastName: string | null;
  phoneCountryCode: string | null;
  appliedAt: string | null;
  activatedAt: string | null;
  updatedAt: string;
};

export function partnerActivationReady(partner: OpsPartnerDetail) {
  return canActivateExternalPartner({
    isPrimaryPartner: partner.isPrimaryPartner,
    status: partner.status,
    priorityLevel: partner.priorityLevel,
    hasRequiredFields: partnerHasRequiredProfileFields({
      name: partner.name,
      email: partner.email ?? "",
      phone: partner.phone ?? "",
      contactFirstName: partner.contactFirstName ?? "",
      contactLastName: partner.contactLastName ?? "",
      businessType: partner.businessType,
      addressLine: partner.addressLine ?? "",
      countryCode: partner.countryCode ?? "",
      taxOffice: partner.taxOffice ?? "",
      taxNumber: partner.taxNumber ?? "",
    }),
  });
}
