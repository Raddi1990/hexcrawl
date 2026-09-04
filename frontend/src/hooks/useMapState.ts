import { useCallback, useEffect, useRef, useState } from "react";
import { hexKey, type AxialHex } from "@/lib/hexgrid";
import { createMapSocket, type MapSocket } from "@/lib/ws";
import type { WsMessage } from "@/lib/types";

export interface MapStateData {
  revealedHexes: Set<string>;
  token: AxialHex | null;
  tokenVisible: boolean;
  connected: boolean;
}

const EMPTY_STATE: MapStateData = {
  revealedHexes: new Set(),
  token: null,
  tokenVisible: false,
  connected: false,
};

/** Live map state, subscribed over WebSocket. Mutator calls apply optimistically
 * to local state immediately, then send the mutation to the server -- the server's
 * own broadcast (echoed back to the sender too) reconciles afterwards, which is a
 * no-op in the common case since our optimistic update already matches it. */
export function useMapState(mapId: string | null) {
  const [data, setData] = useState<MapStateData>(EMPTY_STATE);
  const socketRef = useRef<MapSocket | null>(null);

  useEffect(() => {
    if (!mapId) return undefined;
    setData(EMPTY_STATE);

    const socket = createMapSocket(mapId, {
      onOpen: () => setData((d) => ({ ...d, connected: true })),
      onClose: () => setData((d) => ({ ...d, connected: false })),
      onMessage: (message) => applyMessage(message),
    });
    socketRef.current = socket;
    return () => {
      socket.close();
      socketRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapId]);

  function applyMessage(message: WsMessage): void {
    setData((d) => {
      switch (message.type) {
        case "state":
          return {
            ...d,
            revealedHexes: new Set(message.revealed_hexes.map(([q, r]) => hexKey(q, r))),
            token: message.token ? { q: message.token[0], r: message.token[1] } : null,
            tokenVisible: message.token_visible,
          };
        case "reveal": {
          const next = new Set(d.revealedHexes);
          for (const [q, r] of message.hexes) next.add(hexKey(q, r));
          return { ...d, revealedHexes: next };
        }
        case "hide": {
          const next = new Set(d.revealedHexes);
          for (const [q, r] of message.hexes) next.delete(hexKey(q, r));
          return { ...d, revealedHexes: next };
        }
        case "token_move": {
          const next = new Set(d.revealedHexes);
          for (const [q, r] of message.hexes) next.add(hexKey(q, r));
          return { ...d, revealedHexes: next, token: { q: message.token[0], r: message.token[1] } };
        }
        case "reset":
          return { ...d, revealedHexes: new Set() };
        case "visibility":
          return { ...d, tokenVisible: message.visible };
        default:
          return d;
      }
    });
  }

  const send = useCallback((message: Record<string, unknown>) => {
    socketRef.current?.send(message);
  }, []);

  const revealHexes = useCallback(
    (hexes: AxialHex[]) => {
      if (hexes.length === 0) return;
      setData((d) => {
        const next = new Set(d.revealedHexes);
        for (const h of hexes) next.add(hexKey(h.q, h.r));
        return { ...d, revealedHexes: next };
      });
      send({ type: "reveal", hexes: hexes.map((h) => [h.q, h.r]) });
    },
    [send],
  );

  const hideHexes = useCallback(
    (hexes: AxialHex[]) => {
      if (hexes.length === 0) return;
      setData((d) => {
        const next = new Set(d.revealedHexes);
        for (const h of hexes) next.delete(hexKey(h.q, h.r));
        return { ...d, revealedHexes: next };
      });
      send({ type: "hide", hexes: hexes.map((h) => [h.q, h.r]) });
    },
    [send],
  );

  const moveToken = useCallback(
    (q: number, r: number) => {
      setData((d) => ({ ...d, token: { q, r } }));
      send({ type: "token_move", q, r });
    },
    [send],
  );

  const resetFog = useCallback(() => {
    setData((d) => ({ ...d, revealedHexes: new Set() }));
    send({ type: "reset" });
  }, [send]);

  const setVisibility = useCallback(
    (visible: boolean) => {
      setData((d) => ({ ...d, tokenVisible: visible }));
      send({ type: "visibility", visible });
    },
    [send],
  );

  return { ...data, revealHexes, hideHexes, moveToken, resetFog, setVisibility };
}
