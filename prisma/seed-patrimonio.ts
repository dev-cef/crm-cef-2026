import "dotenv/config";
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function gerarCodigo(ano: number, seq: number) {
  return `CEF-${ano}-${String(seq).padStart(3, "0")}`;
}

async function main() {
  console.log("📦 Populando módulo de Patrimônio...");

  // Locais
  const locaisExistentes = await prisma.patrimonioLocal.count();
  let locais;
  if (locaisExistentes === 0) {
    locais = await Promise.all([
      prisma.patrimonioLocal.create({ data: { nome: "Sede CEF", descricao: "Sede principal do CEF em Nova Friburgo" } }),
      prisma.patrimonioLocal.create({ data: { nome: "Depósito", descricao: "Depósito de equipamentos" } }),
      prisma.patrimonioLocal.create({ data: { nome: "Campo", descricao: "Equipamentos em uso em atividades externas" } }),
    ]);
    console.log("  ✅ 3 locais criados");
  } else {
    locais = await prisma.patrimonioLocal.findMany({ orderBy: { createdAt: "asc" } });
    console.log("  ℹ️  Locais já existem, usando existentes");
  }

  const sede = locais[0];
  const deposito = locais[1];
  const campo = locais[2] ?? locais[0];

  const ano = 2024;
  let seq = 1;

  const bens = [
    // Equipamentos de escalada e montanhismo
    {
      codigo: await gerarCodigo(ano, seq++),
      nome: "Corda Semiestática 50m",
      descricao: "Corda para rapel e escalada, diâmetro 10,5mm, fabricante Petzl",
      marca: "Petzl",
      modelo: "Arial 10.5",
      categoria: "equipamento",
      estado: "bom",
      status: "disponivel",
      localId: deposito.id,
      valorAquisicao: 480.00,
      dataAquisicao: new Date("2024-02-10"),
      fornecedor: "Loja do Alpinista",
    },
    {
      codigo: await gerarCodigo(ano, seq++),
      nome: "Corda Dinâmica 60m",
      descricao: "Corda para escalada esportiva, diâmetro 9,8mm",
      marca: "Mammut",
      modelo: "Crag Classic",
      categoria: "equipamento",
      estado: "bom",
      status: "disponivel",
      localId: deposito.id,
      valorAquisicao: 650.00,
      dataAquisicao: new Date("2024-03-15"),
      fornecedor: "Montanhismo Brasil",
    },
    {
      codigo: await gerarCodigo(ano, seq++),
      nome: "Capacete de Escalada",
      descricao: "Capacete leve para escalada e via ferrata",
      marca: "Black Diamond",
      modelo: "Half Dome",
      numeroSerie: "BD2024-0043",
      categoria: "equipamento",
      estado: "otimo",
      status: "disponivel",
      localId: deposito.id,
      valorAquisicao: 320.00,
      dataAquisicao: new Date("2024-01-20"),
    },
    {
      codigo: await gerarCodigo(ano, seq++),
      nome: "Capacete de Escalada",
      descricao: "Capacete leve para escalada e via ferrata",
      marca: "Black Diamond",
      modelo: "Half Dome",
      numeroSerie: "BD2024-0044",
      categoria: "equipamento",
      estado: "bom",
      status: "emprestado",
      localId: campo.id,
      valorAquisicao: 320.00,
      dataAquisicao: new Date("2024-01-20"),
    },
    {
      codigo: await gerarCodigo(ano, seq++),
      nome: "Kit Freios e Mosquetões (10 un.)",
      descricao: "10 mosquetões HMS com trava automática para rapel e segurança",
      marca: "Petzl",
      modelo: "William Ball-Lock",
      categoria: "equipamento",
      estado: "bom",
      status: "disponivel",
      localId: deposito.id,
      valorAquisicao: 750.00,
      dataAquisicao: new Date("2023-11-05"),
    },
    {
      codigo: await gerarCodigo(ano, seq++),
      nome: "Arnês de Escalada",
      descricao: "Arnês regulável para escalada e via ferrata",
      marca: "Singing Rock",
      modelo: "Onyx",
      categoria: "equipamento",
      estado: "regular",
      status: "manutencao",
      localId: sede.id,
      valorAquisicao: 280.00,
      dataAquisicao: new Date("2022-06-12"),
      observacoes: "Costura de fixação do anel ventral apresentando desgaste. Enviado para revisão.",
    },
    {
      codigo: await gerarCodigo(ano, seq++),
      nome: "Arnês de Escalada",
      descricao: "Arnês regulável para escalada e via ferrata",
      marca: "Singing Rock",
      modelo: "Onyx",
      categoria: "equipamento",
      estado: "bom",
      status: "disponivel",
      localId: deposito.id,
      valorAquisicao: 280.00,
      dataAquisicao: new Date("2023-04-08"),
    },
    {
      codigo: await gerarCodigo(ano, seq++),
      nome: "Barraca Expedition 4 pessoas",
      descricao: "Barraca geodésica para alta montanha, 4 estações",
      marca: "Mountain Hardwear",
      modelo: "EV 4",
      categoria: "equipamento",
      estado: "bom",
      status: "disponivel",
      localId: deposito.id,
      valorAquisicao: 1850.00,
      dataAquisicao: new Date("2023-07-20"),
      fornecedor: "Adventure Sports",
    },
    {
      codigo: await gerarCodigo(ano, seq++),
      nome: "Barraca Camping 2 pessoas",
      descricao: "Barraca leve para trilhas e acampamentos",
      marca: "Quechua",
      modelo: "MH100 Ultra",
      categoria: "equipamento",
      estado: "bom",
      status: "disponivel",
      localId: deposito.id,
      valorAquisicao: 390.00,
      dataAquisicao: new Date("2024-04-01"),
    },
    {
      codigo: await gerarCodigo(ano, seq++),
      nome: "Kit Primeiros Socorros",
      descricao: "Kit completo de primeiros socorros para atividades em campo",
      categoria: "equipamento",
      estado: "bom",
      status: "disponivel",
      localId: sede.id,
      valorAquisicao: 180.00,
      dataAquisicao: new Date("2024-01-05"),
      observacoes: "Verificar validade dos medicamentos semestralmente.",
    },
    // Eletrônicos
    {
      codigo: await gerarCodigo(ano, seq++),
      nome: "Rádio Comunicador (par)",
      descricao: "Par de rádios comunicadores para uso em campo, alcance 10km",
      marca: "Motorola",
      modelo: "T400",
      categoria: "eletronico",
      estado: "bom",
      status: "disponivel",
      localId: sede.id,
      valorAquisicao: 420.00,
      dataAquisicao: new Date("2023-09-15"),
      vidaUtilAnos: 5,
      valorResidual: 50.00,
    },
    {
      codigo: await gerarCodigo(ano, seq++),
      nome: "GPS de Navegação",
      descricao: "GPS portátil para trilhas e navegação em campo",
      marca: "Garmin",
      modelo: "eTrex 32x",
      numeroSerie: "GMN-2024-7741",
      categoria: "eletronico",
      estado: "otimo",
      status: "emprestado",
      localId: campo.id,
      valorAquisicao: 890.00,
      dataAquisicao: new Date("2024-02-28"),
      vidaUtilAnos: 7,
      valorResidual: 100.00,
    },
    {
      codigo: await gerarCodigo(ano, seq++),
      nome: "Projetor Multimídia",
      descricao: "Projetor para apresentações e reuniões na sede",
      marca: "Epson",
      modelo: "S41+",
      numeroSerie: "EPS-2023-1188",
      categoria: "eletronico",
      estado: "bom",
      status: "disponivel",
      localId: sede.id,
      valorAquisicao: 1200.00,
      dataAquisicao: new Date("2023-03-10"),
      vidaUtilAnos: 6,
      valorResidual: 200.00,
    },
    {
      codigo: await gerarCodigo(ano, seq++),
      nome: "Notebook Dell",
      descricao: "Notebook para uso administrativo na sede",
      marca: "Dell",
      modelo: "Inspiron 15",
      numeroSerie: "DL2023-44821",
      categoria: "eletronico",
      estado: "bom",
      status: "em_uso",
      localId: sede.id,
      valorAquisicao: 2800.00,
      dataAquisicao: new Date("2023-06-01"),
      vidaUtilAnos: 4,
      valorResidual: 400.00,
    },
    // Móveis e utensílios
    {
      codigo: await gerarCodigo(ano, seq++),
      nome: "Mesa de Reunião 8 lugares",
      descricao: "Mesa retangular para sala de reuniões da sede",
      marca: "Tok&Stok",
      categoria: "movel_utensilio",
      estado: "bom",
      status: "em_uso",
      localId: sede.id,
      valorAquisicao: 950.00,
      dataAquisicao: new Date("2020-08-15"),
      vidaUtilAnos: 10,
      valorResidual: 100.00,
    },
    {
      codigo: await gerarCodigo(ano, seq++),
      nome: "Cadeiras Empilháveis (8 un.)",
      descricao: "Conjunto de 8 cadeiras para reuniões e eventos",
      categoria: "movel_utensilio",
      estado: "bom",
      status: "em_uso",
      localId: sede.id,
      valorAquisicao: 640.00,
      dataAquisicao: new Date("2020-08-15"),
      vidaUtilAnos: 10,
      valorResidual: 80.00,
    },
    {
      codigo: await gerarCodigo(ano, seq++),
      nome: "Armário de Equipamentos",
      descricao: "Armário metálico com 4 compartimentos para guarda de EPIs",
      categoria: "movel_utensilio",
      estado: "bom",
      status: "em_uso",
      localId: deposito.id,
      valorAquisicao: 780.00,
      dataAquisicao: new Date("2021-05-20"),
      vidaUtilAnos: 15,
      valorResidual: 100.00,
    },
    {
      codigo: await gerarCodigo(ano, seq++),
      nome: "Fogão Camping 2 bocas",
      descricao: "Fogão portátil a gás para uso em acampamentos",
      marca: "Brasfort",
      modelo: "Super GLP",
      categoria: "movel_utensilio",
      estado: "bom",
      status: "disponivel",
      localId: deposito.id,
      valorAquisicao: 220.00,
      dataAquisicao: new Date("2023-10-05"),
    },
    {
      codigo: `CEF-2023-001`,
      nome: "Caixa de Som Portátil",
      descricao: "Caixa de som Bluetooth para eventos e apresentações",
      marca: "JBL",
      modelo: "Charge 5",
      numeroSerie: "JBL-2023-9902",
      categoria: "eletronico",
      estado: "danificado",
      status: "baixado",
      localId: sede.id,
      valorAquisicao: 780.00,
      dataAquisicao: new Date("2023-01-10"),
      observacoes: "Entrada de carregamento danificada por água. Descartado em 05/06/2026.",
    },
  ];

  let criados = 0;
  for (const bem of bens) {
    const existe = await prisma.patrimonioBem.findUnique({ where: { codigo: bem.codigo } });
    if (existe) { console.log(`  ⏭  ${bem.codigo} já existe`); continue; }

    const created = await prisma.patrimonioBem.create({ data: bem as Parameters<typeof prisma.patrimonioBem.create>[0]["data"] });

    // Movimentação de entrada
    await prisma.patrimonioMovimentacao.create({
      data: {
        bemId: created.id,
        tipo: "entrada",
        data: bem.dataAquisicao ?? new Date(),
        localDestinoId: bem.localId ?? null,
        observacoes: "Cadastro inicial do bem.",
      },
    });

    // Movimentação extra para bens em estados especiais
    if (bem.status === "manutencao") {
      await prisma.patrimonioMovimentacao.create({
        data: {
          bemId: created.id,
          tipo: "manutencao",
          data: new Date("2026-06-01"),
          localOrigemId: deposito.id,
          observacoes: bem.observacoes ?? "Enviado para manutenção.",
        },
      });
    }
    if (bem.status === "emprestado") {
      await prisma.patrimonioMovimentacao.create({
        data: {
          bemId: created.id,
          tipo: "emprestimo",
          data: new Date("2026-06-10"),
          localOrigemId: deposito.id,
          localDestinoId: campo.id,
          dataDevolucaoPrevista: new Date("2026-06-30"),
          observacoes: "Emprestado para atividade de campo.",
        },
      });
    }
    if (bem.status === "baixado") {
      await prisma.patrimonioMovimentacao.create({
        data: {
          bemId: created.id,
          tipo: "baixa",
          data: new Date("2026-06-05"),
          observacoes: "Bem danificado além do reparo. Descartado.",
        },
      });
    }

    criados++;
  }

  console.log(`  ✅ ${criados} bens criados`);
  console.log("✅ Patrimônio populado com sucesso!");
}

main()
  .then(async () => { await prisma.$disconnect(); })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
