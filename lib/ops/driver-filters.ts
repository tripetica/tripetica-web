import { type DriverNameSortDir } from "@/lib/partner/driver-list-view";

export type OpsDriverListFilters = {
  query: string;
  dir: DriverNameSortDir;
};

export function parseOpsDriverSortDir(value: string): DriverNameSortDir {
  return value === "desc" ? "desc" : "asc";
}

export function parseOpsDriverListFilters(input: {
  q?: string;
  dir?: string;
}): OpsDriverListFilters {
  return {
    query: (input.q ?? "").trim(),
    dir: parseOpsDriverSortDir(input.dir ?? ""),
  };
}

export function opsDriverQueryRecord(filters: OpsDriverListFilters): Record<string, string> {
  return {
    q: filters.query,
    dir: filters.dir,
  };
}
