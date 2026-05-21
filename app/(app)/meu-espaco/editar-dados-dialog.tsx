"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { updateMemberProfile } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

const schema = z.object({
  email: z.string().email("E-mail inválido"),
  phone: z.string().min(10, "Telefone inválido"),
  cep: z.string().optional(),
  street: z.string().optional(),
  number: z.string().optional(),
  complement: z.string().optional(),
  neighborhood: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  emergencyName: z.string().optional(),
  emergencyPhone: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

type Member = {
  email: string;
  phone: string;
  cep: string | null;
  street: string | null;
  number: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  emergencyName: string | null;
  emergencyPhone: string | null;
};

export function EditarDadosDialog({
  trigger,
  member,
}: {
  trigger: React.ReactElement;
  member: Member;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: member.email,
      phone: member.phone,
      cep: member.cep ?? "",
      street: member.street ?? "",
      number: member.number ?? "",
      complement: member.complement ?? "",
      neighborhood: member.neighborhood ?? "",
      city: member.city ?? "",
      state: member.state ?? "",
      emergencyName: member.emergencyName ?? "",
      emergencyPhone: member.emergencyPhone ?? "",
    },
  });

  function onSubmit(values: FormValues) {
    startTransition(async () => {
      const res = await updateMemberProfile(values);
      if (res.ok) {
        toast.success("Dados atualizados com sucesso!");
        setOpen(false);
        router.refresh();
      } else {
        toast.error(res.error ?? "Erro ao salvar.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>Editar dados</DialogTitle>
            <DialogDescription>
              Atualize suas informações de contato, endereço e emergência.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Contato */}
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Contato
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="email">E-mail *</Label>
                <Input id="email" type="email" {...register("email")} />
                {errors.email && (
                  <p className="mt-1 text-xs text-destructive">
                    {errors.email.message}
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="phone">Telefone *</Label>
                <Input id="phone" {...register("phone")} placeholder="(99) 99999-9999" />
                {errors.phone && (
                  <p className="mt-1 text-xs text-destructive">
                    {errors.phone.message}
                  </p>
                )}
              </div>
            </div>

            {/* Endereço */}
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Endereço
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <Label htmlFor="cep">CEP</Label>
                <Input id="cep" {...register("cep")} placeholder="00000-000" />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="street">Logradouro</Label>
                <Input id="street" {...register("street")} />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <Label htmlFor="number">Número</Label>
                <Input id="number" {...register("number")} />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="complement">Complemento</Label>
                <Input id="complement" {...register("complement")} />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <Label htmlFor="neighborhood">Bairro</Label>
                <Input id="neighborhood" {...register("neighborhood")} />
              </div>
              <div>
                <Label htmlFor="city">Cidade</Label>
                <Input id="city" {...register("city")} />
              </div>
              <div>
                <Label htmlFor="state">UF</Label>
                <Input id="state" maxLength={2} {...register("state")} placeholder="RJ" />
              </div>
            </div>

            {/* Emergência */}
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Contato de Emergência
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="emergencyName">Nome</Label>
                <Input id="emergencyName" {...register("emergencyName")} />
              </div>
              <div>
                <Label htmlFor="emergencyPhone">Telefone</Label>
                <Input
                  id="emergencyPhone"
                  {...register("emergencyPhone")}
                  placeholder="(99) 99999-9999"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              Cancelar
            </DialogClose>
            <Button type="submit" disabled={pending}>
              {pending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
