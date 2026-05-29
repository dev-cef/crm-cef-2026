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
  EVENT_STATUS,
  EVENTO_CATEGORY_CODES,
  FICHA_ESFORCO,
  FICHA_EXPOSICAO,
  FICHA_INSOLACAO,
  FICHA_O_QUE_LEVAR_DEFAULTS,
  FICHA_TECNICA_CATEGORIES,
  getEventCategory,
  type SuperCategory,
} from "@/lib/constants";
import { ultimaQuintaDoMes } from "@/lib/events/muro-recorrencia";
import { saveEvent } from "@/app/(app)/eventos/actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AttendeeSelector,
  type MemberOption,
} from "@/components/modules/eventos/attendee-selector";
import { GeneralPublicInput } from "@/components/modules/eventos/general-public-input";

const selectCls =
  "h-9 w-full rounded-md border bg-background px-3 text-sm outline-none";

function OQueLevarInput({
  value,
  onChange,
}: {
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const [customInput, setCustomInput] = useState("");
  const defaults = FICHA_O_QUE_LEVAR_DEFAULTS as readonly string[];
  const customs = value.filter((i) => !defaults.includes(i));

  function toggle(item: string) {
    if (value.includes(item)) {
      onChange(value.filter((i) => i !== item));
    } else {
      onChange([...value, item]);
    }
  }

  function addCustom() {
    const v = customInput.trim();
    if (v && !value.includes(v)) onChange([...value, v]);
    setCustomInput("");
  }

  return (
    <div className="mt-2 space-y-3">
      <div className="grid gap-2 sm:grid-cols-2">
        {FICHA_O_QUE_LEVAR_DEFAULTS.map((item) => (
          <label key={item} className="flex cursor-pointer items-center gap-2 text-sm">
            <Checkbox
              checked={value.includes(item)}
              onCheckedChange={() => toggle(item)}
            />
            {item}
          </label>
        ))}
      </div>
      {customs.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {customs.map((item) => (
            <span key={item} className="flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs">
              {item}
              <button type="button" onClick={() => toggle(item)} className="text-muted-foreground hover:text-destructive">×</button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <Input
          value={customInput}
          onChange={(e) => setCustomInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } }}
          placeholder="Adicionar item personalizado…"
          className="h-8 text-sm"
        />
        <Button type="button" variant="outline" size="sm" onClick={addCustom}>Adicionar</Button>
      </div>
    </div>
  );
}

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
    slots: number;
    status: string;
    categoryCode: string | null;
    guideId: string | null;
    speakerName: string | null;
    filmDuration: string | null;
    attendeeIds: string[];
    generalAttendeeNames: string[];
    fichaDistanciaKm?: number | null;
    fichaTempo?: string | null;
    fichaEsforco?: string | null;
    fichaInsolacao?: string | null;
    fichaDesnivelPos?: number | null;
    fichaElevacaoMax?: number | null;
    fichaExposicao?: string | null;
    fichaSaidaHorario?: string | null;
    fichaSaidaLocal?: string | null;
    fichaCarona?: boolean;
    fichaOQueLevar?: string[];
    fichaObs?: string | null;
    fichaAtencao?: string | null;
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
      slots: event?.slots ?? 0,
      status: event?.status ?? "PLANEJADO",
      guideId: event?.guideId ?? "",
      speakerName: event?.speakerName ?? "",
      filmDuration: event?.filmDuration ?? "",
      attendeeIds: event?.attendeeIds ?? [],
      generalAttendeeNames: event?.generalAttendeeNames ?? [],
      fichaDistanciaKm:  event?.fichaDistanciaKm  ?? undefined,
      fichaTempo:        event?.fichaTempo        ?? "",
      fichaEsforco:      event?.fichaEsforco      ?? "",
      fichaInsolacao:    event?.fichaInsolacao    ?? "",
      fichaDesnivelPos:  event?.fichaDesnivelPos  ?? undefined,
      fichaElevacaoMax:  event?.fichaElevacaoMax  ?? undefined,
      fichaExposicao:    event?.fichaExposicao    ?? "",
      fichaSaidaHorario: event?.fichaSaidaHorario ?? "",
      fichaSaidaLocal:   event?.fichaSaidaLocal   ?? "",
      fichaCarona:       event?.fichaCarona       ?? false,
      fichaOQueLevar:    event?.fichaOQueLevar    ?? [],
      fichaObs:          event?.fichaObs          ?? "",
      fichaAtencao:      event?.fichaAtencao      ?? "",
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
  const showSlots = categoryCode !== "reuniao_social" && categoryCode !== "aniversario_cef";
  const showGuide = !!cat?.requiresGuide;
  const isArpCounterpart = !!cat?.isArpCounterpart;
  const showFichaTecnica = (FICHA_TECNICA_CATEGORIES as readonly string[]).includes(categoryCode ?? "");
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

      {/* ── Ficha Técnica (Caminhada) ── */}
      {showFichaTecnica && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">👣 Ficha Técnica</CardTitle>
            <p className="text-xs text-muted-foreground">Todos os campos são opcionais</p>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            {/* Distância */}
            <div>
              <Label htmlFor="fichaDistanciaKm">Distância (km)</Label>
              <Input
                id="fichaDistanciaKm"
                type="number"
                step="0.01"
                min="0"
                placeholder="ex: 3.99"
                {...register("fichaDistanciaKm")}
              />
            </div>

            {/* Tempo estimado */}
            <div>
              <Label htmlFor="fichaTempo">Tempo estimado</Label>
              <Input
                id="fichaTempo"
                placeholder="ex: 6h aprox."
                {...register("fichaTempo")}
              />
            </div>

            {/* Nível de Esforço */}
            <div>
              <Label htmlFor="fichaEsforco">Nível de Esforço</Label>
              <select id="fichaEsforco" className={selectCls} {...register("fichaEsforco")}>
                <option value="">— selecione —</option>
                {FICHA_ESFORCO.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            {/* Nível de Insolação */}
            <div>
              <Label htmlFor="fichaInsolacao">Nível de Insolação</Label>
              <select id="fichaInsolacao" className={selectCls} {...register("fichaInsolacao")}>
                <option value="">— selecione —</option>
                {FICHA_INSOLACAO.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            {/* Desnível Positivo */}
            <div>
              <Label htmlFor="fichaDesnivelPos">Desnível Positivo (m)</Label>
              <Input
                id="fichaDesnivelPos"
                type="number"
                min="0"
                placeholder="ex: 582"
                {...register("fichaDesnivelPos")}
              />
            </div>

            {/* Elevação Máxima */}
            <div>
              <Label htmlFor="fichaElevacaoMax">Elevação Máxima (m)</Label>
              <Input
                id="fichaElevacaoMax"
                type="number"
                min="0"
                placeholder="ex: 1713"
                {...register("fichaElevacaoMax")}
              />
            </div>

            {/* Grau de Exposição */}
            <div>
              <Label htmlFor="fichaExposicao">Grau de Exposição</Label>
              <select id="fichaExposicao" className={selectCls} {...register("fichaExposicao")}>
                <option value="">— selecione —</option>
                {FICHA_EXPOSICAO.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            {/* Horário de Saída */}
            <div>
              <Label htmlFor="fichaSaidaHorario">Horário de Saída</Label>
              <Input
                id="fichaSaidaHorario"
                placeholder="ex: 8:00 h"
                {...register("fichaSaidaHorario")}
              />
            </div>

            {/* Local de Saída */}
            <div>
              <Label htmlFor="fichaSaidaLocal">Local de Saída</Label>
              <Input
                id="fichaSaidaLocal"
                placeholder="ex: Super Pão"
                {...register("fichaSaidaLocal")}
              />
            </div>

            {/* Carona Colaborativa */}
            <div className="sm:col-span-2 flex items-center gap-3">
              <Controller
                control={control}
                name="fichaCarona"
                render={({ field }) => (
                  <Switch
                    id="fichaCarona"
                    checked={field.value ?? false}
                    onCheckedChange={field.onChange}
                  />
                )}
              />
              <Label htmlFor="fichaCarona" className="cursor-pointer">🚖 Carona Colaborativa</Label>
            </div>

            {/* O que levar */}
            <div className="sm:col-span-2">
              <Label>✅ O que levar</Label>
              <Controller
                control={control}
                name="fichaOQueLevar"
                render={({ field }) => (
                  <OQueLevarInput value={field.value ?? []} onChange={field.onChange} />
                )}
              />
            </div>

            {/* Observações */}
            <div className="sm:col-span-2">
              <Label htmlFor="fichaObs">Observações (OBS.:)</Label>
              <Textarea
                id="fichaObs"
                rows={2}
                placeholder="ex: caso o associado apresente algum sintoma gripal, o mesmo poderá ser vetado pelo guia."
                {...register("fichaObs")}
              />
            </div>

            {/* Atenção */}
            <div className="sm:col-span-2">
              <Label htmlFor="fichaAtencao">Atenção</Label>
              <Textarea
                id="fichaAtencao"
                rows={2}
                placeholder="ex: Lance de escalada de 1º Grau"
                {...register("fichaAtencao")}
              />
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
