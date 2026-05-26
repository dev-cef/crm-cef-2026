"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Info, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { eventSchema, type EventFormValues } from "@/lib/validations/event";
import {
  ATIVIDADE_CATEGORY_CODES,
  EVENT_CATEGORIES,
  EVENT_DIFFICULTY,
  EVENT_STATUS,
  EVENTO_CATEGORY_CODES,
  getEventCategory,
  type SuperCategory,
} from "@/lib/constants";
import { ultimaQuintaDoMes } from "@/lib/events/muro-recorrencia";
import { saveEvent } from "@/app/(app)/eventos/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AttendeeSelector,
  type MemberOption,
} from "@/components/modules/eventos/attendee-selector";
import { GeneralPublicInput } from "@/components/modules/eventos/general-public-input";

const selectCls =
  "h-9 w-full rounded-md border bg-background px-3 text-sm outline-none";

export type GuideOption = { id: string; name: string };

function toDatetimeLocalStr(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function EventForm({
  mode,
  event,
  guides,
  members,
}: {
  mode: "create" | "edit";
  event?: {
    id: string;
    name: string;
    description: string;
    dateTime: string;
    location: string;
    difficulty: string;
    slots: number;
    status: string;
    categoryCode: string | null;
    guideId: string | null;
    speakerName: string | null;
    filmDuration: string | null;
    attendeeIds: string[];
    generalAttendeeNames: string[];
  };
  guides: GuideOption[];
  members: MemberOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // Deriva super-categoria inicial a partir do evento existente (edit) ou padrão
  const initialSuper: SuperCategory =
    event?.categoryCode &&
    (ATIVIDADE_CATEGORY_CODES as readonly string[]).includes(event.categoryCode)
      ? "atividade"
      : "evento";
  const [superCat, setSuperCat] = useState<SuperCategory>(initialSuper);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = useForm<EventFormValues>({
    resolver: zodResolver(eventSchema),
    defaultValues: {
      categoryCode: event?.categoryCode ?? "",
      name: event?.name ?? "",
      description: event?.description ?? "",
      dateTime: event?.dateTime ?? "",
      location: event?.location ?? "",
      difficulty: event?.difficulty ?? "MODERADO",
      slots: event?.slots ?? 0,
      status: event?.status ?? "PLANEJADO",
      guideId: event?.guideId ?? "",
      speakerName: event?.speakerName ?? "",
      filmDuration: event?.filmDuration ?? "",
      attendeeIds: event?.attendeeIds ?? [],
      generalAttendeeNames: event?.generalAttendeeNames ?? [],
    },
  });

  const categoryCode = useWatch({ control, name: "categoryCode" });
  const cat = getEventCategory(categoryCode);
  const isAtividade = (ATIVIDADE_CATEGORY_CODES as readonly string[]).includes(
    categoryCode,
  );

  // Visibilidade dos campos
  const isAutoFilled = ["reuniao_social", "aniversario_cef"].includes(
    categoryCode,
  );
  const showName = !isAutoFilled;
  const showDescription = !isAutoFilled;
  const showSpeaker = categoryCode === "altos_papos";
  const showFilmDuration = categoryCode === "cef_cine_montanha";
  const showLocation = isAtividade || categoryCode === "confraternizacao";
  const showDifficulty = isAtividade;
  const showSlots = categoryCode !== "reuniao_social" && categoryCode !== "aniversario_cef";
  const showGuide = !!cat?.requiresGuide;
  const isArpCounterpart = !!cat?.isArpCounterpart;
  const nameLabel = categoryCode === "cef_cine_montanha" ? "Nome do filme" : "Nome do evento";
  const locationLabel = isAtividade ? "Local / Trilha" : "Local";

  // Auto-preenchimento ao selecionar Aniversário CEF
  useEffect(() => {
    if (categoryCode === "aniversario_cef" && !event) {
      const now = new Date();
      const dt = ultimaQuintaDoMes(now.getFullYear(), now.getMonth() + 1);
      setValue("dateTime", toDatetimeLocalStr(dt));
      setValue("slots", 60);
    }
  }, [categoryCode, event, setValue]);

  // Categorias disponíveis por super-categoria
  const categoriesForSuperCat = EVENT_CATEGORIES.filter((c) =>
    superCat === "evento"
      ? (EVENTO_CATEGORY_CODES as readonly string[]).includes(c.value)
      : (ATIVIDADE_CATEGORY_CODES as readonly string[]).includes(c.value),
  );

  function handleSuperCatChange(sc: SuperCategory) {
    setSuperCat(sc);
    setValue("categoryCode", "");
    setValue("name", "");
    setValue("description", "");
    setValue("location", "");
    setValue("speakerName", "");
    setValue("filmDuration", "");
  }

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
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* ── Seleção da super-categoria ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Tipo</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {/* Super-categoria */}
          <div className="sm:col-span-2">
            <Label>Categoria</Label>
            <div className="mt-1.5 flex gap-3">
              {(["evento", "atividade"] as const).map((sc) => (
                <button
                  key={sc}
                  type="button"
                  onClick={() => handleSuperCatChange(sc)}
                  className={`flex-1 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                    superCat === sc
                      ? "border-primary bg-primary text-primary-foreground"
                      : "bg-background hover:bg-accent"
                  }`}
                >
                  {sc === "evento" ? "Evento" : "Atividade"}
                </button>
              ))}
            </div>
          </div>

          {/* Tipo específico */}
          <div className="sm:col-span-2">
            <Label htmlFor="categoryCode">Tipo de {superCat === "evento" ? "evento" : "atividade"} *</Label>
            <select
              id="categoryCode"
              className={selectCls}
              {...register("categoryCode")}
            >
              <option value="">— selecione —</option>
              {categoriesForSuperCat.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                  {c.isArpCounterpart ? " · contrapartida ARP" : ""}
                </option>
              ))}
            </select>
            {isArpCounterpart && (
              <p className="mt-1 text-xs text-primary">
                Este evento conta para a meta de 6 contrapartidas ARP do ano.
              </p>
            )}
            {errors.categoryCode && (
              <p className="mt-1 text-xs text-destructive">
                {errors.categoryCode.message}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Campos dinâmicos ── */}
      {categoryCode && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Detalhes</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            {/* Aniversário CEF: nota informativa */}
            {categoryCode === "aniversario_cef" && (
              <div className="sm:col-span-2 flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
                <Info className="mt-0.5 size-4 shrink-0 text-primary" />
                <span>
                  A data foi preenchida com a <strong>última quinta-feira do mês corrente</strong> às 19h. As vagas foram definidas em <strong>60</strong>. Os aniversariantes do mês aparecem na página do evento.
                </span>
              </div>
            )}

            {/* Reunião Social: nota informativa */}
            {categoryCode === "reuniao_social" && (
              <div className="sm:col-span-2 flex items-start gap-2 rounded-lg border border-muted bg-muted/30 px-3 py-2 text-sm">
                <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <span>
                  Formulário simplificado. Informe apenas a data e o status da reunião.
                </span>
              </div>
            )}

            {/* Nome */}
            {showName && (
              <div className="sm:col-span-2">
                <Label htmlFor="name">{nameLabel} *</Label>
                <Input id="name" {...register("name")} />
                {errors.name && (
                  <p className="mt-1 text-xs text-destructive">
                    {errors.name.message}
                  </p>
                )}
              </div>
            )}

            {/* Palestrante (Altos Papos) */}
            {showSpeaker && (
              <div className="sm:col-span-2">
                <Label htmlFor="speakerName">Palestrante *</Label>
                <Input id="speakerName" {...register("speakerName")} />
                {errors.speakerName && (
                  <p className="mt-1 text-xs text-destructive">
                    {errors.speakerName.message}
                  </p>
                )}
              </div>
            )}

            {/* Duração do filme (CEF Cine Montanha) */}
            {showFilmDuration && (
              <div>
                <Label htmlFor="filmDuration">Duração do filme *</Label>
                <Input
                  id="filmDuration"
                  placeholder="ex: 1h 45min"
                  {...register("filmDuration")}
                />
                {errors.filmDuration && (
                  <p className="mt-1 text-xs text-destructive">
                    {errors.filmDuration.message}
                  </p>
                )}
              </div>
            )}

            {/* Descrição */}
            {showDescription && (
              <div className="sm:col-span-2">
                <Label htmlFor="description">Descrição *</Label>
                <Textarea
                  id="description"
                  rows={3}
                  {...register("description")}
                />
                {errors.description && (
                  <p className="mt-1 text-xs text-destructive">
                    {errors.description.message}
                  </p>
                )}
              </div>
            )}

            {/* Data e Hora */}
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

            {/* Local */}
            {showLocation && (
              <div>
                <Label htmlFor="location">{locationLabel} *</Label>
                <Input id="location" {...register("location")} />
                {errors.location && (
                  <p className="mt-1 text-xs text-destructive">
                    {errors.location.message}
                  </p>
                )}
              </div>
            )}

            {/* Dificuldade (atividades) */}
            {showDifficulty && (
              <div>
                <Label htmlFor="difficulty">Dificuldade *</Label>
                <select
                  id="difficulty"
                  className={selectCls}
                  {...register("difficulty")}
                >
                  <option value="">— selecione —</option>
                  {EVENT_DIFFICULTY.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                {errors.difficulty && (
                  <p className="mt-1 text-xs text-destructive">
                    {errors.difficulty.message}
                  </p>
                )}
              </div>
            )}

            {/* Guia da atividade */}
            {showGuide && (
              <div className="sm:col-span-2">
                <Label htmlFor="guideId">
                  Guia da atividade *{" "}
                  <span className="text-xs font-normal text-muted-foreground">
                    (associado responsável)
                  </span>
                </Label>
                <select
                  id="guideId"
                  className={selectCls}
                  {...register("guideId")}
                >
                  <option value="">— selecione um guia —</option>
                  {guides.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
                {guides.length === 0 && (
                  <p className="mt-1 text-xs text-destructive">
                    Nenhum associado cadastrado como guia. Marque a flag em
                    Associados.
                  </p>
                )}
                {errors.guideId && (
                  <p className="mt-1 text-xs text-destructive">
                    {errors.guideId.message}
                  </p>
                )}
              </div>
            )}

            {/* Vagas */}
            {showSlots && (
              <div>
                <Label htmlFor="slots">Vagas disponíveis</Label>
                <Input
                  id="slots"
                  type="number"
                  min="0"
                  {...register("slots")}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  0 = sem limite
                </p>
                {errors.slots && (
                  <p className="mt-1 text-xs text-destructive">
                    {errors.slots.message}
                  </p>
                )}
              </div>
            )}

            {/* Status */}
            <div>
              <Label htmlFor="status">Status *</Label>
              <select id="status" className={selectCls} {...register("status")}>
                {EVENT_STATUS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Público que foi ── */}
      {categoryCode && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Público que foi</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Associados cadastrados */}
            <div>
              <p className="mb-2 text-sm font-medium">Associados</p>
              <Controller
                control={control}
                name="attendeeIds"
                render={({ field }) => (
                  <AttendeeSelector
                    members={members}
                    value={field.value ?? []}
                    onChange={field.onChange}
                  />
                )}
              />
            </div>

            {/* Público em geral (não associados) */}
            <div className="border-t pt-4">
              <p className="mb-2 text-sm font-medium">Público em geral</p>
              <p className="mb-3 text-xs text-muted-foreground">
                Visitantes e convidados que não são associados do CEF.
              </p>
              <Controller
                control={control}
                name="generalAttendeeNames"
                render={({ field }) => (
                  <GeneralPublicInput
                    value={field.value ?? []}
                    onChange={field.onChange}
                  />
                )}
              />
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end">
        <Button type="submit" disabled={pending || !categoryCode}>
          {pending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Save className="size-4" />
          )}
          {mode === "create" ? "Criar" : "Salvar alterações"}
        </Button>
      </div>
    </form>
  );
}
