/**
 * Prefer the named place identity (airport / hotel / POI) over a trailing street
 * fragment when AI or pasted text returns a comma-separated full address line.
 * Does not invent places: street-only input is left unchanged for Places resolve.
 */
export function preferUetdsPlaceQuery(value: string): string {
  const trimmed = value.replace(/\s+/g, " ").trim();
  if (!trimmed) {
    return "";
  }
  const parts = trimmed
    .split(/[,;]/)
    .map((part) => part.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  if (parts.length < 2) {
    return trimmed;
  }
  for (const part of parts) {
    if (looksLikePrimaryPlaceIdentity(part)) {
      return part;
    }
  }
  return trimmed;
}

function looksLikePrimaryPlaceIdentity(value: string) {
  const folded = value
    .toLocaleUpperCase("tr-TR")
    .replace(/İ/g, "I")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "");
  if (
    /\b(AIRPORT|HAVALIMANI|HAVAALANI|ULUSLARARASI\s+HAVALIMANI|INTERNATIONAL\s+AIRPORT)\b/.test(
      folded,
    )
  ) {
    return true;
  }
  // Strong IATA only when paired with airport wording or explicit (IST)/(SAW) label.
  if (/\(([A-Z]{3})\)/.test(folded) && /\b(AIRPORT|HAVALIMANI|HAVAALANI)\b/.test(folded)) {
    return true;
  }
  if (
    /\b(HOTEL|OTEL|RESORT|HOSTEL|SUITE|SUITES|INN|APART|APARTMAN|RESIDENCE|MOTEL|PANSİYON|PANSIYON)\b/.test(
      folded,
    )
  ) {
    return true;
  }
  return false;
}
