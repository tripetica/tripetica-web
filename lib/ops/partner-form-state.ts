import { fromStoredPhone } from "@/lib/booking/phone";
import {
  joinPartnerContactName,
  partnerContactNamesFromForm,
} from "@/lib/partner/contact-name";
import { PARTNER_DEFAULT_COUNTRY_CODE } from "@/lib/partner/constants";
import { type OpsPartnerDetail } from "@/lib/ops/partner-view";
import { partnerPriorityFormValue } from "@/lib/ops/partner-priority";

export type PartnerEditorValues = {
  email: string;
  phoneCountry: string;
  phoneNational: string;
  contactName: string;
  businessType: string;
  name: string;
  addressLine: string;
  countryCode: string;
  taxOffice: string;
  taxNumber: string;
  priorityLevel: string;
};

function collapse(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeValue(key: keyof PartnerEditorValues, value: string) {
  if (key === "email") {
    return value.trim().toLowerCase();
  }
  if (key === "phoneNational" || key === "taxNumber") {
    return value.replace(/[\s-]+/g, "");
  }
  if (key === "phoneCountry" || key === "countryCode") {
    return value.trim().toUpperCase();
  }
  if (key === "businessType" || key === "priorityLevel") {
    return value.trim();
  }
  return collapse(value);
}

export function partnerEditorValuesFromDetail(
  partner: OpsPartnerDetail,
): PartnerEditorValues {
  const storedPhone = fromStoredPhone(partner.phoneCountryCode, partner.phone);
  return {
    email: partner.email ?? "",
    phoneCountry: storedPhone.iso2 ?? PARTNER_DEFAULT_COUNTRY_CODE,
    phoneNational: storedPhone.national,
    contactName: joinPartnerContactName(partner.contactFirstName, partner.contactLastName),
    businessType: partner.businessType ?? "",
    name: partner.name,
    addressLine: partner.addressLine ?? "",
    countryCode: partner.countryCode ?? PARTNER_DEFAULT_COUNTRY_CODE,
    taxOffice: partner.taxOffice ?? "",
    taxNumber: partner.taxNumber ?? "",
    priorityLevel: partnerPriorityFormValue(partner),
  };
}

export function partnerEditorValuesEqual(
  left: PartnerEditorValues,
  right: PartnerEditorValues,
) {
  return (Object.keys(left) as (keyof PartnerEditorValues)[]).every(
    (key) => normalizeValue(key, left[key]) === normalizeValue(key, right[key]),
  );
}

export function partnerProfileFieldsFromForm(formData: FormData) {
  const contact = partnerContactNamesFromForm(formData);
  return {
    email: String(formData.get("email") ?? ""),
    phoneCountryCode: String(formData.get("phoneCountryCode") ?? ""),
    phoneNational: String(formData.get("phoneNational") ?? ""),
    contactFirstName: contact.contactFirstName,
    contactLastName: contact.contactLastName,
    businessType: String(formData.get("businessType") ?? ""),
    name: String(formData.get("name") ?? ""),
    addressLine: String(formData.get("addressLine") ?? ""),
    countryCode: String(formData.get("countryCode") ?? ""),
    taxOffice: String(formData.get("taxOffice") ?? ""),
    taxNumber: String(formData.get("taxNumber") ?? ""),
    priorityLevel: String(formData.get("priorityLevel") ?? ""),
  };
}
