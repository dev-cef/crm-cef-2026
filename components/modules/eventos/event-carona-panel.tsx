"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Car, Loader2, MapPin, Phone, Plus, User, X } from "lucide-react";
import { toast } from "sonner";
import {
  cancelCaronaOffer,
  claimSeat,
  offerCarona,
  releaseSeat,
} from "@/app/(app)/eventos/actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface CaronaOffer {
  id: string;
  driverId: string;
  driverName: string;
  driverPhone: string;
  driverWhatsapp: string | null;
  seats: number;
  note: string | null;
  passengers: { id: string; memberId: string; memberName: string }[];
}

export function EventCaronaPanel({
  eventId,
  offers,
  selfMemberId,
  isRegistered,
  eventStatus,
}: {
  eventId: string;
  offers: CaronaOffer[];
  selfMemberId?: string | null;
  isRegistered: boolean;
  eventStatus?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [seats, setSeats] = useState(2);
  const [note, setNote] = useState("");

  const isClosed = eventStatus === "REALIZADO" || eventStatus === "CANCELADO";
  const myOffer = offers.find((o) => o.driverId === selfMemberId);
  const myPassengerEntry = selfMemberId
    ? offers.flatMap((o) => o.passengers).find((p) => p.memberId === selfMemberId)
    : null;
  const myCaronaAsPassenger = myPassengerEntry
    ? offers.find((o) => o.passengers.some((p) => p.memberId === selfMemberId))
    : null;

  function handleOffer() {
    if (!selfMemberId) return;
    startTransition(async () => {
      const res = await offerCarona(eventId, selfMemberId, seats, note.trim() || undefined);
      if (res.ok) {
        toast.success("Carona oferecida com sucesso!");
        setShowForm(false);
        setNote("");
        router.refresh();
      } else {
        toast.error(res.error ?? "Erro.");
      }
    });
  }

  function handleCancelOffer(caronaId: string) {
    startTransition(async () => {
      const res = await cancelCaronaOffer(caronaId, eventId);
      if (res.ok) {
        toast.success("Oferta de carona cancelada.");
        router.refresh();
      } else {
        toast.error(res.error ?? "Erro.");
      }
    });
  }

  function handleClaim(caronaId: string) {
    if (!selfMemberId) return;
    startTransition(async () => {
      const res = await claimSeat(caronaId, selfMemberId, eventId);
      if (res.ok) {
        toast.success("Vaga reservada! Entre em contato com o motorista.");
        router.refresh();
      } else {
        toast.error(res.error ?? "Erro.");
      }
    });
  }

  function handleRelease(passengerId: string) {
    startTransition(async () => {
      const res = await releaseSeat(passengerId, eventId);
      if (res.ok) {
        toast.success("Vaga liberada.");
        router.refresh();
      } else {
        toast.error(res.error ?? "Erro.");
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* Self action: offer or cancel */}
      {selfMemberId && isRegistered && !isClosed && (
        <div className="rounded-lg border p-3">
          {myOffer ? (
            <div className="flex items-center gap-3">
              <Car className="size-4 shrink-0 text-primary" />
              <span className="flex-1 text-sm">
                Você está oferecendo{" "}
                <strong>{myOffer.seats} vaga{myOffer.seats !== 1 ? "s" : ""}</strong>
                {myOffer.note ? ` · ${myOffer.note}` : ""}.
              </span>
              <Button
                size="sm"
                variant="outline"
                className="text-destructive hover:text-destructive"
                disabled={pending}
                onClick={() => handleCancelOffer(myOffer.id)}
              >
                {pending ? <Loader2 className="size-4 animate-spin" /> : <X className="size-4" />}
                Cancelar oferta
              </Button>
            </div>
          ) : showForm ? (
            <div className="space-y-3">
              <p className="text-sm font-medium">Oferecer carona</p>
              <div className="flex flex-wrap gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-muted-foreground">Vagas disponíveis</label>
                  <div className="flex items-center gap-2">
                    <Button size="icon-sm" variant="outline" onClick={() => setSeats(Math.max(1, seats - 1))} type="button">−</Button>
                    <span className="w-6 text-center text-sm font-semibold">{seats}</span>
                    <Button size="icon-sm" variant="outline" onClick={() => setSeats(Math.min(8, seats + 1))} type="button">+</Button>
                  </div>
                </div>
                <div className="flex flex-1 flex-col gap-1">
                  <label className="text-xs text-muted-foreground">Ponto de saída (opcional)</label>
                  <input
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Ex: Super Pão, 7:30h"
                    className="h-9 w-full rounded-md border bg-background px-3 text-sm outline-none"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleOffer} disabled={pending}>
                  {pending ? <Loader2 className="size-4 animate-spin" /> : <Car className="size-4" />}
                  Confirmar
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setShowForm(false)} disabled={pending}>
                  Cancelar
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Car className="size-4 shrink-0 text-muted-foreground" />
              <span className="flex-1 text-sm text-muted-foreground">
                {myCaronaAsPassenger
                  ? `Você tem vaga no carro de ${myCaronaAsPassenger.driverName}.`
                  : "Você pode oferecer vagas no seu carro para outros participantes."}
              </span>
              {!myCaronaAsPassenger && (
                <Button size="sm" variant="outline" onClick={() => setShowForm(true)}>
                  <Plus className="size-4" /> Oferecer carona
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Offers list */}
      {offers.length === 0 ? (
        <p className="py-2 text-sm text-muted-foreground">
          Nenhuma carona oferecida ainda.
        </p>
      ) : (
        <div className="space-y-3">
          {offers.map((offer) => {
            const taken = offer.passengers.length;
            const free = offer.seats - taken;
            const myPassenger = offer.passengers.find((p) => p.memberId === selfMemberId);
            const isMine = offer.driverId === selfMemberId;

            return (
              <div key={offer.id} className="rounded-lg border p-3 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 font-medium">
                      <User className="size-3.5 text-muted-foreground" />
                      {offer.driverName}
                      {isMine && (
                        <Badge variant="secondary" className="text-[10px]">você</Badge>
                      )}
                    </div>
                    {offer.note && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <MapPin className="size-3 shrink-0" />
                        {offer.note}
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Phone className="size-3 shrink-0" />
                      {offer.driverWhatsapp ?? offer.driverPhone}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge
                      variant="secondary"
                      className={cn(
                        free > 0 ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300" : "bg-muted text-muted-foreground",
                      )}
                    >
                      {free > 0 ? `${free} vaga${free !== 1 ? "s" : ""} livre${free !== 1 ? "s" : ""}` : "Lotado"}
                    </Badge>

                    {selfMemberId && !isMine && !isClosed && isRegistered && (
                      myPassenger ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-destructive hover:text-destructive"
                          disabled={pending}
                          onClick={() => handleRelease(myPassenger.id)}
                        >
                          {pending ? <Loader2 className="size-3 animate-spin" /> : <X className="size-3" />}
                          Cancelar
                        </Button>
                      ) : free > 0 && !myCaronaAsPassenger && !myOffer ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={pending}
                          onClick={() => handleClaim(offer.id)}
                        >
                          {pending ? <Loader2 className="size-3 animate-spin" /> : <Car className="size-3" />}
                          Quero vaga
                        </Button>
                      ) : null
                    )}
                  </div>
                </div>

                {/* Passengers */}
                {offer.passengers.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5 border-t pt-2">
                    {offer.passengers.map((p) => (
                      <span
                        key={p.id}
                        className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs"
                      >
                        {p.memberName}
                        {p.memberId === selfMemberId && " (você)"}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
