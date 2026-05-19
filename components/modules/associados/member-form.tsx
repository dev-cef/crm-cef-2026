"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  Save,
  Upload,
  X,
} from "lucide-react";
import {
  memberSchema,
  STEP_FIELDS,
  type MemberFormValues,
} from "@/lib/validations/member";
import {
  BLOOD_TYPES,
  BLOOD_TYPE_LABELS,
  HEALTH_CONDITIONS,
  INTEREST_FIELDS,
  MOUNTAIN_EXPERIENCE,
  SEX_OPTIONS,
  UF_OPTIONS,
} from "@/lib/constants";
import {
  formatPersonName,
  maskCepInput,
  maskCpfInput,
  maskDateInput,
  maskPhoneInput,
  parseBrDate,
} from "@/lib/format";
import { calculateAge } from "@/lib/format";
import { createMember, updateMember } from "@/app/(app)/associados/actions";
import { registrarAssociado } from "@/app/criar-conta/actions";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { RatingInput } from "@/components/modules/associados/rating-input";

const STEPS = [
  "Informações Pessoais",
  "Endereço",
  "Saúde e Emergência",
  "Experiência",
  "Interesses",
];

const selectCls =
  "h-9 w-full rounded-md border bg-background px-3 text-sm focus-visible:ring-3 focus-visible:ring-ring/50 outline-none";

function Err({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="mt-1 text-xs text-destructive">{msg}</p>;
}

export type MemberFormProps = {
  mode: "create" | "edit" | "signup";
  plans: { id: string; name: string }[];
  member?: {
    id: string;
    fullName: string;
    sex: string;
    email: string;
    phone: string;
    instagram: string | null;
    birthDate: string; // DD/MM/AAAA
    cpf: string; // formatado
    photoUrl: string | null;
    cep: string;
    street: string;
    number: string;
    complement: string | null;
    neighborhood: string;
    city: string;
    state: string;
    bloodType: string;
    emergencyName: string;
    emergencyPhone: string;
    healthConditions: string[];
    healthDetails: string | null;
    mountainExperience: string;
    otherGroup: boolean;
    otherGroupName: string | null;
    interestHiking: number;
    interestClimbing: number;
    interestCourse: number;
    interestBike: number;
    interestEcological: number;
    suggestions: string | null;
    planId: string | null;
    status: string;
    createdAt?: string;
  };
};

export function MemberForm({ mode, plans, member }: MemberFormProps) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [pending, startTransition] = useTransition();
  const [signupPw, setSignupPw] = useState("");
  const [signupPw2, setSignupPw2] = useState("");

  const form = useForm<MemberFormValues>({
    resolver: zodResolver(memberSchema),
    mode: "onTouched",
    defaultValues: {
      fullName: member?.fullName ?? "",
      sex: (member?.sex as "M" | "F") ?? "M",
      email: member?.email ?? "",
      phone: member?.phone ?? "",
      instagram: member?.instagram ?? "",
      birthDate: member?.birthDate ?? "",
      cpf: member?.cpf ?? "",
      photoUrl: member?.photoUrl ?? "",
      cep: member?.cep ?? "",
      street: member?.street ?? "",
      number: member?.number ?? "",
      complement: member?.complement ?? "",
      neighborhood: member?.neighborhood ?? "",
      city: member?.city ?? "Nova Friburgo",
      state: (member?.state as (typeof UF_OPTIONS)[number]) ?? "RJ",
      bloodType:
        (member?.bloodType as (typeof BLOOD_TYPES)[number]) ?? "NAO_SEI",
      emergencyName: member?.emergencyName ?? "",
      emergencyPhone: member?.emergencyPhone ?? "",
      healthConditions:
        (member?.healthConditions as (typeof HEALTH_CONDITIONS)[number][]) ??
        [],
      healthDetails: member?.healthDetails ?? "",
      mountainExperience: member?.mountainExperience ?? "NUNCA",
      otherGroup: member?.otherGroup ?? false,
      otherGroupName: member?.otherGroupName ?? "",
      interestHiking: member?.interestHiking ?? 3,
      interestClimbing: member?.interestClimbing ?? 3,
      interestCourse: member?.interestCourse ?? 3,
      interestBike: member?.interestBike ?? 3,
      interestEcological: member?.interestEcological ?? 3,
      suggestions: member?.suggestions ?? "",
      planId: member?.planId ?? "",
      status: (member?.status as "ACTIVE" | "INACTIVE") ?? "ACTIVE",
      createdAt: member?.createdAt ?? "",
    },
  });

  const { register, setValue, watch, control, formState } = form;
  const errors = formState.errors;

  const birth = watch("birthDate");
  const parsedBirth = birth ? parseBrDate(birth) : null;
  const age = parsedBirth ? calculateAge(parsedBirth) : null;
  const healthConditions = watch("healthConditions") ?? [];
  const otherGroup = watch("otherGroup");
  const photoUrl = watch("photoUrl");

  async function next() {
    const valid = await form.trigger(
      STEP_FIELDS[step] as (keyof MemberFormValues)[],
    );
    if (valid) setStep((s) => Math.min(STEPS.length - 1, s + 1));
  }

  function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png"].includes(file.type)) {
      toast.error("Use uma imagem JPG ou PNG.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("A foto deve ter no máximo 2MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () =>
      setValue("photoUrl", String(reader.result), { shouldValidate: true });
    reader.readAsDataURL(file);
  }

  async function lookupCep(raw: string) {
    const digits = raw.replace(/\D/g, "");
    if (digits.length !== 8) return;
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = await res.json();
      if (data.erro) {
        toast.error("CEP não encontrado.");
        return;
      }
      if (data.logradouro) setValue("street", data.logradouro);
      if (data.bairro) setValue("neighborhood", data.bairro);
      if (data.localidade) setValue("city", data.localidade);
      if (data.uf) setValue("state", data.uf);
      toast.success("Endereço preenchido pelo CEP.");
    } catch {
      toast.error("Falha ao consultar o CEP.");
    }
  }

  function onSubmit(values: MemberFormValues) {
    // Só salva na última etapa, via clique explícito no botão.
    if (step !== STEPS.length - 1) return;
    if (mode === "signup") {
      if (signupPw.length < 12) {
        toast.error("A senha deve ter ao menos 12 caracteres.");
        setStep(0);
        return;
      }
      if (signupPw !== signupPw2) {
        toast.error("As senhas não conferem.");
        setStep(0);
        return;
      }
      startTransition(async () => {
        const res = await registrarAssociado(values, signupPw);
        if (res.ok) {
          toast.success("Cadastro enviado! Aguarde a aprovação.");
          router.push("/login?cadastro=ok");
        } else {
          toast.error(res.error);
        }
      });
      return;
    }
    startTransition(async () => {
      const res =
        mode === "create"
          ? await createMember(values)
          : await updateMember(member!.id, values);
      if (res.ok) {
        toast.success(
          mode === "create" ? "Associado cadastrado!" : "Alterações salvas!",
        );
        router.push(`/associados/${res.id}`);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  function toggleCondition(c: (typeof HEALTH_CONDITIONS)[number]) {
    const set = new Set(healthConditions);
    if (set.has(c)) set.delete(c);
    else set.add(c);
    setValue(
      "healthConditions",
      Array.from(set) as (typeof HEALTH_CONDITIONS)[number][],
      { shouldValidate: true },
    );
  }

  return (
    <form
      onSubmit={(e) => e.preventDefault()}
      onKeyDown={(e) => {
        if (e.key === "Enter" && (e.target as HTMLElement).tagName !== "TEXTAREA") {
          e.preventDefault();
        }
      }}
    >
      <div className="mb-6">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-medium">
            Etapa {step + 1} de {STEPS.length} — {STEPS[step]}
          </span>
          <span className="text-muted-foreground">
            {Math.round(((step + 1) / STEPS.length) * 100)}%
          </span>
        </div>
        <Progress value={((step + 1) / STEPS.length) * 100} />
        <div className="mt-3 hidden gap-1 sm:flex">
          {STEPS.map((s, i) => (
            <div
              key={s}
              className={cn(
                "flex flex-1 items-center gap-1 text-xs",
                i === step
                  ? "text-foreground"
                  : i < step
                    ? "text-primary"
                    : "text-muted-foreground",
              )}
            >
              <span
                className={cn(
                  "flex size-5 items-center justify-center rounded-full border text-[10px]",
                  i < step && "border-primary bg-primary text-primary-foreground",
                  i === step && "border-foreground",
                )}
              >
                {i < step ? <Check className="size-3" /> : i + 1}
              </span>
              <span className="truncate">{s}</span>
            </div>
          ))}
        </div>
      </div>

      <Card>
        <CardContent className="space-y-4 pt-6">
          {/* ETAPA 1 — Pessoais */}
          {step === 0 && (
            <>
              <div className="flex items-center gap-4">
                <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-full border bg-muted">
                  {photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={photoUrl}
                      alt="Prévia"
                      className="size-full object-cover"
                    />
                  ) : (
                    <Upload className="size-6 text-muted-foreground" />
                  )}
                </div>
                <div className="space-y-1">
                  <Label htmlFor="photo">Foto (JPG/PNG, máx 2MB)</Label>
                  <div className="flex gap-2">
                    <Input
                      id="photo"
                      type="file"
                      accept="image/jpeg,image/png"
                      onChange={onPhoto}
                      className="max-w-xs"
                    />
                    {photoUrl && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setValue("photoUrl", "")}
                      >
                        <X className="size-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Label htmlFor="fullName">Nome completo *</Label>
                  <Input
                    id="fullName"
                    {...register("fullName")}
                    onBlur={(e) => {
                      register("fullName").onBlur(e);
                      const f = formatPersonName(e.target.value);
                      if (f && f !== e.target.value) {
                        setValue("fullName", f, { shouldValidate: true });
                      }
                    }}
                  />
                  <Err msg={errors.fullName?.message} />
                </div>

                <div>
                  <Label htmlFor="sex">Sexo *</Label>
                  <select id="sex" className={selectCls} {...register("sex")}>
                    {SEX_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <Err msg={errors.sex?.message} />
                </div>

                <div>
                  <Label htmlFor="email">E-mail *</Label>
                  <Input id="email" type="email" {...register("email")} />
                  <Err msg={errors.email?.message} />
                </div>

                <div>
                  <Label htmlFor="phone">Telefone *</Label>
                  <Input
                    id="phone"
                    {...register("phone")}
                    onChange={(e) =>
                      setValue("phone", maskPhoneInput(e.target.value))
                    }
                    placeholder="(99) 99999-9999"
                  />
                  <Err msg={errors.phone?.message} />
                </div>

                <div>
                  <Label htmlFor="instagram">Instagram</Label>
                  <Input
                    id="instagram"
                    {...register("instagram")}
                    placeholder="@usuario"
                  />
                  <Err msg={errors.instagram?.message} />
                </div>

                <div>
                  <Label htmlFor="cpf">CPF *</Label>
                  <Input
                    id="cpf"
                    {...register("cpf")}
                    onChange={(e) =>
                      setValue("cpf", maskCpfInput(e.target.value), {
                        shouldValidate: formState.isSubmitted,
                      })
                    }
                    placeholder="999.999.999-99"
                  />
                  <Err msg={errors.cpf?.message} />
                </div>

                <div>
                  <Label htmlFor="birthDate">
                    Data de nascimento *{" "}
                    {age !== null && (
                      <span className="text-muted-foreground">
                        ({age} anos)
                      </span>
                    )}
                  </Label>
                  <Input
                    id="birthDate"
                    {...register("birthDate")}
                    onChange={(e) =>
                      setValue("birthDate", maskDateInput(e.target.value))
                    }
                    placeholder="DD/MM/AAAA"
                  />
                  <Err msg={errors.birthDate?.message} />
                </div>
              </div>

              {mode === "signup" && (
                <div className="mt-4 rounded-lg border border-primary/30 bg-primary/5 p-4">
                  <p className="mb-3 text-sm font-medium">
                    Dados de acesso
                  </p>
                  <p className="mb-3 text-xs text-muted-foreground">
                    Seu login será o e-mail informado acima. A conta passa por
                    aprovação do clube antes de liberar o acesso.
                  </p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="signupPw">Senha *</Label>
                      <Input
                        id="signupPw"
                        type="password"
                        value={signupPw}
                        onChange={(e) => setSignupPw(e.target.value)}
                        autoComplete="new-password"
                        placeholder="Mín. 12 caracteres"
                      />
                    </div>
                    <div>
                      <Label htmlFor="signupPw2">Confirmar senha *</Label>
                      <Input
                        id="signupPw2"
                        type="password"
                        value={signupPw2}
                        onChange={(e) => setSignupPw2(e.target.value)}
                        autoComplete="new-password"
                        placeholder="Repita a senha"
                      />
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Use 12+ caracteres com maiúscula, minúscula, número e
                    símbolo.
                  </p>
                </div>
              )}
            </>
          )}

          {/* ETAPA 2 — Endereço */}
          {step === 1 && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="cep">CEP *</Label>
                <Input
                  id="cep"
                  {...register("cep")}
                  onChange={(e) => {
                    const v = maskCepInput(e.target.value);
                    setValue("cep", v);
                    if (v.replace(/\D/g, "").length === 8) lookupCep(v);
                  }}
                  placeholder="99999-999"
                />
                <Err msg={errors.cep?.message} />
              </div>
              <div className="hidden sm:block" />
              <div className="sm:col-span-2">
                <Label htmlFor="street">Logradouro *</Label>
                <Input id="street" {...register("street")} />
                <Err msg={errors.street?.message} />
              </div>
              <div>
                <Label htmlFor="number">Número *</Label>
                <Input id="number" {...register("number")} />
                <Err msg={errors.number?.message} />
              </div>
              <div>
                <Label htmlFor="complement">Complemento</Label>
                <Input id="complement" {...register("complement")} />
              </div>
              <div>
                <Label htmlFor="neighborhood">Bairro *</Label>
                <Input id="neighborhood" {...register("neighborhood")} />
                <Err msg={errors.neighborhood?.message} />
              </div>
              <div>
                <Label htmlFor="city">Cidade *</Label>
                <Input id="city" {...register("city")} />
                <Err msg={errors.city?.message} />
              </div>
              <div>
                <Label htmlFor="state">Estado (UF) *</Label>
                <select id="state" className={selectCls} {...register("state")}>
                  {UF_OPTIONS.map((uf) => (
                    <option key={uf} value={uf}>
                      {uf}
                    </option>
                  ))}
                </select>
                <Err msg={errors.state?.message} />
              </div>
            </div>
          )}

          {/* ETAPA 3 — Saúde */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="bloodType">Tipo sanguíneo *</Label>
                  <select
                    id="bloodType"
                    className={selectCls}
                    {...register("bloodType")}
                  >
                    {BLOOD_TYPES.map((b) => (
                      <option key={b} value={b}>
                        {BLOOD_TYPE_LABELS[b]}
                      </option>
                    ))}
                  </select>
                  <Err msg={errors.bloodType?.message} />
                </div>
                <div />
                <div>
                  <Label htmlFor="emergencyName">
                    Contato de emergência *
                  </Label>
                  <Input
                    id="emergencyName"
                    {...register("emergencyName")}
                  />
                  <Err msg={errors.emergencyName?.message} />
                </div>
                <div>
                  <Label htmlFor="emergencyPhone">
                    Telefone de emergência *
                  </Label>
                  <Input
                    id="emergencyPhone"
                    {...register("emergencyPhone")}
                    onChange={(e) =>
                      setValue(
                        "emergencyPhone",
                        maskPhoneInput(e.target.value),
                      )
                    }
                    placeholder="(99) 99999-9999"
                  />
                  <Err msg={errors.emergencyPhone?.message} />
                </div>
              </div>

              <div>
                <Label>Condições de saúde</Label>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {HEALTH_CONDITIONS.map((c) => (
                    <label
                      key={c}
                      className="flex cursor-pointer items-center gap-2 text-sm"
                    >
                      <Checkbox
                        checked={healthConditions.includes(c)}
                        onCheckedChange={() => toggleCondition(c)}
                      />
                      {c}
                    </label>
                  ))}
                </div>
              </div>

              {healthConditions.length > 0 && (
                <div>
                  <Label htmlFor="healthDetails">
                    Qual doença/alergia? *
                  </Label>
                  <Textarea
                    id="healthDetails"
                    {...register("healthDetails")}
                  />
                  <Err msg={errors.healthDetails?.message} />
                </div>
              )}
            </div>
          )}

          {/* ETAPA 4 — Experiência */}
          {step === 3 && (
            <div className="space-y-5">
              <div>
                <Label>Tempo de experiência em montanha *</Label>
                <Controller
                  control={control}
                  name="mountainExperience"
                  render={({ field }) => (
                    <RadioGroup
                      value={field.value}
                      onValueChange={(v) => field.onChange(v)}
                      className="mt-2 space-y-2"
                    >
                      {MOUNTAIN_EXPERIENCE.map((o) => (
                        <label
                          key={o.value}
                          className="flex cursor-pointer items-center gap-2 text-sm"
                        >
                          <RadioGroupItem value={o.value} />
                          {o.label}
                        </label>
                      ))}
                    </RadioGroup>
                  )}
                />
                <Err msg={errors.mountainExperience?.message} />
              </div>

              <div>
                <Label>
                  Participa ou participou de outro grupo/clube excursionista?
                </Label>
                <Controller
                  control={control}
                  name="otherGroup"
                  render={({ field }) => (
                    <RadioGroup
                      value={field.value ? "sim" : "nao"}
                      onValueChange={(v) => field.onChange(v === "sim")}
                      className="mt-2 flex gap-6"
                    >
                      <label className="flex cursor-pointer items-center gap-2 text-sm">
                        <RadioGroupItem value="sim" /> Sim
                      </label>
                      <label className="flex cursor-pointer items-center gap-2 text-sm">
                        <RadioGroupItem value="nao" /> Não
                      </label>
                    </RadioGroup>
                  )}
                />
              </div>

              {otherGroup && (
                <div>
                  <Label htmlFor="otherGroupName">Qual o nome do grupo? *</Label>
                  <Input
                    id="otherGroupName"
                    {...register("otherGroupName")}
                  />
                  <Err msg={errors.otherGroupName?.message} />
                </div>
              )}
            </div>
          )}

          {/* ETAPA 5 — Interesses */}
          {step === 4 && (
            <div className="space-y-5">
              <div>
                <Label>Escala de interesse (1 a 5)</Label>
                <div className="mt-3 space-y-3">
                  {INTEREST_FIELDS.map((f) => (
                    <Controller
                      key={f.key}
                      control={control}
                      name={f.key as keyof MemberFormValues}
                      render={({ field }) => (
                        <RatingInput
                          label={f.label}
                          value={Number(field.value) || 0}
                          onChange={(v) => field.onChange(v)}
                        />
                      )}
                    />
                  ))}
                </div>
              </div>

              <div>
                <Label htmlFor="suggestions">Sugestões</Label>
                <Textarea id="suggestions" {...register("suggestions")} />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="planId">Plano</Label>
                  <select
                    id="planId"
                    className={selectCls}
                    {...register("planId")}
                  >
                    <option value="">Sem plano</option>
                    {plans.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label htmlFor="status">Status</Label>
                  <select
                    id="status"
                    className={selectCls}
                    {...register("status")}
                  >
                    <option value="ACTIVE">Ativo</option>
                    <option value="INACTIVE">Inativo</option>
                  </select>
                </div>
              </div>

              {mode === "edit" && (
                <div className="rounded-lg border border-dashed border-amber-400/50 bg-amber-500/5 p-4">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                    Administração
                  </p>
                  <div>
                    <Label htmlFor="createdAt">Data de cadastro</Label>
                    <Input
                      id="createdAt"
                      placeholder="DD/MM/AAAA"
                      maxLength={10}
                      {...register("createdAt")}
                      onChange={(e) =>
                        setValue("createdAt", maskDateInput(e.target.value), {
                          shouldValidate: true,
                        })
                      }
                    />
                    <Err msg={errors.createdAt?.message as string | undefined} />
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="mt-6 flex items-center justify-between">
        <Button
          type="button"
          variant="outline"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0 || pending}
        >
          <ArrowLeft className="size-4" /> Voltar
        </Button>

        {step < STEPS.length - 1 ? (
          <Button type="button" onClick={next}>
            Próximo <ArrowRight className="size-4" />
          </Button>
        ) : (
          <Button type="button" onClick={form.handleSubmit(onSubmit)} disabled={pending}>
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            {mode === "signup"
              ? "Enviar cadastro"
              : mode === "create"
                ? "Cadastrar associado"
                : "Salvar alterações"}
          </Button>
        )}
      </div>
    </form>
  );
}
