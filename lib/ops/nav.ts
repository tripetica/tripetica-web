import { type OpsPermission } from "@/lib/ops/permissions";

export type OpsNavItem = {
  href:
    | "/ops/reservations"
    | "/ops/processes"
    | "/ops/customers"
    | "/ops/partners"
    | "/ops/drivers"
    | "/ops/vehicles"
    | "/ops/users"
    | "/ops/account";
  permission: OpsPermission | null;
  labelKey:
    | "reservations"
    | "processes"
    | "customers"
    | "partners"
    | "drivers"
    | "vehicles"
    | "users"
    | "myAccount";
};

export const OPS_NAV: OpsNavItem[] = [
  {
    href: "/ops/reservations",
    permission: "reservations.view",
    labelKey: "reservations",
  },
  {
    href: "/ops/processes",
    permission: "processes.view",
    labelKey: "processes",
  },
  {
    href: "/ops/customers",
    permission: "customers.view",
    labelKey: "customers",
  },
  {
    href: "/ops/partners",
    permission: "partners.view",
    labelKey: "partners",
  },
  {
    href: "/ops/drivers",
    permission: "partners.view",
    labelKey: "drivers",
  },
  {
    href: "/ops/vehicles",
    permission: "partners.view",
    labelKey: "vehicles",
  },
  {
    href: "/ops/users",
    permission: "users.view",
    labelKey: "users",
  },
  {
    href: "/ops/account",
    permission: null,
    labelKey: "myAccount",
  },
];
