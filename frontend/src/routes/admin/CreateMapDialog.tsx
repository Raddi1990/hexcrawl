import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { api } from "@/lib/api";
import type { MapSummary } from "@/lib/types";

export function CreateMapDialog({ onCreated }: { onCreated: (map: MapSummary) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [baseImage, setBaseImage] = useState<File | null>(null);
  const [fogImage, setFogImage] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!baseImage || !fogImage) {
      toast.error("Bitte Karten- und Nebelbild auswählen.");
      return;
    }
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.set("name", name);
      formData.set("base_image", baseImage);
      formData.set("fog_image", fogImage);
      const created = await api.postForm<MapSummary>("/api/maps", formData);
      toast.success(`Karte „${created.name}“ erstellt.`);
      onCreated(created);
      setOpen(false);
      setName("");
      setBaseImage(null);
      setFogImage(null);
    } catch {
      toast.error("Karte konnte nicht erstellt werden.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Neue Karte</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Neue Karte anlegen</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="map-name">Name</Label>
            <Input id="map-name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="base-image">Kartenbild</Label>
            <Input
              id="base-image"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => setBaseImage(e.target.files?.[0] ?? null)}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="fog-image">Nebelbild</Label>
            <Input
              id="fog-image"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => setFogImage(e.target.files?.[0] ?? null)}
              required
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Wird erstellt…" : "Erstellen"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
