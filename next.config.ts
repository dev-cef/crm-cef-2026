import type { NextConfig } from "next";

// CSP compatível com Next 16/Turbopack (bootstrap inline) — sem domínios
// externos. Endurecer com nonce é follow-up.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://covers.openlibrary.org https://books.google.com https://*.public.blob.vercel-storage.com",
  "font-src 'self'",
  // googleapis.com: upload resumable de documentos direto do navegador pro Drive
  "connect-src 'self' https://viacep.com.br https://www.googleapis.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  { key: "Content-Security-Policy", value: csp },
];

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "covers.openlibrary.org" },
      { protocol: "https", hostname: "books.google.com" },
      { protocol: "https", hostname: "*.public.blob.vercel-storage.com" },
    ],
  },
  serverExternalPackages: ["@neondatabase/serverless", "@prisma/adapter-neon", "@prisma/adapter-pg", "@prisma/client"],
  experimental: {
    serverActions: {
      // Comprovantes/fotos são validados a até 3MB no cliente, mas base64
      // infla o tamanho em ~33% — 4mb fica na borda exata do limite.
      bodySizeLimit: "6mb",
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
