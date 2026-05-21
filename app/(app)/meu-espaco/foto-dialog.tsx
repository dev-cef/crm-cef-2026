"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { updateMemberPhoto } from "./actions";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";

export function FotoDialog({
  trigger,
  currentPhotoUrl,
  initials,
}: {
  trigger: React.ReactElement;
  currentPhotoUrl: string | null;
  initials: string;
}) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const displayedPhoto = preview ?? currentPhotoUrl;

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png"].includes(file.type)) {
      toast.error("Use uma imagem JPG ou PNG.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("A foto deve ter no máximo 2MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setPreview(String(reader.result));
    reader.readAsDataURL(file);
  }

  function handleRemove() {
    setPreview(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  function handleSave() {
    startTransition(async () => {
      const next = preview === null && currentPhotoUrl ? null : preview;
      const res = await updateMemberPhoto(next ?? null);
      if (res.ok) {
        toast.success(next ? "Foto atualizada!" : "Foto removida!");
        setOpen(false);
        setPreview(null);
        router.refresh();
      } else {
        toast.error(res.error ?? "Erro ao salvar.");
      }
    });
  }

  function handleOpenChange(v: boolean) {
    setOpen(v);
    if (!v) {
      setPreview(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const hasChange = preview !== null || (currentPhotoUrl && preview === null);
  const willRemove = currentPhotoUrl && preview === null && !hasChange;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {currentPhotoUrl ? "Trocar foto" : "Adicionar foto"}
          </DialogTitle>
          <DialogDescription>
            JPG ou PNG, máximo 2MB.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-4">
          {/* Preview */}
          <div className="relative">
            <Avatar className="size-28 ring-2 ring-border">
              {displayedPhoto ? (
                <AvatarImage src={displayedPhoto} alt="Pré-visualização" />
              ) : null}
              <AvatarFallback className="text-2xl">{initials}</AvatarFallback>
            </Avatar>
            {displayedPhoto && (
              <button
                type="button"
                onClick={handleRemove}
                className="absolute -right-1 -top-1 flex size-6 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow hover:bg-destructive/90"
                aria-label="Remover foto"
              >
                <Trash2 className="size-3" />
              </button>
            )}
          </div>

          {/* Input oculto */}
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png"
            className="hidden"
            onChange={handleFile}
          />

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => inputRef.current?.click()}
          >
            <Camera className="size-4" />
            {displayedPhoto ? "Escolher outra foto" : "Escolher foto"}
          </Button>
        </div>

        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>
            Cancelar
          </DialogClose>
          <Button
            type="button"
            onClick={handleSave}
            disabled={pending || (!preview && !!currentPhotoUrl === !!displayedPhoto)}
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Upload className="size-4" />
            )}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
