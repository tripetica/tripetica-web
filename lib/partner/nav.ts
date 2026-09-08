export type PartnerNavItem = {
  href:
    | "/partner/jobs"
    | "/partner/accepted"
    | "/partner/drivers"
    | "/partner/vehicles"
    | "/partner/profile"
    | "/partner/employer-billing";
  labelKey:
    | "jobs"
    | "accepted"
    | "drivers"
    | "vehicles"
    | "profile"
    | "employerBilling";
};

export const PARTNER_NAV: PartnerNavItem[] = [
  { href: "/partner/jobs", labelKey: "jobs" },
  { href: "/partner/accepted", labelKey: "accepted" },
  { href: "/partner/drivers", labelKey: "drivers" },
  { href: "/partner/vehicles", labelKey: "vehicles" },
  { href: "/partner/profile", labelKey: "profile" },
  { href: "/partner/employer-billing", labelKey: "employerBilling" },
];
