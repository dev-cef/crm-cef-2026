"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, PlusCircle, Pencil } from "lucide-react";
import { toast } from "sonner";
import { saveTransaction } from "@/app/(app)/financeiro/actions";
import {
  TRANSACTION_CATEGORIES,
  TRANSACTION_SUBCATEGORIES,
  PAYMENT_METHODS,
  MONTHS,
  type TransactionFormValues,
  type TransactionFormState,
} from "@/lib/validations/finance";

type FormState = TransactionFormState;
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";

function todayBr() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function currentMonth() { return new Date().getMonth() + 1; }
function currentYear() { return new Date().getFullYear(); }

type Props = {
  defaultType?: "ENTRADA" | "SAIDA";
  editId?: string;
  initial?: Partial<TransactionFormState>;
  trigger?: React.ReactElement;
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
};

const EMPTY: FormState = {
  type: "ENTRADA",
  category: "",
  subcategory: "",
  description: "",
  amount: 0,
  date: todayBr(),
  competenceMonth: null,
  competenceYear: null,
  clubAccount: "",
  payerName: "",
  linkedActivity: "",
  paymentMethod: "",
  notes: "",
};

const YEARS = Array.from({ length: 6 }, (_, i) => currentYear() - 2 + i);

export function TransactionDialog({
  defaultType = "ENTRADA",
  editId,
  initial,
  trigger,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: Props) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = controlledOnOpenChange ?? setInternalOpen;
  const [form, setForm] = useState<FormState>({
    ...EMPTY,
    type: defaultType,
    competenceMonth: currentMonth(),
    competenceYear: currentYear(),
    ...initial,
  });
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    if (open) {
      setForm({
        ...EMPTY,
        type: defaultType,
        competenceMonth: currentMonth(),
        competenceYear: currentYear(),
        ...initial,
      });
    }
  }, [open, defaultType, initial]);

  const categories = TRANSACTION_CATEGORIES[form.type];
  const subcategories = form.category ? (TRANSACTION_SUBCATEGORIES[form.category] ?? []) : [];
  const isEntry = form.type === "ENTRADA";

  // Clear subcategory when category changes
  function setCategory(v: string) {
    setForm((prev) => ({ ...prev, category: v, subcategory: "" }));
  }

  function set<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((prev) => ({ ...prev, [k]: v }));
  }

  function handleSubmit() {
    if (!form.description.trim() || !form.category || !form.date || !form.amount)
      return;
    startTransition(async () => {
      const res = await saveTransaction(form as TransactionFormValues, editId);
      if (res.ok) {
        toast.success(editId ? "Transação atualizada." : "Transação registrada.");
        setOpen(false);
        router.refresh();
      } else {
        toast.error(res.error ?? "Erro ao salvar.");
      }
    });
  }

  const canSubmit =
    form.description.trim() !== "" &&
    form.category !== "" &&
    Number(form.amount) > 0 &&
    /^\d{2}\/\d{2}\/\d{4}$/.test(form.date);

  const isControlled = controlledOnOpenChange !== undefined;

  // Context-specific optional fields
  const showPayerName = isEntry && (form.category === "Mensalidade" || form.category === "Inscrições" || form.category === "Patrocínio");
  const showLinkedActivity = isEntry && form.category === "Inscrições";
  const showCompetence = isEntry && (form.category === "Mensalidade" || form.category === "Inscrições");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!isControlled && (
        <DialogTrigger
          render={
            trigger ?? (
              <Button size="sm" variant={isEntry ? "default" : "destructive"}>
                {editId ? (
                  <Pencil className="size-4" />
                ) : (
                  <PlusCircle className="size-4" />
                )}
                {editId ? "Editar" : isEntry ? "Nova Entrada" : "Nova Saída"}
              </Button>
            )
          }
        />
      )}
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {editId
              ? "Editar transação"
              : isEntry
                ? "Registrar Entrada"
                : "Registrar Saída"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Tipo */}
          {!editId && (
            <div className="flex gap-2">
              {(["ENTRADA", "SAIDA"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, type: t, category: "", subcategory: "" }))}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                    form.type === t
                      ? t === "ENTRADA"
                        ? "border-green-600 bg-green-600/10 text-green-700 dark:text-green-400"
                        : "border-destructive bg-destructive/10 text-destructive"
                      : "border-border text-muted-foreground hover:bg-accent"
                  }`}
                >
                  {t === "ENTRADA" ? "Entrada" : "Saída"}
                </button>
              ))}
            </div>
          )}

          {/* Data */}
          <div className="space-y-1.5">
            <Label htmlFor="tx-date">Data <span className="text-destructive">*</span></Label>
            <Input
              id="tx-date"
              placeholder="DD/MM/AAAA"
              maxLength={10}
              value={form.date}
              onChange={(e) => {
                let v = e.target.value.replace(/\D/g, "");
                if (v.length > 2) v = `${v.slice(0, 2)}/${v.slice(2)}`;
                if (v.length > 5) v = `${v.slice(0, 5)}/${v.slice(5, 9)}`;
                set("date", v);
              }}
            />
          </div>

          {/* Categoria */}
          <div className="space-y-1.5">
            <Label htmlFor="tx-category">Categoria <span className="text-destructive">*</span></Label>
            <Select value={form.category} onValueChange={(v) => v && setCategory(v)}>
              <SelectTrigger id="tx-category">
                <SelectValue placeholder="Selecione…" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Subcategoria — só aparece se houver opções */}
          {subcategories.length > 0 && (
            <div className="space-y-1.5">
              <Label htmlFor="tx-subcategory">Subcategoria</Label>
              <Select
                value={form.subcategory ?? ""}
                onValueChange={(v) => set("subcategory", v ?? undefined)}
              >
                <SelectTrigger id="tx-subcategory">
                  <SelectValue placeholder="Selecione…" />
                </SelectTrigger>
                <SelectContent>
                  {subcategories.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Competência (mês/ano) — para Mensalidade e Inscrições */}
          {showCompetence && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Mês de competência</Label>
                <Select
                  value={form.competenceMonth ? String(form.competenceMonth) : ""}
                  onValueChange={(v) => setForm((prev) => ({ ...prev, competenceMonth: v ? Number(v) : null }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Mês…" />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((m) => (
                      <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Ano de competência</Label>
                <Select
                  value={form.competenceYear ? String(form.competenceYear) : ""}
                  onValueChange={(v) => setForm((prev) => ({ ...prev, competenceYear: v ? Number(v) : null }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Ano…" />
                  </SelectTrigger>
                  <SelectContent>
                    {YEARS.map((y) => (
                      <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Sócio / Pagante */}
          {showPayerName && (
            <div className="space-y-1.5">
              <Label htmlFor="tx-payer">
                {form.category === "Patrocínio" ? "Patrocinador" : "Sócio / Pagante"}
              </Label>
              <Input
                id="tx-payer"
                placeholder="Nome do sócio ou pagante"
                value={form.payerName ?? ""}
                onChange={(e) => set("payerName", e.target.value)}
              />
            </div>
          )}

          {/* Atividade vinculada — para Inscrições */}
          {showLinkedActivity && (
            <div className="space-y-1.5">
              <Label htmlFor="tx-activity">Atividade vinculada</Label>
              <Input
                id="tx-activity"
                placeholder="Ex: Trilha Pico da Caledônia — Mai/2026"
                value={form.linkedActivity ?? ""}
                onChange={(e) => set("linkedActivity", e.target.value)}
              />
            </div>
          )}

          {/* Descrição */}
          <div className="space-y-1.5">
            <Label htmlFor="tx-desc">Descrição <span className="text-destructive">*</span></Label>
            <Input
              id="tx-desc"
              placeholder={isEntry ? "Ex: Mensalidade João Silva — Mai/2026" : "Ex: Compra de equipamentos"}
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
            />
          </div>

          {/* Valor */}
          <div className="space-y-1.5">
            <Label htmlFor="tx-amount">Valor (R$) <span className="text-destructive">*</span></Label>
            <Input
              id="tx-amount"
              type="number"
              min={0}
              step={0.01}
              placeholder="0,00"
              value={form.amount > 0 ? String(form.amount) : ""}
              onChange={(e) => set("amount", parseFloat(e.target.value) || 0)}
            />
          </div>

          {/* Forma de pagamento */}
          <div className="space-y-1.5">
            <Label htmlFor="tx-method">Forma de pagamento</Label>
            <Select
              value={form.paymentMethod ?? ""}
              onValueChange={(v) => set("paymentMethod", v ?? undefined)}
            >
              <SelectTrigger id="tx-method">
                <SelectValue placeholder="Selecione…" />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map((m) => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Conta do clube */}
          <div className="space-y-1.5">
            <Label htmlFor="tx-account">Conta do clube</Label>
            <Input
              id="tx-account"
              placeholder="Ex: Conta corrente Bradesco"
              value={form.clubAccount ?? ""}
              onChange={(e) => set("clubAccount", e.target.value)}
            />
          </div>

          {/* Observações */}
          <div className="space-y-1.5">
            <Label htmlFor="tx-notes">Observações</Label>
            <Textarea
              id="tx-notes"
              rows={2}
              placeholder="Opcional…"
              value={form.notes ?? ""}
              onChange={(e) => set("notes", e.target.value as string)}
            />
          </div>
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" disabled={pending} />}>
            Cancelar
          </DialogClose>
          <Button
            onClick={handleSubmit}
            disabled={pending || !canSubmit}
            variant={isEntry ? "default" : "destructive"}
          >
            {pending && <Loader2 className="size-4 animate-spin" />}
            {editId ? "Salvar alterações" : "Registrar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
