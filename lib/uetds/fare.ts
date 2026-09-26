/** V15 grupUcret is a string. Preserve the existing nonnegative decimal/zero contract. */
export function normalizeUetdsFare(value: string): string | null {
  const text = value.trim().replace(",", ".");
  if (!/^\d+(?:\.\d+)?$/.test(text) || !Number.isFinite(Number(text))) return null;
  return text;
}
