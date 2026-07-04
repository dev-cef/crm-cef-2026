"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FolderOpen, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { toast } from "sonner";
import { criarDocCategoria, excluirDocCategoria } from "@/app/(app)/documentos/actions";

interface Categoria {
  id: string;
  nome: string;
  descricao: string | null;
  totalDocumentos: number;
}

export default function CategoriasClient({ categorias }: { categorias: Categoria[] }) {
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleCriar() {
    if (!nome.trim()) return;
    setLoading(true);
    const result = await criarDocCategoria(nome, descricao);
    setLoading(false);
    if (result.ok) {
      toast.success("Categoria criada!");
      setNome(""); setDescricao("");
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  async function handleExcluir(id: string) {
    const result = await excluirDocCategoria(id);
    if (result.ok) { toast.success("Categoria excluída!"); router.refresh(); }
    else toast.error(result.error);
  }

  return (
    <div className="space-y-6 p-6 max-w-xl">
      <div className="flex items-center gap-2">
        <FolderOpen className="size-5" />
        <h1 className="text-xl font-semibold">Categorias de Documentos</h1>
      </div>

      <div className="rounded-xl border bg-card p-5 space-y-4">
        <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Nova categoria</h2>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="nome">Nome *</Label>
            <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Pareceres Jurídicos" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="desc">Descrição</Label>
            <Input id="desc" value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Opcional" />
          </div>
          <Button onClick={handleCriar} disabled={loading || !nome.trim()}>
            <Plus className="size-4 mr-1" /> Criar categoria
          </Button>
        </div>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr className="text-xs text-muted-foreground">
              <th className="text-left p-3">Nome</th>
              <th className="text-left p-3">Descrição</th>
              <th className="text-right p-3">Docs</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {categorias.map((c) => (
              <tr key={c.id} className="border-t hover:bg-muted/30">
                <td className="p-3 font-medium">{c.nome}</td>
                <td className="p-3 text-muted-foreground">{c.descricao ?? "—"}</td>
                <td className="p-3 text-right text-muted-foreground">{c.totalDocumentos}</td>
                <td className="p-3">
                  <AlertDialog>
                    <AlertDialogTrigger
                      render={
                        <button
                          aria-label={`Excluir categoria ${c.nome}`}
                          className="text-destructive hover:opacity-70 transition"
                        />
                      }
                    >
                      <Trash2 className="size-4" />
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Excluir categoria?</AlertDialogTitle>
                        <AlertDialogDescription>
                          A categoria <strong>{c.nome}</strong> será removida.
                          {c.totalDocumentos > 0 && (
                            <span className="mt-2 block text-destructive">
                              Atenção: há {c.totalDocumentos} documento(s) nesta categoria — mova-os antes de excluir.
                            </span>
                          )}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleExcluir(c.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Excluir
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {categorias.length === 0 && (
          <p className="text-center py-8 text-sm text-muted-foreground">Nenhuma categoria cadastrada.</p>
        )}
      </div>
    </div>
  );
}
