import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-10 w-64" />
      <div className="grid gap-4 md:grid-cols-3">
        <Skeleton className="h-48 md:col-span-1" />
        <Skeleton className="h-48 md:col-span-2" />
        <Skeleton className="h-40 md:col-span-3" />
        <Skeleton className="h-56 md:col-span-3" />
      </div>
    </div>
  );
}
