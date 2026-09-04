import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import type { MapSummary } from "@/lib/types";
import { useAuth } from "@/hooks/useAuth";
import { useMapState } from "@/hooks/useMapState";
import { usePaintMode } from "@/hooks/usePaintMode";
import { MapViewport } from "@/components/viewer/MapViewport";
import { ControlPanel } from "@/components/viewer/ControlPanel";
import { ConnectionStatus } from "@/components/viewer/ConnectionStatus";
import { Button } from "@/components/ui/button";

const FOG_OPACITY_STORAGE_KEY = "hexcrawl_fogOpacity";

export function ViewerPage() {
  const { username } = useAuth();
  const isAdmin = username !== null;

  const [maps, setMaps] = useState<MapSummary[] | null>(null);
  const [currentMapId, setCurrentMapId] = useState<string | null>(null);
  const [gridVisible, setGridVisible] = useState(false);
  const [fogOpacity, setFogOpacity] = useState(() => {
    const stored = localStorage.getItem(FOG_OPACITY_STORAGE_KEY);
    return stored !== null ? Number(stored) : 100;
  });

  useEffect(() => {
    api.get<MapSummary[]>("/api/maps").then((list) => {
      setMaps(list);
      if (list.length > 0) setCurrentMapId(list[0].id);
    });
  }, []);

  const currentMap = maps?.find((m) => m.id === currentMapId) ?? null;
  const { revealedHexes, token, tokenVisible, connected, revealHexes, hideHexes, moveToken, resetFog, setVisibility } =
    useMapState(currentMapId);
  const paint = usePaintMode(revealedHexes, revealHexes, hideHexes);

  function handleFogOpacityChange(value: number) {
    setFogOpacity(value);
    localStorage.setItem(FOG_OPACITY_STORAGE_KEY, String(value));
  }

  function handleSelectMap(id: string) {
    setCurrentMapId(id);
    paint.setActive(false);
    paint.clearUndoStack();
  }

  if (maps === null) {
    return <div className="flex h-screen items-center justify-center text-muted-foreground">Lade…</div>;
  }

  if (maps.length === 0) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 text-center">
        <p className="text-muted-foreground">Keine Karten vorhanden.</p>
        {isAdmin && (
          <Button asChild>
            <Link to="/admin">Zum Admin-Bereich</Link>
          </Button>
        )}
      </div>
    );
  }

  if (!currentMap) {
    return <div className="flex h-screen items-center justify-center text-muted-foreground">Lade Karte…</div>;
  }

  return (
    <div className="relative h-screen w-screen">
      <MapViewport
        map={currentMap}
        revealedHexes={revealedHexes}
        token={token}
        tokenVisible={tokenVisible}
        isAdmin={isAdmin}
        gridVisible={gridVisible}
        fogOpacity={fogOpacity}
        paintMode={isAdmin && paint.active}
        onPaintHex={paint.paintHex}
        onMoveToken={moveToken}
      />

      <div className="absolute right-3 top-3 flex items-center gap-2">
        <ConnectionStatus connected={connected} />
        <ControlPanel
          maps={maps}
          currentMapId={currentMap.id}
          onSelectMap={handleSelectMap}
          gridVisible={gridVisible}
          onToggleGrid={setGridVisible}
          fogOpacity={fogOpacity}
          onFogOpacityChange={handleFogOpacityChange}
          isAdmin={isAdmin}
          tokenVisible={tokenVisible}
          onToggleTokenVisible={setVisibility}
          paintMode={paint.active}
          onTogglePaintMode={paint.setActive}
          canUndo={paint.canUndo}
          onUndo={paint.undo}
          onResetFog={resetFog}
        />
      </div>

      {isAdmin && (
        <Button asChild variant="secondary" size="sm" className="no-pan absolute left-3 top-3">
          <Link to="/admin">Admin</Link>
        </Button>
      )}
    </div>
  );
}
