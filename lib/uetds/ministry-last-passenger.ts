/** Official SEFER DETAY PDF label. PDF text extract often mangles İ as Ý. Never invent this from created_at. */
const LAST_PASSENGER_LABEL =
  /SON\s+YOLCU\s+B\S{0,3}LD\S{0,3}R\S{0,3}M\s+TAR\S{0,3}H\S{0,3}(?:\s*[-–]?\s*SAAT\S{0,3})?\s*[:\s]*([0-3]\d[./][0-1]\d[./]\d{4}\s+[0-2]\d:[0-5]\d(?::[0-5]\d)?)/i;

export function parseMinistryLastPassengerNotify(text: string) {
  const match = text.match(LAST_PASSENGER_LABEL);
  return match?.[1]?.trim() || null;
}
