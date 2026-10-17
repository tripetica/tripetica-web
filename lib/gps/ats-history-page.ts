export function atsReportIsOpen(query: { ats?: string; atsPage?: string }) {
  if (query.ats === "1") return true;
  const page = Number(query.atsPage);
  return Number.isInteger(page) && page > 1;
}

export function atsReportHref(
  path: string,
  input: { page: number; editMethod?: string; open: boolean },
) {
  const params = new URLSearchParams();
  if (input.editMethod === "1") params.set("editMethod", "1");
  if (input.open) params.set("ats", "1");
  if (input.page > 1) params.set("atsPage", String(input.page));
  const search = params.toString();
  return search ? `${path}?${search}` : path;
}
