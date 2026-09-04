import { type RefObject, useEffect, useRef } from "react";
import { PanZoom, type PanZoomOptions } from "@/lib/panzoom";

/** Instantiates PanZoom (a fully imperative class, see lib/panzoom.ts) against two
 * DOM refs once both are mounted, and tears it down on unmount. Options are only
 * read on mount -- PanZoom manages its own mutable state after that, same as the
 * original vanilla-JS app. */
export function usePanZoom(
  viewportRef: RefObject<HTMLElement>,
  worldRef: RefObject<HTMLElement>,
  options: PanZoomOptions = {},
): RefObject<PanZoom | null> {
  const panZoomRef = useRef<PanZoom | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    const viewport = viewportRef.current;
    const world = worldRef.current;
    if (!viewport || !world) return undefined;

    // Trampolines: PanZoom is constructed once and never recreated (that would
    // reset pan/zoom on every prop change), so its callbacks must read through
    // optionsRef on every call rather than closing over the options from this
    // effect run -- otherwise callbacks would keep seeing stale props forever.
    const instance = new PanZoom(viewport, world, {
      ...optionsRef.current,
      onTap: (x, y, e) => optionsRef.current.onTap?.(x, y, e),
      onDoubleTap: (x, y) => optionsRef.current.onDoubleTap?.(x, y),
      shouldPan: (e) => optionsRef.current.shouldPan?.(e) ?? true,
    });
    panZoomRef.current = instance;
    return () => {
      instance.destroy();
      panZoomRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewportRef, worldRef]);

  return panZoomRef;
}
