export function PageHeader({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="cef-rise mb-7 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="relative pl-4">
        <span
          aria-hidden
          className="absolute left-0 top-1 h-[calc(100%-0.5rem)] w-1 rounded-full bg-primary"
        />
        <h1 className="font-display text-3xl font-semibold leading-tight tracking-tight">
          {title}
        </h1>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {children && (
        <div className="flex flex-wrap items-center gap-2">{children}</div>
      )}
    </div>
  );
}
