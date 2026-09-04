import type { WsMessage } from "./types";

export interface MapSocketHandlers {
  onOpen?: () => void;
  onClose?: () => void;
  onMessage: (message: WsMessage) => void;
}

export interface MapSocket {
  send: (message: Record<string, unknown>) => void;
  close: () => void;
}

/** Reconnecting WS client with capped exponential backoff. Replaces the old app's
 * 3s `setInterval` polling entirely -- the server pushes on every change instead. */
export function createMapSocket(mapId: string, handlers: MapSocketHandlers): MapSocket {
  let socket: WebSocket | null = null;
  let closedByCaller = false;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let reconnectDelayMs = 1000;

  function connect(): void {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    socket = new WebSocket(`${protocol}//${window.location.host}/ws/maps/${encodeURIComponent(mapId)}`);

    socket.addEventListener("open", () => {
      reconnectDelayMs = 1000;
      handlers.onOpen?.();
    });
    socket.addEventListener("message", (event) => {
      try {
        handlers.onMessage(JSON.parse(event.data as string) as WsMessage);
      } catch {
        // ignore malformed frames
      }
    });
    socket.addEventListener("close", () => {
      handlers.onClose?.();
      if (closedByCaller) return;
      reconnectTimer = setTimeout(connect, reconnectDelayMs);
      reconnectDelayMs = Math.min(reconnectDelayMs * 1.5, 10_000);
    });
    socket.addEventListener("error", () => {
      socket?.close();
    });
  }

  connect();

  return {
    send(message) {
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(message));
      }
    },
    close() {
      closedByCaller = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      socket?.close();
    },
  };
}
