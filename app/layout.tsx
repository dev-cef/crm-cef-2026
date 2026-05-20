import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Fraunces, Hanken_Grotesk, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const fontBody = Hanken_Grotesk({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const fontDisplay = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  display: "swap",
});

const fontMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "CRM CEF — Clube Excursionista de Friburgo",
  description:
    "Sistema de gestão de associados, financeiro e eventos do Clube Excursionista de Friburgo.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const theme = (await cookies()).get("theme")?.value;
  const isDark = theme !== "light";

  return (
    <html
      lang="pt-BR"
      className={`${fontBody.variable} ${fontDisplay.variable} ${fontMono.variable} h-full antialiased${isDark ? " dark" : ""}`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
