import { type CSSProperties } from "react";

type PanelPositionOptions = {
  minWidth?: number;
  maxWidth?: number;
  maxHeight?: number;
  prefer?: "above" | "below";
};

export function panelBelowField(
  fieldBox: DOMRect | null,
  options?: {
    maxHeight?: number;
    gutter?: number;
    minWidth?: number;
    maxWidth?: number;
  },
): CSSProperties | undefined {
  if (!fieldBox || typeof window === "undefined") {
    return undefined;
  }

  const gutter = options?.gutter ?? 6;
  const capHeight = options?.maxHeight ?? 400;
  const viewport = window.visualViewport;
  const viewTop = viewport?.offsetTop ?? 0;
  const viewHeight = viewport?.height ?? window.innerHeight;
  const viewBottom = viewTop + viewHeight;
  const viewWidth = viewport?.width ?? window.innerWidth;
  const availableWidth = Math.max(0, viewWidth - gutter * 2);
  let width = fieldBox.width;
  if (options?.minWidth) {
    width = Math.max(width, options.minWidth);
  }
  if (options?.maxWidth) {
    width = Math.min(width, options.maxWidth);
  }
  width = Math.min(width, availableWidth || width);
  const left = Math.max(
    gutter,
    Math.min(fieldBox.left, viewWidth - gutter - width),
  );
  const spaceBelow = Math.max(0, viewBottom - fieldBox.bottom - gutter);
  const maxHeight = Math.min(capHeight, spaceBelow || capHeight);

  return {
    position: "fixed",
    top: fieldBox.bottom + gutter,
    left,
    width,
    maxHeight,
    zIndex: 110,
  };
}

export function panelAboveField(
  fieldBox: DOMRect | null,
  options?: Omit<PanelPositionOptions, "prefer">,
): CSSProperties | undefined {
  return positionAnchoredPanel(fieldBox, { ...options, prefer: "above" });
}

export function positionAnchoredPanel(
  fieldBox: DOMRect | null,
  options?: PanelPositionOptions,
): CSSProperties | undefined {
  if (!fieldBox || typeof window === "undefined") {
    return undefined;
  }

  const gutter = 8;
  const minWidth = options?.minWidth ?? 280;
  const maxWidth = options?.maxWidth ?? 520;
  const capHeight = options?.maxHeight ?? 420;
  const prefer = options?.prefer ?? "above";
  const viewport = window.visualViewport;
  const viewTop = viewport?.offsetTop ?? 0;
  const viewHeight = viewport?.height ?? window.innerHeight;
  const viewBottom = viewTop + viewHeight;
  const width = Math.min(
    maxWidth,
    Math.max(minWidth, fieldBox.width),
    window.innerWidth - gutter * 2,
  );
  const left = Math.max(
    gutter,
    Math.min(fieldBox.left, window.innerWidth - gutter - width),
  );
  const spaceAbove = Math.max(0, fieldBox.top - viewTop - gutter);
  const spaceBelow = Math.max(0, viewBottom - fieldBox.bottom - gutter);
  const minComfort = Math.min(280, capHeight);
  const placeBelow =
    prefer === "below"
      ? spaceBelow >= minComfort || spaceBelow >= spaceAbove
      : spaceBelow > spaceAbove && spaceAbove < minComfort;
  const available = placeBelow ? spaceBelow : spaceAbove;
  const maxHeight = Math.min(capHeight, Math.max(180, available));
  const top = placeBelow
    ? Math.min(fieldBox.bottom + gutter, viewBottom - gutter - maxHeight)
    : Math.max(viewTop + gutter, fieldBox.top - gutter - maxHeight);

  return {
    top,
    left,
    width,
    maxHeight,
  };
}
