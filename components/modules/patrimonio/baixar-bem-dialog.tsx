"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { baixarBem } from "@/app/(app)/patrimonio/actions";

export function BaixarBemDialog({ id, nome }: { id: string; nome: string }) {
  const [open, setOpen] = useState(false);
  const [obs, setObs] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handle() {
    setLoading(true);
    const res = await baixarBem(id, obs);
    setLoading(false);
    if (!res.ok) { toast.error(res.error); return; }
    toast.success("Bem baixado.");
    setOpen(false);
    router.push("/patrimonio");
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>
        <Button variant="destructive" size="sm">
          <Trash2 className="size-4 mr-1" /> Baixar bem
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Baixar bem patrimonial</DialogTitle>
          <DialogDescription>
            Isso marcará <strong>{nome}</strong> como baixado. A ação não pode ser desfeita.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Textarea
            placeholder="Motivo do descarte / perda (opcional)"
            value={obs}
            onChange={(e) => setObs(e.target.value)}
            rows={3}
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handle} disabled={loading}>
              {loading ? "Baixando..." : "Confirmar baixa"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
