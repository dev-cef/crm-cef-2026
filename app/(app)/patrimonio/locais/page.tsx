import { getLocaisTodos } from "@/lib/patrimonio/queries";
import LocaisClient from "./locais-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Locais — Patrimônio CEF" };

export default async function LocaisPage() {
  const locais = await getLocaisTodos();
  return <LocaisClient locais={locais} />;
}
