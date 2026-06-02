"use client";

import Link from "next/link";
import { Download } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ReportDownloadButton({ href }: { href: string }) {
  return (
    <Link
      href={href}
      prefetch={false}
      className={cn(buttonVariants({ size: "sm", variant: "outline" }), "gap-1.5")}
    >
      <Download className="size-3.5" />
      Exportar
    </Link>
  );
}
