"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { verificarMembro, ativarAcesso } from "./actions";

type Step = "verificar" | "senha" | "sucesso";

function CpfInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  function mask(v: string) {
    const d = v.replace(/\D/g, "").slice(0, 11);
    return d
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/(\d{3})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3-$4");
  }
  return (
    <Input
      id="cpf"
      type="text"
      inputMode="numeric"
      placeholder="000.000.000-00"
      value={value}
      onChange={(e) => onChange(mask(e.target.value))}
      maxLength={14}
    />
  );
}

export function AtivarAcessoForm() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("verificar");
  const [loading, setLoading] = useState(false);

  const [email, setEmail] = useState("");
  const [cpf, setCpf] = useState("");
  const [memberId, setMemberId] = useState("");
  const [memberName, setMemberName] = useState("");

  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [formError, setFormError] = useState("");

  async function handleVerificar(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !cpf) return;
    setLoading(true);
    const res = await verificarMembro(email, cpf);
    setLoading(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setMemberId(res.memberId);
    setMemberName(res.name);
    setStep("senha");
  }

  async function handleAtivar(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    if (password.length < 12) {
      setFormError("A senha deve ter no mínimo 12 caracteres.");
      return;
    }
    if (password !== password2) {
      setFormError("As senhas não coincidem.");
      return;
    }
    setLoading(true);
    const res = await ativarAcesso(memberId, email, password);
    setLoading(false);
    if (!res.ok) {
      setFormError(res.error);
      return;
    }
    setStep("sucesso");
  }

  if (step === "sucesso") {
    return (
      <div className="space-y-4 text-center">
        <div className="text-4xl">✅</div>
        <div>
          <p className="font-semibold">Acesso ativado com sucesso!</p>
          <p className="text-sm text-muted-foreground mt-1">
            Olá, {memberName}! Sua conta foi criada. Agora você pode entrar no
            portal do associado.
          </p>
        </div>
        <Button className="w-full" onClick={() => router.push("/login")}>
          Entrar no portal
        </Button>
      </div>
    );
  }

  if (step === "senha") {
    return (
      <form onSubmit={handleAtivar} className="space-y-4">
        <div className="rounded-lg bg-primary/5 border border-primary/20 px-4 py-3 text-sm">
          ✅ Associado encontrado: <strong>{memberName}</strong>
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Nova senha *</Label>
          <Input
            id="password"
            type="password"
            placeholder="Mín. 12 caracteres, maiúscula, número e símbolo"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setFormError(""); }}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password2">Confirmar senha *</Label>
          <Input
            id="password2"
            type="password"
            placeholder="Repita a senha"
            value={password2}
            onChange={(e) => { setPassword2(e.target.value); setFormError(""); }}
            required
          />
        </div>
        {formError && (
          <p className="text-sm text-destructive rounded-md bg-destructive/10 px-3 py-2">
            {formError}
          </p>
        )}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Ativando..." : "Ativar acesso"}
        </Button>
        <button
          type="button"
          onClick={() => setStep("verificar")}
          className="w-full text-sm text-muted-foreground hover:underline"
        >
          ← Voltar
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={handleVerificar} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">E-mail cadastrado *</Label>
        <Input
          id="email"
          type="email"
          placeholder="seu@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="cpf">CPF *</Label>
        <CpfInput value={cpf} onChange={setCpf} />
      </div>
      <Button type="submit" className="w-full" disabled={loading || !email || cpf.length < 14}>
        {loading ? "Verificando..." : "Verificar cadastro"}
      </Button>
    </form>
  );
}
