export type FloatingLayerBox = {
  top: number;
  left: number;
  bottom: number;
  width: number;
};

export type FloatingLayerViewport = {
  top: number;
  width: number;
  height: number;
};

export type FloatingLayerPlacement = {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
  placement: "below" | "above";
};

export function positionFloatingLayer(input: {
  anchor: FloatingLayerBox;
  contentWidth: number;
  contentHeight: number;
  viewport: FloatingLayerViewport;
  gutter?: number;
  minWidth?: number;
  maxWidth?: number;
}): FloatingLayerPlacement {
  const gutter = input.gutter ?? 8;
  const viewBottom = input.viewport.top + input.viewport.height;
  const availableWidth = Math.max(0, input.viewport.width - gutter * 2);
  const width = Math.min(
    input.maxWidth ?? Number.POSITIVE_INFINITY,
    Math.max(input.minWidth ?? 0, input.contentWidth, input.anchor.width),
    availableWidth || Math.max(input.contentWidth, input.anchor.width),
  );
  const left = Math.max(
    gutter,
    Math.min(input.anchor.left, input.viewport.width - gutter - width),
  );
  const spaceBelow = Math.max(0, viewBottom - input.anchor.bottom - gutter);
  const spaceAbove = Math.max(0, input.anchor.top - input.viewport.top - gutter);
  const needed = Math.max(input.contentHeight, 1);
  const fitsBelow = needed <= spaceBelow;
  const fitsAbove = needed <= spaceAbove;
  const placement: "below" | "above" =
    fitsBelow || (!fitsAbove && spaceBelow >= spaceAbove) ? "below" : "above";
  const available = placement === "below" ? spaceBelow : spaceAbove;
  const maxHeight = Math.max(120, available);
  const usedHeight = Math.min(needed, maxHeight);
  const top =
    placement === "below"
      ? input.anchor.bottom + gutter
      : Math.max(input.viewport.top + gutter, input.anchor.top - gutter - usedHeight);
  return { top, left, width, maxHeight, placement };
}
