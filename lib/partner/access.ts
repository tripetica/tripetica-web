export const PARTNER_TABS = [
  "jobs",
  "accepted",
  "drivers",
  "vehicles",
  "gps",
  "uetds",
  "edevlet",
  "profile",
  "billing",
  "users",
] as const;

export type PartnerTab = (typeof PARTNER_TABS)[number];

const TAB_PATHS: { tab: PartnerTab; prefix: string }[] = [
  { tab: "jobs", prefix: "/partner/jobs" },
  { tab: "accepted", prefix: "/partner/accepted" },
  { tab: "drivers", prefix: "/partner/drivers" },
  { tab: "vehicles", prefix: "/partner/vehicles" },
  { tab: "gps", prefix: "/partner/gps" },
  { tab: "uetds", prefix: "/partner/uetds" },
  { tab: "edevlet", prefix: "/partner/edevlet-authorities" },
  { tab: "profile", prefix: "/partner/profile" },
  { tab: "billing", prefix: "/partner/employer-billing" },
  { tab: "users", prefix: "/partner/users" },
];

export function isPartnerTab(value: string): value is PartnerTab {
  return (PARTNER_TABS as readonly string[]).includes(value);
}

export function partnerTabForPath(path: string): PartnerTab | null {
  if (path === "/partner" || path === "/partner/") return "jobs";
  return TAB_PATHS.find((item) => path === item.prefix || path.startsWith(`${item.prefix}/`))?.tab ?? null;
}

export function partnerTabPath(tab: PartnerTab) {
  return TAB_PATHS.find((item) => item.tab === tab)?.prefix ?? "/partner/profile";
}

export function partnerHasTab(actor: { isOwner: boolean; tabs: readonly string[] }, tab: PartnerTab) {
  return actor.isOwner || actor.tabs.includes(tab);
}

export function firstPartnerTabPath(actor: { isOwner: boolean; tabs: readonly string[] }) {
  const tab = PARTNER_TABS.find((item) => partnerHasTab(actor, item));
  return tab ? partnerTabPath(tab) : "/partner/profile";
}
