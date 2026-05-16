export function CefLogo({ className }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/cef-crest.png"
      alt="Centro Excursionista Friburguense"
      className={className}
      style={{ objectFit: "contain" }}
    />
  );
}
