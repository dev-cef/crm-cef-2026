import { requireAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { membershipNumber } from "@/lib/membership";
import { toBrDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ProducaoPage() {
  await requireAdmin();

  const requests = await prisma.physicalCardRequest.findMany({
    where: { currentStage: "issuance_pending" },
    include: {
      member: {
        select: {
          fullName: true,
          registration: true,
          photoUrl: true,
          cardValidUntil: true,
          plan: { select: { name: true } },
        },
      },
    },
    orderBy: { member: { fullName: "asc" } },
  });

  const today = new Date().toLocaleDateString("pt-BR");

  return (
    <div className="p-6 print:p-0">
      {/* Cabeçalho — oculto na impressão via @media print abaixo */}
      <div className="mb-6 flex items-center justify-between print:hidden">
        <h1 className="text-xl font-semibold">Lista de Produção — Carteirinhas Físicas</h1>
        <button
          onClick={() => window.print()}
          className="rounded-md border px-4 py-2 text-sm hover:bg-accent"
        >
          Imprimir / Exportar PDF
        </button>
      </div>

      {/* Conteúdo imprimível */}
      <div className="print-area">
        <div className="mb-6 print:mb-4">
          <h1 className="text-lg font-bold">
            Clube Excursionista de Friburgo — Lista de Produção
          </h1>
          <p className="text-sm text-gray-600">Gerado em {today} · {requests.length} carteirinha(s)</p>
        </div>

        {requests.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhuma carteirinha aguardando emissão.</p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b-2 border-black">
                <th className="py-2 pr-4 text-left font-semibold">#</th>
                <th className="py-2 pr-4 text-left font-semibold">Nome</th>
                <th className="py-2 pr-4 text-left font-semibold">Matrícula</th>
                <th className="py-2 pr-4 text-left font-semibold">Plano</th>
                <th className="py-2 text-left font-semibold">Validade</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r, i) => {
                const validity = r.member.cardValidUntil
                  ? toBrDate(r.member.cardValidUntil)
                  : `31/12/${new Date().getFullYear()}`;

                return (
                  <tr key={r.id} className="border-b border-gray-200">
                    <td className="py-2 pr-4 text-gray-500">{i + 1}</td>
                    <td className="py-2 pr-4 font-medium">{r.member.fullName}</td>
                    <td className="py-2 pr-4">{membershipNumber(r.member.registration)}</td>
                    <td className="py-2 pr-4 text-gray-600">{r.member.plan?.name ?? "—"}</td>
                    <td className="py-2">{validity}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <style>{`
        @media print {
          body { font-size: 12px; }
          .print\\:hidden { display: none !important; }
          .print-area { padding: 0; }
        }
      `}</style>
    </div>
  );
}
