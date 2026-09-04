import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import type { MapSummary, Orientation } from "@/lib/types";
import { useMapState } from "@/hooks/useMapState";
import { MapViewport } from "@/components/viewer/MapViewport";

type CalibrationDraft = Pick<
  MapSummary,
  "hex_size" | "orientation" | "origin_x" | "origin_y" | "sight_radius" | "start_q" | "start_r"
>;

function draftFromMap(m: MapSummary): CalibrationDraft {
  return {
    hex_size: m.hex_size,
    orientation: m.orientation,
    origin_x: m.origin_x,
    origin_y: m.origin_y,
    sight_radius: m.sight_radius,
    start_q: m.start_q,
    start_r: m.start_r,
  };
}

export function AdminCalibratePage() {
  const { mapId } = useParams<{ mapId: string }>();
  const navigate = useNavigate();
  const [map, setMap] = useState<MapSummary | null>(null);
  const [draft, setDraft] = useState<CalibrationDraft | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!mapId) return;
    api.get<MapSummary>(`/api/maps/${mapId}`).then((m) => {
      setMap(m);
      setDraft(draftFromMap(m));
    });
  }, [mapId]);

  const { revealedHexes, token, tokenVisible, moveToken } = useMapState(mapId ?? null);

  function updateDraft<K extends keyof CalibrationDraft>(key: K, value: CalibrationDraft[K]) {
    setDraft((d) => (d ? { ...d, [key]: value } : d));
  }

  async function handleSave() {
    if (!map || !draft) return;
    setSaving(true);
    try {
      const formData = new FormData();
      formData.set("hex_size", String(draft.hex_size));
      formData.set("orientation", draft.orientation);
      formData.set("origin_x", String(draft.origin_x));
      formData.set("origin_y", String(draft.origin_y));
      formData.set("sight_radius", String(draft.sight_radius));
      formData.set("start_q", String(draft.start_q));
      formData.set("start_r", String(draft.start_r));
      const updated = await api.patchForm<MapSummary>(`/api/maps/${map.id}`, formData);
      setMap(updated);
      toast.success("Kalibrierung gespeichert.");
    } catch {
      toast.error("Speichern fehlgeschlagen.");
    } finally {
      setSaving(false);
    }
  }

  if (!map || !draft) {
    return <div className="flex h-screen items-center justify-center text-muted-foreground">Lade…</div>;
  }

  const previewMap: MapSummary = { ...map, ...draft };

  return (
    <div className="flex h-screen">
      <div className="flex w-80 flex-none flex-col gap-4 overflow-y-auto border-r border-border p-4">
        <Button variant="outline" size="sm" className="self-start" onClick={() => navigate("/admin")}>
          ← Zurück
        </Button>
        <h1 className="text-lg font-semibold">{map.name}</h1>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="hex-size">Hexgröße (px)</Label>
          <Input
            id="hex-size"
            type="number"
            value={draft.hex_size}
            onChange={(e) => updateDraft("hex_size", Number(e.target.value))}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="orientation">Ausrichtung</Label>
          <select
            id="orientation"
            value={draft.orientation}
            onChange={(e) => updateDraft("orientation", e.target.value as Orientation)}
            className="h-9 rounded-md border border-input bg-card px-3 text-sm"
          >
            <option value="pointy">Spitze oben</option>
            <option value="flat">Kante oben</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="origin-x">Ursprung X</Label>
            <Input
              id="origin-x"
              type="number"
              value={draft.origin_x}
              onChange={(e) => updateDraft("origin_x", Number(e.target.value))}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="origin-y">Ursprung Y</Label>
            <Input
              id="origin-y"
              type="number"
              value={draft.origin_y}
              onChange={(e) => updateDraft("origin_y", Number(e.target.value))}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="sight-radius">Sichtradius (Hexe)</Label>
          <Input
            id="sight-radius"
            type="number"
            min={0}
            value={draft.sight_radius}
            onChange={(e) => updateDraft("sight_radius", Number(e.target.value))}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="start-q">Start Q</Label>
            <Input
              id="start-q"
              type="number"
              value={draft.start_q}
              onChange={(e) => updateDraft("start_q", Number(e.target.value))}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="start-r">Start R</Label>
            <Input
              id="start-r"
              type="number"
              value={draft.start_r}
              onChange={(e) => updateDraft("start_r", Number(e.target.value))}
            />
          </div>
        </div>

        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Speichert…" : "Speichern"}
        </Button>
        <p className="text-xs text-muted-foreground">
          Die Vorschau rechts zeigt das Raster live mit den obigen Werten, inklusive Pan/Zoom. Strg-Klick auf die
          Karte (Tablet: Doppeltipp), oder den Token ziehen, setzt ihn direkt (live für alle Zuschauer).
          Klick-zum-Setzen des Ursprungs ist noch nicht umgesetzt -- Ursprung bitte über die Zahlenfelder justieren.
        </p>
      </div>

      <div className="flex-1">
        <MapViewport
          map={previewMap}
          revealedHexes={revealedHexes}
          token={token}
          tokenVisible={tokenVisible}
          isAdmin
          gridVisible
          fogOpacity={100}
          paintMode={false}
          onMoveToken={moveToken}
        />
      </div>
    </div>
  );
}
