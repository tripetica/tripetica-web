export const LUNA_DOCK_DRAG_THRESHOLD = 10;

/** A short tap stays a tap. A mostly vertical move past the threshold drags the panel. */
export function lunaDockDragIntent(dx: number, dy: number) {
  return Math.abs(dy) >= LUNA_DOCK_DRAG_THRESHOLD && Math.abs(dy) > Math.abs(dx);
}

/** Keep a lifted mobile panel inside the viewport. 0 rests on the bottom edge. */
export function clampLunaDockLift(lift: number, viewportHeight: number, dockHeight: number, topGap = 8) {
  const max = Math.max(0, viewportHeight - dockHeight - topGap);
  if (!Number.isFinite(lift)) return 0;
  return Math.min(max, Math.max(0, lift));
}
