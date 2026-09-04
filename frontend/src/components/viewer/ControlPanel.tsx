import { Settings, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { MapSummary } from "@/lib/types";

interface ControlPanelProps {
  maps: MapSummary[];
  currentMapId: string;
  onSelectMap: (id: string) => void;
  gridVisible: boolean;
  onToggleGrid: (v: boolean) => void;
  fogOpacity: number;
  onFogOpacityChange: (v: number) => void;
  isAdmin: boolean;
  tokenVisible: boolean;
  onToggleTokenVisible: (v: boolean) => void;
  paintMode: boolean;
  onTogglePaintMode: (v: boolean) => void;
  canUndo: boolean;
  onUndo: () => void;
  onResetFog: () => void;
}

export function ControlPanel(props: ControlPanelProps) {
  const {
    maps,
    currentMapId,
    onSelectMap,
    gridVisible,
    onToggleGrid,
    fogOpacity,
    onFogOpacityChange,
    isAdmin,
    tokenVisible,
    onToggleTokenVisible,
    paintMode,
    onTogglePaintMode,
    canUndo,
    onUndo,
    onResetFog,
  } = props;

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="secondary" size="icon" className="no-pan">
          <Settings className="h-4 w-4" />
          <span className="sr-only">Einstellungen</span>
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Karte &amp; Ansicht</SheetTitle>
        </SheetHeader>

        <div className="flex flex-col gap-4">
          {maps.length > 1 && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="map-select">Karte</Label>
              <select
                id="map-select"
                value={currentMapId}
                onChange={(e) => onSelectMap(e.target.value)}
                className="h-9 rounded-md border border-input bg-card px-3 text-sm"
              >
                {maps.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex items-center justify-between">
            <Label htmlFor="grid-toggle">Hex-Raster anzeigen</Label>
            <Switch id="grid-toggle" checked={gridVisible} onCheckedChange={onToggleGrid} />
          </div>
        </div>

        {isAdmin && (
          <div className="flex flex-col gap-4 border-t border-border pt-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Spielleitung</p>

            {/* Admin-only by design: this only dims the fog canvas locally (never
                touches server state), but letting a player use it would let them
                see through fog they haven't actually revealed on their own screen. */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="fog-opacity">Nebel-Deckkraft (nur lokal, GM-Blick durch den Nebel)</Label>
              <Slider
                id="fog-opacity"
                min={0}
                max={100}
                step={1}
                value={[fogOpacity]}
                onValueChange={([v]) => onFogOpacityChange(v)}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="token-visible">Token für Spieler sichtbar</Label>
              <Switch id="token-visible" checked={tokenVisible} onCheckedChange={onToggleTokenVisible} />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="paint-mode">Hex-Malmodus</Label>
              <Switch id="paint-mode" checked={paintMode} onCheckedChange={onTogglePaintMode} />
            </div>
            {paintMode && (
              <p className="-mt-2 text-xs text-muted-foreground">
                Klick: einzelnes Hex umschalten. Umschalt-Taste + Ziehen: mehrere Hexe in einem Zug malen.
              </p>
            )}

            {paintMode && (
              <Button variant="outline" size="sm" onClick={onUndo} disabled={!canUndo}>
                <Undo2 className="h-4 w-4" /> Rückgängig
              </Button>
            )}

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  Nebel zurücksetzen
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Nebel wirklich zurücksetzen?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Der gesamte aufgedeckte Bereich dieser Karte wird zurückgesetzt. Das kann nicht rückgängig
                    gemacht werden.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                  <AlertDialogAction onClick={onResetFog}>Zurücksetzen</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
