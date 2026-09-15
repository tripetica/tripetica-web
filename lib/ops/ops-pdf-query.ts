export function opsPdfFlag(value: boolean) {
  return value ? "1" : "0";
}

export function parseOpsPdfIncludeFlag(value: string | null) {
  return value === "1";
}

export function parseOpsReservationPdfFlags(searchParams: URLSearchParams) {
  return {
    includeContact: parseOpsPdfIncludeFlag(searchParams.get("includeContact")),
    includePricing: parseOpsPdfIncludeFlag(searchParams.get("includePricing")),
  };
}

export function opsReservationPdfHref(
  pdfHref: string,
  flags: { includeContact: boolean; includePricing: boolean },
) {
  const params = new URLSearchParams();
  params.set("includeContact", opsPdfFlag(flags.includeContact));
  params.set("includePricing", opsPdfFlag(flags.includePricing));
  return `${pdfHref}?${params.toString()}`;
}
