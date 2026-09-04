export type Orientation = "pointy" | "flat";

export interface MapSummary {
  id: string;
  name: string;
  base_image_url: string;
  fog_image_url: string;
  image_width: number;
  image_height: number;
  hex_size: number;
  orientation: Orientation;
  origin_x: number;
  origin_y: number;
  sight_radius: number;
  start_q: number;
  start_r: number;
  revealed_hex_count: number;
}

export interface MapStateSnapshot {
  revealed_hexes: [number, number][];
  token: [number, number] | null;
  token_visible: boolean;
}

export type WsMessage =
  | { type: "state"; revealed_hexes: [number, number][]; token: [number, number] | null; token_visible: boolean }
  | { type: "reveal"; hexes: [number, number][] }
  | { type: "hide"; hexes: [number, number][] }
  | { type: "token_move"; token: [number, number]; hexes: [number, number][] }
  | { type: "reset" }
  | { type: "visibility"; visible: boolean };
