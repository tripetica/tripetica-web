export type PartnerNavItem = {
  href:
    | "/partner/jobs"
    | "/partner/accepted"
    | "/partner/drivers"
    | "/partner/vehicles"
    | "/partner/gps"
    | "/partner/uetds"
    | "/partner/edevlet-authorities"
    | "/partner/profile"
    | "/partner/employer-billing";
  labelKey:
    | "jobs"
    | "accepted"
    | "drivers"
    | "vehicles"
    | "gps"
    | "uetds"
    | "edevletAuthorities"
    | "profile"
    | "employerBilling";
};

export const PARTNER_NAV: PartnerNavItem[] = [
  { href: "/partner/jobs", labelKey: "jobs" },
  { href: "/partner/accepted", labelKey: "accepted" },
  { href: "/partner/drivers", labelKey: "drivers" },
  { href: "/partner/vehicles", labelKey: "vehicles" },
  { href: "/partner/gps", labelKey: "gps" },
  { href: "/partner/uetds", labelKey: "uetds" },
  { href: "/partner/edevlet-authorities", labelKey: "edevletAuthorities" },
  { href: "/partner/profile", labelKey: "profile" },
  { href: "/partner/employer-billing", labelKey: "employerBilling" },
];
