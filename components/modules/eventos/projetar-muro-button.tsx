"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarRange, Loader2, MountainSnow } from "lucide-react";
import { toast } from "sonner";
import { projetarMuroDoMes } from "@/app/(app)/eventos/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export function ProjetarMuroButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const now = new Date();
  const [ano, setAno] = useState(now.getFullYear());
  const [mes, setMes] = useState(now.getMonth() + 1);

  const anosDisponiveis = useMemo(() => {
    const y = now.getFullYear();
    return [y - 1, y, y + 1];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function projetar() {
    startTransition(async () => {
      const res = await projetarMuroDoMes(ano, mes);
      if (!res.ok) {
        toast.error(res.error ?? "Erro ao projetar o muro.");
        return;
      }

      if (res.criados > 0) {
        const ignorMsg =
          res.ignoradosQuinta > 0
            ? ` ${res.ignoradosQuinta} quinta(s) puladas por evento concorrente.`
            : "";
        const dupMsg =
          res.jaExistentes > 0
            ? ` ${res.jaExistentes} já existiam.`
            : "";
        toast.success(
          `${res.criados} ocorrência(s) do Muro criada(s) para ${MESES[mes - 1]}/${ano}.${ignorMsg}${dupMsg}`,
        );
      } else if (res.jaExistentes > 0 && res.ignoradosQuinta === 0) {
        toast.info("Todas as ocorrências do mês já estavam cadastradas.");
      } else {
        toast.info(
          `Nada a criar. ${res.jaExistentes} já existiam, ${res.ignoradosQuinta} quinta(s) bloqueada(s).`,
        );
      }

      setOpen(false);
      router.refresh();
    });
  }

  const selectCls =
    "h-9 w-full rounded-md border bg-background px-3 text-sm outline-none";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm">
            <MountainSnow className="size-4" /> Gerar Muro do mês
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Gerar ocorrências do Muro de Escalada</DialogTitle>
          <DialogDescription>
            Cria eventos de muro em todas as <strong>segundas</strong> e{" "}
            <strong>quartas</strong> do mês escolhido. Nas <strong>quintas</strong>,
            só cria quando não há Altos Papos, CEF Cine Montanha, Aniversário CEF
            ou Confraternização agendado. Não duplica ocorrências já existentes.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="muro-mes">Mês</Label>
            <select
              id="muro-mes"
              className={selectCls}
              value={mes}
              onChange={(e) => setMes(Number(e.target.value))}
            >
              {MESES.map((nome, i) => (
                <option key={i} value={i + 1}>
                  {nome}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="muro-ano">Ano</Label>
            <select
              id="muro-ano"
              className={selectCls}
              value={ano}
              onChange={(e) => setAno(Number(e.target.value))}
            >
              {anosDisponiveis.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            Cancelar
          </DialogClose>
          <Button onClick={projetar} disabled={pending}>
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <CalendarRange className="size-4" />
            )}
            Gerar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
