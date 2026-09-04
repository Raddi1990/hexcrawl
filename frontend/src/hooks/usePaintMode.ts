import { useCallback, useRef, useState } from "react";
import { type AxialHex, hexKey } from "@/lib/hexgrid";

interface PaintAction {
  hexes: AxialHex[];
  revealed: boolean;
}

interface BrushState {
  active: boolean;
  pointerId: number | null;
  revealing: boolean;
  lastKey: string | null;
  changes: AxialHex[];
}

const IDLE_BRUSH: BrushState = { active: false, pointerId: null, revealing: true, lastKey: null, changes: [] };

/** Ported from viewer.js's paint mode: click-to-toggle a single hex, and (new)
 * shift-drag to paint/erase a whole stroke of hexes in one gesture, both with a
 * combined undo stack. Each toggle/stroke is self-inverse, so undo just replays it. */
export function usePaintMode(
  revealedHexes: Set<string>,
  revealHexes: (hexes: AxialHex[]) => void,
  hideHexes: (hexes: AxialHex[]) => void,
) {
  const [active, setActive] = useState(false);
  const [undoStack, setUndoStack] = useState<PaintAction[]>([]);

  const revealedHexesRef = useRef(revealedHexes);
  revealedHexesRef.current = revealedHexes;

  const brushRef = useRef<BrushState>(IDLE_BRUSH);

  const paintHex = useCallback(
    (hex: AxialHex) => {
      const wasRevealed = revealedHexesRef.current.has(hexKey(hex.q, hex.r));
      if (wasRevealed) {
        hideHexes([hex]);
      } else {
        revealHexes([hex]);
      }
      setUndoStack((stack) => [...stack, { hexes: [hex], revealed: !wasRevealed }]);
    },
    [hideHexes, revealHexes],
  );

  const applyBrushHex = useCallback(
    (hex: AxialHex) => {
      const brush = brushRef.current;
      if (!brush.active) return;
      const key = hexKey(hex.q, hex.r);
      if (key === brush.lastKey) return;
      brush.lastKey = key;
      const isRevealed = revealedHexesRef.current.has(key);
      if (isRevealed === brush.revealing) return; // already in the target state
      if (brush.revealing) {
        revealHexes([hex]);
      } else {
        hideHexes([hex]);
      }
      brush.changes.push(hex);
    },
    [hideHexes, revealHexes],
  );

  /** Pointer went down with shift held: decide the stroke's direction from the
   * first hex under the cursor (same as the original), then apply it. */
  const startBrush = useCallback(
    (pointerId: number, hex: AxialHex) => {
      const revealing = !revealedHexesRef.current.has(hexKey(hex.q, hex.r));
      brushRef.current = { active: true, pointerId, revealing, lastKey: null, changes: [] };
      applyBrushHex(hex);
    },
    [applyBrushHex],
  );

  const moveBrush = applyBrushHex;

  const endBrush = useCallback(() => {
    const brush = brushRef.current;
    if (!brush.active) return;
    if (brush.changes.length > 0) {
      setUndoStack((stack) => [...stack, { hexes: brush.changes, revealed: brush.revealing }]);
    }
    brushRef.current = IDLE_BRUSH;
  }, []);

  const undo = useCallback(() => {
    setUndoStack((stack) => {
      if (stack.length === 0) return stack;
      const last = stack[stack.length - 1];
      if (last.revealed) {
        hideHexes(last.hexes);
      } else {
        revealHexes(last.hexes);
      }
      return stack.slice(0, -1);
    });
  }, [hideHexes, revealHexes]);

  const clearUndoStack = useCallback(() => setUndoStack([]), []);

  return {
    active,
    setActive,
    paintHex,
    startBrush,
    moveBrush,
    endBrush,
    undo,
    canUndo: undoStack.length > 0,
    clearUndoStack,
  };
}
