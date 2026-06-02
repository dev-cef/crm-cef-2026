"use client";

import { useState } from "react";
import Link from "next/link";
import { Download, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ActivityReportCard({
  title,
  description,
  baseHref,
  stat,
}: {
  title: string;
  description: string;
  baseHref: string;
  stat: string;
}) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const href = () => {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to)   params.set("to", to);
    const qs = params.toString();
    return qs ? `${baseHref}?${qs}` : baseHref;
  };

  return (
    <Card className="relative overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-sm font-semibold leading-snug">{title}</CardTitle>
          <Badge variant="outline" className="shrink-0 text-[10px]">
            <FileText className="mr-1 size-3" />
            CSV
          </Badge>
        </div>
        <CardDescription className="text-xs">{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {/* Period filter */}
        <div className="flex flex-wrap gap-2">
          <div className="flex flex-1 flex-col gap-1">
            <label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              De
            </label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="h-8 w-full rounded-md border bg-background px-2 text-xs outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div className="flex flex-1 flex-col gap-1">
            <label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Até
            </label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              min={from || undefined}
              className="h-8 w-full rounded-md border bg-background px-2 text-xs outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">
            {from || to
              ? `${from ? new Date(from + "T00:00:00").toLocaleDateString("pt-BR") : "início"} → ${to ? new Date(to + "T00:00:00").toLocaleDateString("pt-BR") : "hoje"}`
              : stat}
          </span>
          <Link
            href={href()}
            prefetch={false}
            className={cn(buttonVariants({ size: "sm", variant: "outline" }), "gap-1.5")}
          >
            <Download className="size-3.5" />
            Exportar
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
