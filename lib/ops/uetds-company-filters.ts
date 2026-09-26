export type UetdsCompanyListFilters = {
  query: string;
  status: string;
};

export function parseUetdsCompanyListFilters(input: {
  q?: string;
  status?: string;
}): UetdsCompanyListFilters {
  const status = input.status === "active" || input.status === "inactive" ? input.status : "";
  return {
    query: (input.q ?? "").trim(),
    status,
  };
}

export function uetdsCompanyQueryRecord(
  filters: UetdsCompanyListFilters,
): Record<string, string> {
  return {
    q: filters.query,
    status: filters.status,
  };
}
