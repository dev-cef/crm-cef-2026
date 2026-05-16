"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { eventSchema, type EventFormValues } from "@/lib/validations/event";
import { EVENT_DIFFICULTY, EVENT_STATUS } from "@/lib/constants";
import { saveEvent } from "@/app/(app)/eventos/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";

const selectCls =
  "h-9 w-full rounded-md border bg-background px-3 text-sm outline-none";

export function EventForm({
  mode,
  event,
}: {
  mode: "create" | "edit";
  event?: {
    id: string;
    name: string;
    description: string;
    dateTime: string; // datetime-local
    location: string;
    difficulty: string;
    slots: number;
    status: string;
  };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<EventFormValues>({
    resolver: zodResolver(eventSchema),
    defaultValues: {
      name: event?.name ?? "",
      description: event?.description ?? "",
      dateTime: event?.dateTime ?? "",
      location: event?.location ?? "",
      difficulty: event?.difficulty ?? "MODERADO",
      slots: event?.slots ?? 20,
      status: event?.status ?? "PLANEJADO",
    },
  });

  function onSubmit(values: EventFormValues) {
    startTransition(async () => {
      const res = await saveEvent(values, event?.id);
      if (res.ok) {
        toast.success(mode === "create" ? "Evento criado!" : "Evento salvo!");
        router.push(`/eventos/${res.id}`);
        router.refresh();
      } else {
        toast.error(res.error ?? "Erro ao salvar.");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Card>
        <CardContent className="grid gap-4 pt-6 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="name">Nome do evento *</Label>
            <Input id="name" {...register("name")} />
            {errors.name && (
              <p className="mt-1 text-xs text-destructive">
                {errors.name.message}
              </p>
            )}
          </div>

          <div className="sm:col-span-2">
            <Label htmlFor="description">Descrição *</Label>
            <Textarea id="description" rows={3} {...register("description")} />
            {errors.description && (
              <p className="mt-1 text-xs text-destructive">
                {errors.description.message}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="dateTime">Data e hora *</Label>
            <Input
              id="dateTime"
              type="datetime-local"
              {...register("dateTime")}
            />
            {errors.dateTime && (
              <p className="mt-1 text-xs text-destructive">
                {errors.dateTime.message}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="location">Local / Trilha *</Label>
            <Input id="location" {...register("location")} />
            {errors.location && (
              <p className="mt-1 text-xs text-destructive">
                {errors.location.message}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="difficulty">Dificuldade *</Label>
            <select
              id="difficulty"
              className={selectCls}
              {...register("difficulty")}
            >
              {EVENT_DIFFICULTY.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label htmlFor="slots">Vagas disponíveis *</Label>
            <Input
              id="slots"
              type="number"
              min="0"
              {...register("slots")}
            />
            {errors.slots && (
              <p className="mt-1 text-xs text-destructive">
                {errors.slots.message}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="status">Status *</Label>
            <select
              id="status"
              className={selectCls}
              {...register("status")}
            >
              {EVENT_STATUS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      <div className="mt-4 flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Save className="size-4" />
          )}
          {mode === "create" ? "Criar evento" : "Salvar alterações"}
        </Button>
      </div>
    </form>
  );
}
