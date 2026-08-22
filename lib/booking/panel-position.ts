import { type CSSProperties } from "react";

export function panelAboveField(
  fieldBox: DOMRect | null,
  options?: { minWidth?: number; maxWidth?: number; maxHeight?: number },
): CSSProperties | undefined {
  if (!fieldBox || typeof window === "undefined") {
    return undefined;
  }

  const gutter = 8;
  const minWidth = options?.minWidth ?? 280;
  const maxWidth = options?.maxWidth ?? 520;
  const capHeight = options?.maxHeight ?? 420;
  const width = Math.min(
    maxWidth,
    Math.max(minWidth, fieldBox.width),
    window.innerWidth - gutter * 2,
  );
  const left = Math.max(
    gutter,
    Math.min(fieldBox.left, window.innerWidth - gutter - width),
  );
  const viewport = window.visualViewport;
  const viewTop = viewport?.offsetTop ?? 0;
  const spaceAbove = Math.max(120, fieldBox.top - viewTop - gutter);
  const maxHeight = Math.min(capHeight, spaceAbove);
  const top = Math.max(viewTop + gutter, fieldBox.top - 8 - maxHeight);

  return {
    top,
    left,
    width,
    maxHeight,
  };
}
