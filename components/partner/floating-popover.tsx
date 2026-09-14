"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { shouldDismissFloatingPopoverOnOutsidePress } from "@/lib/partner/floating-popover-dismiss";
import { positionFloatingLayer } from "@/lib/partner/floating-layer";

type FloatingPopoverProps = {
  open: boolean;
  anchorRef: RefObject<HTMLElement | null>;
  onDismiss: () => void;
  dismissOnOutsidePress?: boolean;
  className?: string;
  minWidth?: number;
  maxWidth?: number;
  preferHeight?: number;
  children: ReactNode;
};

function isExemptOutsideTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) {
    return false;
  }
  return Boolean(
    target.closest(".country-picker-panel") ||
      target.closest(".country-picker-sheet") ||
      target.closest(".country-picker-backdrop"),
  );
}

export function FloatingPopover({
  open,
  anchorRef,
  onDismiss,
  dismissOnOutsidePress = true,
  className,
  minWidth = 260,
  maxWidth = 380,
  preferHeight = 280,
  children,
}: FloatingPopoverProps) {
  const layerRef = useRef<HTMLDivElement>(null);
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;
  const dismissOnOutsidePressRef = useRef(dismissOnOutsidePress);
  dismissOnOutsidePressRef.current = dismissOnOutsidePress;
  const [mounted, setMounted] = useState(false);
  const [style, setStyle] = useState<CSSProperties>();

  useEffect(() => {
    setMounted(true);
  }, []);

  const update = useCallback(() => {
    const anchor = anchorRef.current;
    if (!anchor) {
      return;
    }
    const rect = anchor.getBoundingClientRect();
    const viewport = window.visualViewport;
    const contentHeight = layerRef.current?.scrollHeight || preferHeight;
    const placed = positionFloatingLayer({
      anchor: {
        top: rect.top,
        left: rect.left,
        bottom: rect.bottom,
        width: rect.width,
      },
      contentWidth: layerRef.current?.offsetWidth || Math.max(rect.width, minWidth),
      contentHeight,
      viewport: {
        top: viewport?.offsetTop ?? 0,
        width: viewport?.width ?? window.innerWidth,
        height: viewport?.height ?? window.innerHeight,
      },
      minWidth,
      maxWidth,
    });
    const clipped = contentHeight > placed.maxHeight + 1;
    setStyle({
      position: "fixed",
      top: placed.top,
      left: placed.left,
      width: placed.width,
      maxHeight: placed.maxHeight,
      overflowY: clipped ? "auto" : "visible",
      zIndex: 200,
    });
  }, [anchorRef, maxWidth, minWidth, preferHeight]);

  useLayoutEffect(() => {
    if (!open) {
      return;
    }
    update();
    const node = layerRef.current;
    const observer = node ? new ResizeObserver(() => update()) : null;
    if (node) {
      observer?.observe(node);
    }
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    window.visualViewport?.addEventListener("resize", update);
    window.visualViewport?.addEventListener("scroll", update);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
      window.visualViewport?.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("scroll", update);
    };
  }, [open, update]);

  useEffect(() => {
    if (!open) {
      return;
    }
    function onPointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }
      if (
        !shouldDismissFloatingPopoverOnOutsidePress({
          dismissOnOutsidePress: dismissOnOutsidePressRef.current,
          targetInsideLayer: Boolean(layerRef.current?.contains(target)),
          targetInsideAnchor: Boolean(anchorRef.current?.contains(target)),
          targetExempt: isExemptOutsideTarget(event.target),
        })
      ) {
        return;
      }
      onDismissRef.current();
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") {
        return;
      }
      event.preventDefault();
      onDismissRef.current();
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [anchorRef, open]);

  if (!open || !mounted || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      ref={layerRef}
      className={className}
      style={style ?? { position: "fixed", top: 0, left: 0, visibility: "hidden" }}
      data-floating-popover="true"
    >
      {children}
    </div>,
    document.body,
  );
}
