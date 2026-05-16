import { Construction } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export function ComingSoon({ module }: { module: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-muted">
          <Construction className="size-6 text-muted-foreground" />
        </div>
        <div>
          <p className="font-medium">Módulo {module} — em desenvolvimento</p>
          <p className="text-sm text-muted-foreground">
            Será entregue na fase 3, após a verificação da fundação.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
