import { useCallback, useState } from "react";
import { type AxialHex, hexKey } from "@/lib/hexgrid";

interface PaintAction {
  hex: AxialHex;
  wasRevealed: boolean;
}

/** Ported from viewer.js's paint mode: click-to-toggle a hex with an undo stack.
 * Simplified vs. the original -- the shift-drag multi-hex brush stroke isn't ported
 * yet, only single-hex click toggling. Each toggle is self-inverse, so undo just
 * replays the same toggle again (same trick the original used). */
export function usePaintMode(
  revealedHexes: Set<string>,
  revealHexes: (hexes: AxialHex[]) => void,
  hideHexes: (hexes: AxialHex[]) => void,
) {
  const [active, setActive] = useState(false);
  const [undoStack, setUndoStack] = useState<PaintAction[]>([]);

  const paintHex = useCallback(
    (hex: AxialHex) => {
      const wasRevealed = revealedHexes.has(hexKey(hex.q, hex.r));
      if (wasRevealed) {
        hideHexes([hex]);
      } else {
        revealHexes([hex]);
      }
      setUndoStack((stack) => [...stack, { hex, wasRevealed }]);
    },
    [revealedHexes, revealHexes, hideHexes],
  );

  const undo = useCallback(() => {
    setUndoStack((stack) => {
      if (stack.length === 0) return stack;
      const last = stack[stack.length - 1];
      if (last.wasRevealed) {
        revealHexes([last.hex]);
      } else {
        hideHexes([last.hex]);
      }
      return stack.slice(0, -1);
    });
  }, [hideHexes, revealHexes]);

  const clearUndoStack = useCallback(() => setUndoStack([]), []);

  return { active, setActive, paintHex, undo, canUndo: undoStack.length > 0, clearUndoStack };
}
