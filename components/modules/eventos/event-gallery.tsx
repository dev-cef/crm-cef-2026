"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { addPhotos, removePhoto } from "@/app/(app)/eventos/actions";
import { Button } from "@/components/ui/button";

function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

export function EventGallery({
  eventId,
  photos,
}: {
  eventId: string;
  photos: { id: string; url: string }[];
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);

  async function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setBusy(true);
    try {
      const valid = files.filter(
        (f) =>
          ["image/jpeg", "image/png", "image/webp"].includes(f.type) &&
          f.size <= 3 * 1024 * 1024,
      );
      if (valid.length === 0) {
        toast.error("Use imagens JPG/PNG/WEBP de até 3MB.");
        return;
      }
      const urls = await Promise.all(valid.map(readFile));
      const res = await addPhotos(eventId, urls);
      if (res.ok) {
        toast.success(`${valid.length} foto(s) adicionada(s).`);
        router.refresh();
      } else {
        toast.error(res.error ?? "Erro ao enviar.");
      }
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function remove(id: string) {
    startTransition(async () => {
      const res = await removePhoto(id, eventId);
      if (res.ok) {
        toast.success("Foto removida.");
        router.refresh();
      } else {
        toast.error(res.error ?? "Erro.");
      }
    });
  }

  return (
    <div className="space-y-3">
      <div>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
          onChange={onFiles}
        />
        <Button
          size="sm"
          variant="outline"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <ImagePlus className="size-4" />
          )}
          Adicionar fotos
        </Button>
      </div>

      {photos.length === 0 ? (
        <p className="py-2 text-sm text-muted-foreground">
          Nenhuma foto na galeria.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {photos.map((p) => (
            <div
              key={p.id}
              className="group relative aspect-square overflow-hidden rounded-md border"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.url}
                alt="Foto do evento"
                className="size-full object-cover"
              />
              <button
                type="button"
                onClick={() => remove(p.id)}
                disabled={pending}
                className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
                aria-label="Remover foto"
              >
                <X className="size-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
