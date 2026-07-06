"use client";

import { useEffect } from "react";

// Captura erros no próprio layout raiz — substitui todo o documento, então
// não conta com o Tailwind/globals.css. Estilos inline, autossuficiente.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global error]", error);
  }, [error]);

  return (
    <html lang="pt-BR">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1rem",
          padding: "1.5rem",
          textAlign: "center",
          fontFamily:
            "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
          background: "#0b0f14",
          color: "#e5e7eb",
        }}
      >
        <h1 style={{ fontSize: "1.5rem", fontWeight: 600, margin: 0 }}>
          Algo deu errado
        </h1>
        <p style={{ maxWidth: "24rem", fontSize: "0.9rem", color: "#9ca3af" }}>
          Ocorreu um erro inesperado ao carregar o sistema. Tente novamente.
        </p>
        {error.digest && (
          <p style={{ fontSize: "0.75rem", color: "#6b7280" }}>
            Ref: {error.digest}
          </p>
        )}
        <button
          onClick={reset}
          style={{
            marginTop: "0.5rem",
            padding: "0.5rem 1rem",
            borderRadius: "0.5rem",
            border: "none",
            background: "#2563eb",
            color: "#fff",
            fontSize: "0.9rem",
            cursor: "pointer",
          }}
        >
          Tentar novamente
        </button>
      </body>
    </html>
  );
}
