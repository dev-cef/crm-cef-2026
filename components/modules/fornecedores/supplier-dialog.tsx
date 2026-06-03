"use client";

import { useEffect, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { Loader2, PlusCircle, Pencil } from "lucide-react";
import { toast } from "sonner";
import { saveSupplier } from "@/app/(app)/fornecedores/actions";
import {
  supplierSchema,
  SUPPLIER_TYPES,
  type SupplierFormValues,
} from "@/lib/validations/supplier";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type SupplierRow = {
  id: string;
  name: string;
  type: string;
  phone: string | null;
  email: string | null;
  document: string | null;
  notes: string | null;
  active: boolean;
};

type Props = {
  trigger?: React.ReactElement;
  supplier?: SupplierRow;
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
};

export function SupplierDialog({ trigger, supplier, open: controlledOpen, onOpenChange }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const isControlled = onOpenChange !== undefined;

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } =
    useForm<SupplierFormValues>({
      resolver: zodResolver(supplierSchema),
      defaultValues: {
        name:     supplier?.name ?? "",
        type:     (supplier?.type as SupplierFormValues["type"]) ?? "TRANSPORTE",
        phone:    supplier?.phone ?? "",
        email:    supplier?.email ?? "",
        document: supplier?.document ?? "",
        notes:    supplier?.notes ?? "",
        active:   supplier?.active ?? true,
      },
    });

  useEffect(() => {
    if (controlledOpen) {
      reset({
        name:     supplier?.name ?? "",
        type:     (supplier?.type as SupplierFormValues["type"]) ?? "TRANSPORTE",
        phone:    supplier?.phone ?? "",
        email:    supplier?.email ?? "",
        document: supplier?.document ?? "",
        notes:    supplier?.notes ?? "",
        active:   supplier?.active ?? true,
      });
    }
  }, [controlledOpen, supplier, reset]);

  function onSubmit(values: SupplierFormValues) {
    startTransition(async () => {
      const res = await saveSupplier(values, supplier?.id);
      if (res.ok) {
        toast.success(supplier ? "Fornecedor atualizado." : "Fornecedor criado.");
        if (!supplier) reset();
        onOpenChange?.(false);
        router.refresh();
      } else {
        toast.error(res.error ?? "Erro ao salvar.");
      }
    });
  }

  const form = (
    <form id="supplier-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Nome */}
      <div className="space-y-1.5">
        <Label htmlFor="s-name">Nome / Razão Social <span className="text-destructive">*</span></Label>
        <Input id="s-name" {...register("name")} placeholder="Ex: Transportes Silva Ltda." />
        {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
      </div>

      {/* Tipo */}
      <div className="space-y-1.5">
        <Label>Tipo <span className="text-destructive">*</span></Label>
        <Select
          value={watch("type")}
          onValueChange={(v) => setValue("type", v as SupplierFormValues["type"], { shouldValidate: true })}
        >
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {SUPPLIER_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Telefone + Email */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="s-phone">Telefone</Label>
          <Input id="s-phone" {...register("phone")} placeholder="(21) 99999-9999" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="s-email">E-mail</Label>
          <Input id="s-email" {...register("email")} placeholder="contato@empresa.com" />
          {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
        </div>
      </div>

      {/* CNPJ/CPF */}
      <div className="space-y-1.5">
        <Label htmlFor="s-doc">CNPJ / CPF</Label>
        <Input id="s-doc" {...register("document")} placeholder="00.000.000/0001-00" />
      </div>

      {/* Observações */}
      <div className="space-y-1.5">
        <Label htmlFor="s-notes">Observações</Label>
        <Textarea id="s-notes" rows={2} {...register("notes")} placeholder="Informações adicionais…" />
      </div>

      {/* Ativo */}
      <div className="flex items-center gap-2">
        <input
          id="s-active"
          type="checkbox"
          {...register("active")}
          className="size-4 rounded border-border"
        />
        <Label htmlFor="s-active" className="cursor-pointer font-normal">Fornecedor ativo</Label>
      </div>
    </form>
  );

  if (isControlled) {
    return (
      <Dialog open={controlledOpen} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="size-4" /> Editar fornecedor
            </DialogTitle>
          </DialogHeader>
          {form}
          <DialogFooter>
            <DialogClose render={<Button variant="outline" disabled={pending} />}>Cancelar</DialogClose>
            <Button type="submit" form="supplier-form" disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />} Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog>
      <DialogTrigger render={trigger ?? (
        <Button size="sm">
          <PlusCircle className="size-4" /> Novo fornecedor
        </Button>
      )} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PlusCircle className="size-4" /> Novo fornecedor
          </DialogTitle>
        </DialogHeader>
        {form}
        <DialogFooter>
          <DialogClose render={<Button variant="outline" disabled={pending} />}>Cancelar</DialogClose>
          <Button type="submit" form="supplier-form" disabled={pending}>
            {pending && <Loader2 className="size-4 animate-spin" />} Criar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
