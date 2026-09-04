import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
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
import { api } from "@/lib/api";
import type { MapSummary } from "@/lib/types";
import { useAuth } from "@/hooks/useAuth";
import { CreateMapDialog } from "./CreateMapDialog";

export function AdminMapListPage() {
  const { username, logout } = useAuth();
  const navigate = useNavigate();
  const [maps, setMaps] = useState<MapSummary[] | null>(null);

  useEffect(() => {
    api.get<MapSummary[]>("/api/maps").then(setMaps);
  }, []);

  async function handleDuplicate(map: MapSummary) {
    try {
      const copy = await api.post<MapSummary>(`/api/maps/${map.id}/duplicate`);
      setMaps((prev) => [...(prev ?? []), copy]);
      toast.success(`„${map.name}“ dupliziert.`);
    } catch {
      toast.error("Duplizieren fehlgeschlagen.");
    }
  }

  async function handleDelete(map: MapSummary) {
    try {
      await api.delete(`/api/maps/${map.id}`);
      setMaps((prev) => prev?.filter((m) => m.id !== map.id) ?? null);
      toast.success(`„${map.name}“ gelöscht.`);
    } catch {
      toast.error("Löschen fehlgeschlagen.");
    }
  }

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Karten verwalten</h1>
          <p className="text-sm text-muted-foreground">Angemeldet als {username}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to="/">Zur Ansicht</Link>
          </Button>
          <Button variant="outline" onClick={handleLogout}>
            Abmelden
          </Button>
          {maps && <CreateMapDialog onCreated={(map) => setMaps((prev) => [...(prev ?? []), map])} />}
        </div>
      </div>

      {maps === null && <p className="text-muted-foreground">Lade…</p>}
      {maps?.length === 0 && <p className="text-muted-foreground">Noch keine Karten vorhanden.</p>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {maps?.map((map) => (
          <Card key={map.id} className="overflow-hidden">
            <img src={map.base_image_url} alt={map.name} className="h-36 w-full object-cover" />
            <CardHeader>
              <CardTitle>{map.name}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-1.5 text-xs text-muted-foreground">
              <span className="rounded-full border border-border px-2 py-0.5">
                {map.image_width}×{map.image_height}
              </span>
              <span className="rounded-full border border-border px-2 py-0.5">
                Hex {map.hex_size}px, {map.orientation === "pointy" ? "spitz" : "flach"}
              </span>
              <span className="rounded-full border border-border px-2 py-0.5">
                {map.revealed_hex_count} Hexe aufgedeckt
              </span>
            </CardContent>
            <CardFooter className="flex-wrap">
              <Button size="sm" asChild>
                <Link to={`/admin/maps/${map.id}`}>Kalibrieren</Link>
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleDuplicate(map)}>
                Duplizieren
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="destructive">
                    Löschen
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>„{map.name}“ wirklich löschen?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Karte, Bilder und aufgedeckter Nebel werden unwiderruflich gelöscht.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                    <AlertDialogAction onClick={() => handleDelete(map)}>Löschen</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
