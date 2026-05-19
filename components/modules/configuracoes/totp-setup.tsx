"use client";

import { useState, useTransition } from "react";
import { Loader2, ShieldCheck, ShieldOff, KeyRound } from "lucide-react";
import {
  startTotpEnrollment,
  confirmTotpEnrollment,
  disableTotp,
  regenerateRecoveryCodes,
} from "@/app/(app)/configuracoes/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

function RecoveryCodes({ codes }: { codes: string[] }) {
  return (
    <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-4">
      <p className="text-sm font-medium">Códigos de recuperação</p>
      <p className="mb-3 text-xs text-muted-foreground">
        Guarde em local seguro. Cada código funciona uma única vez e não será
        mostrado novamente.
      </p>
      <div className="grid grid-cols-2 gap-2 font-mono text-sm">
        {codes.map((c) => (
          <span key={c} className="rounded bg-muted px-2 py-1 text-center">
            {c}
          </span>
        ))}
      </div>
    </div>
  );
}

export function TotpSetup({ enabled }: { enabled: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);

  // enrollment
  const [enroll, setEnroll] = useState<{ qr: string; secret: string } | null>(
    null,
  );
  const [code, setCode] = useState("");
  const [active, setActive] = useState(enabled);

  function begin() {
    setError(null);
    start(async () => {
      const r = await startTotpEnrollment();
      setEnroll({ qr: r.qr, secret: r.secret });
    });
  }

  function confirm() {
    setError(null);
    start(async () => {
      const r = await confirmTotpEnrollment(code);
      if (!r.ok) return setError(r.error ?? "Falha ao confirmar.");
      setCodes(r.codes ?? []);
      setEnroll(null);
      setActive(true);
      setCode("");
    });
  }

  function turnOff() {
    setError(null);
    start(async () => {
      const r = await disableTotp(code);
      if (!r.ok) return setError(r.error ?? "Falha ao desativar.");
      setActive(false);
      setCodes(null);
      setCode("");
    });
  }

  function regen() {
    setError(null);
    start(async () => {
      const r = await regenerateRecoveryCodes(code);
      if (!r.ok) return setError(r.error ?? "Falha.");
      setCodes(r.codes ?? []);
      setCode("");
    });
  }

  if (codes) {
    return (
      <div className="space-y-4">
        <p className="flex items-center gap-2 text-sm font-medium text-primary">
          <ShieldCheck className="size-4" /> 2FA ativo
        </p>
        <RecoveryCodes codes={codes} />
        <Button variant="outline" onClick={() => setCodes(null)}>
          Concluir
        </Button>
      </div>
    );
  }

  if (active) {
    return (
      <div className="space-y-4">
        <Badge variant="default" className="gap-1">
          <ShieldCheck className="size-3.5" /> 2FA ativo
        </Badge>
        <p className="text-sm text-muted-foreground">
          A verificação em duas etapas está ativa para esta conta. Para
          desativar ou gerar novos códigos de recuperação, informe um código do
          app autenticador (ou de recuperação).
        </p>
        <div className="space-y-2 max-w-xs">
          <Label htmlFor="code">Código de verificação</Label>
          <Input
            id="code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            inputMode="numeric"
            placeholder="000000"
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex gap-2">
          <Button
            variant="destructive"
            onClick={turnOff}
            disabled={pending || !code}
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ShieldOff className="size-4" />
            )}
            Desativar 2FA
          </Button>
          <Button
            variant="outline"
            onClick={regen}
            disabled={pending || !code}
          >
            <KeyRound className="size-4" />
            Novos códigos de recuperação
          </Button>
        </div>
      </div>
    );
  }

  if (enroll) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Escaneie o QR Code no Google Authenticator, Authy ou similar. Se não
          puder escanear, use a chave manual.
        </p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={enroll.qr}
          alt="QR Code de configuração 2FA"
          className="rounded-lg border"
          width={220}
          height={220}
        />
        <div>
          <p className="text-xs text-muted-foreground">Chave manual</p>
          <code className="break-all text-sm font-mono">{enroll.secret}</code>
        </div>
        <div className="space-y-2 max-w-xs">
          <Label htmlFor="code">Código gerado pelo app</Label>
          <Input
            id="code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            inputMode="numeric"
            placeholder="000000"
            autoFocus
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex gap-2">
          <Button onClick={confirm} disabled={pending || !code}>
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ShieldCheck className="size-4" />
            )}
            Confirmar e ativar
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setEnroll(null);
              setError(null);
            }}
          >
            Cancelar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Badge variant="secondary" className="gap-1">
        <ShieldOff className="size-3.5" /> 2FA inativo
      </Badge>
      <p className="text-sm text-muted-foreground">
        Adicione uma camada extra de segurança exigindo um código do seu
        celular além da senha.
      </p>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button onClick={begin} disabled={pending}>
        {pending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <ShieldCheck className="size-4" />
        )}
        Ativar 2FA
      </Button>
    </div>
  );
}
