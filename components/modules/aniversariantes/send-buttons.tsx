"use client";

import { useTransition } from "react";
import { Mail, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import {
  prepareWhatsApp,
  sendBirthdayEmail,
} from "@/app/(app)/aniversariantes/actions";
import { Button } from "@/components/ui/button";

export function SendButtons({ memberId }: { memberId: string }) {
  const [pending, startTransition] = useTransition();

  function whatsapp() {
    startTransition(async () => {
      const res = await prepareWhatsApp(memberId);
      if (res.ok && res.url) {
        window.open(res.url, "_blank", "noopener");
        toast.success("Mensagem registrada. Abrindo WhatsApp...");
      } else {
        toast.error(res.error ?? "Erro ao preparar a mensagem.");
      }
    });
  }

  function email() {
    startTransition(async () => {
      const res = await sendBirthdayEmail(memberId);
      if (res.ok) {
        toast.success(
          res.simulated
            ? "E-mail registrado (simulado — configure SMTP para envio real)."
            : "E-mail enviado!",
        );
      } else {
        toast.error(res.error ?? "Erro ao enviar e-mail.");
      }
    });
  }

  return (
    <div className="flex justify-end gap-1">
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={whatsapp}
        disabled={pending}
        aria-label="Enviar WhatsApp"
        title="WhatsApp"
      >
        <MessageCircle className="size-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={email}
        disabled={pending}
        aria-label="Enviar e-mail"
        title="E-mail"
      >
        <Mail className="size-4" />
      </Button>
    </div>
  );
}
