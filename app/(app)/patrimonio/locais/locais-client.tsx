"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Plus, Pencil, Trash2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { criarLocal, editarLocal, excluirLocal } from "@/app/(app)/patrimonio/actions";

interface Local { id: string; nome: string; descricao: string | null; ativo: boolean; }

export default function LocaisClient({ locais }: { locais: Local[] }) {
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNome, setEditNome] = useState("");
  const [editDescricao, setEditDescricao] = useState("");

  async function handleCriar() {
    if (!nome.trim()) return;
    setLoading(true);
    const result = await criarLocal(nome, descricao);
    setLoading(false);
    if (result.ok) {
      toast.success("Local criado!");
      setNome(""); setDescricao("");
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  function startEdit(l: Local) {
    setEditingId(l.id);
    setEditNome(l.nome);
    setEditDescricao(l.descricao ?? "");
  }

  async function handleEditar(id: string) {
    const result = await editarLocal(id, editNome, editDescricao);
    if (result.ok) {
      toast.success("Local atualizado!");
      setEditingId(null);
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  async function handleExcluir(id: string, nomeLocal: string) {
    if (!confirm(`Excluir local "${nomeLocal}"?`)) return;
    const result = await excluirLocal(id);
    if (result.ok) { toast.success("Local excluído!"); router.refresh(); }
    else toast.error(result.error);
  }

  return (
    <div className="space-y-6 p-6 max-w-2xl">
      <div className="flex items-center gap-2">
        <MapPin className="size-5" />
        <h1 className="text-xl font-semibold">Locais de Armazenamento</h1>
      </div>

      <div className="rounded-xl border bg-card p-5 space-y-4">
        <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Novo local</h2>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="nome">Nome *</Label>
            <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Depósito de Equipamentos" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="desc">Descrição</Label>
            <Input id="desc" value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Opcional" />
          </div>
          <Button onClick={handleCriar} disabled={loading || !nome.trim()}>
            <Plus className="size-4 mr-1" /> Criar local
          </Button>
        </div>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr className="text-xs text-muted-foreground">
              <th className="text-left p-3">Nome</th>
              <th className="text-left p-3">Descrição</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {locais.map((l) => (
              <tr key={l.id} className="border-t hover:bg-muted/30">
                <td className="p-3">
                  {editingId === l.id ? (
                    <Input value={editNome} onChange={(e) => setEditNome(e.target.value)} className="h-7 text-sm" />
                  ) : (
                    <span className="font-medium">{l.nome}</span>
                  )}
                </td>
                <td className="p-3 text-muted-foreground">
                  {editingId === l.id ? (
                    <Input value={editDescricao} onChange={(e) => setEditDescricao(e.target.value)} className="h-7 text-sm" placeholder="Descrição" />
                  ) : (
                    l.descricao ?? "—"
                  )}
                </td>
                <td className="p-3">
                  <div className="flex items-center justify-end gap-1">
                    {editingId === l.id ? (
                      <>
                        <button onClick={() => handleEditar(l.id)} className="text-emerald-600 hover:opacity-70 transition p-1">
                          <Check className="size-4" />
                        </button>
                        <button onClick={() => setEditingId(null)} className="text-muted-foreground hover:opacity-70 transition p-1">
                          <X className="size-4" />
                        </button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => startEdit(l)} className="text-muted-foreground hover:text-foreground transition p-1">
                          <Pencil className="size-4" />
                        </button>
                        <button onClick={() => handleExcluir(l.id, l.nome)} className="text-destructive hover:opacity-70 transition p-1">
                          <Trash2 className="size-4" />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {locais.length === 0 && (
          <p className="text-center py-8 text-sm text-muted-foreground">Nenhum local cadastrado.</p>
        )}
      </div>
    </div>
  );
}
