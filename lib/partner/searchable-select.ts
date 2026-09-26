/**
 * Locale-safe fold for searchable partner/fleet pickers.
 * Turkish toLocaleLowerCase("tr") maps ASCII "I" → "ı" and "İ" → "i",
 * so "TRIPETICA" and "Tripetica" stop matching. Normalize all I variants to "i".
 */

export const SEARCHABLE_SELECT_TAP_SLOP_PX = 10;

export function foldSearchableSelectText(value: string): string {
  // Map Turkish/ASCII I variants before lowercasing so TRIPETICA ≡ Tripetica ≡ tripetica.
  return value
    .trim()
    .replaceAll(/\u0130/g, "i") // İ
    .replaceAll(/\u0131/g, "i") // ı
    .replaceAll(/I/g, "i")
    .toLocaleLowerCase("en-US");
}

export type SearchableSelectOptionLike = {
  value: string;
  label: string;
};

export function filterSearchableSelectOptions<T extends SearchableSelectOptionLike>(
  options: readonly T[],
  query: string,
): T[] {
  const folded = foldSearchableSelectText(query);
  if (!folded) {
    return [...options];
  }
  return options.filter((option) => foldSearchableSelectText(option.label).includes(folded));
}

export function shouldPreventDefaultOnOptionPointerDown(pointerType: string): boolean {
  // Touch: never preventDefault — that blocks native vertical scroll.
  // Mouse/pen: preventDefault avoids blurring the search input before click.
  return pointerType !== "touch";
}

export function pointerGestureExceededSlop(input: {
  startX: number;
  startY: number;
  x: number;
  y: number;
  slopPx?: number;
}): boolean {
  const slop = input.slopPx ?? SEARCHABLE_SELECT_TAP_SLOP_PX;
  const dx = input.x - input.startX;
  const dy = input.y - input.startY;
  return dx * dx + dy * dy > slop * slop;
}
