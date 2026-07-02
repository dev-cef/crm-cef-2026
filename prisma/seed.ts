import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { generateCpf } from "../lib/cpf";
import { passwordSchema } from "../lib/validations/auth";

// ─── Guarda contra execução acidental em produção ────────────────────────────
// O seed apaga TODOS os dados. Só deve rodar em ambiente de desenvolvimento.
// Para forçar em ambientes de teste, defina ALLOW_SEED=true explicitamente.
const dbUrl = process.env.DATABASE_URL ?? "";
const isProduction =
  !process.env.ALLOW_SEED &&
  (process.env.NODE_ENV === "production" ||
    dbUrl.includes("neon.tech") ||
    dbUrl.includes("supabase") ||
    dbUrl.includes("railway") ||
    dbUrl.includes("planetscale"));

if (isProduction) {
  console.error(
    "🚫 SEED BLOQUEADO: banco de produção detectado.\n" +
      "   Para executar intencionalmente, defina ALLOW_SEED=true antes do comando:\n" +
      "   ALLOW_SEED=true npm run seed",
  );
  process.exit(1);
}
// ─────────────────────────────────────────────────────────────────────────────

// Senha padrão dos usuários semeados — compatível com a política (≥12, maiúscula,
// minúscula, número, símbolo). Validada abaixo antes do hash.
const SEED_PASSWORD = "59bMtAu$I6qPoYcE";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const NEIGHBORHOODS = [
  "Centro",
  "Conselheiro Paulino",
  "Olaria",
  "Cordoeira",
  "Duas Pedras",
  "Jardim Califórnia",
  "Braunes",
  "Lagoinha",
  "Vargem Grande",
  "Cascatinha",
  "Mury",
  "Amparo",
  "Riograndina",
];

const STREETS = [
  "Rua General Osório",
  "Avenida Alberto Braune",
  "Rua Monsenhor Miranda",
  "Rua Farinha Filho",
  "Avenida Galdino do Valle Filho",
  "Rua Marechal Floriano",
  "Rua Doutor Luiz da Silva Sant'Anna",
  "Estrada Friburgo-Mury",
  "Rua Teodoro Peixoto",
  "Rua Carlos Otto",
];

const FIRST_NAMES_M = [
  "João", "Pedro", "Lucas", "Rafael", "Bruno", "Felipe", "Gustavo",
  "Marcelo", "Thiago", "André", "Rodrigo", "Vinícius", "Carlos", "Daniel",
];
const FIRST_NAMES_F = [
  "Maria", "Ana", "Juliana", "Fernanda", "Camila", "Patrícia", "Beatriz",
  "Larissa", "Carolina", "Mariana", "Gabriela", "Renata", "Luana", "Aline",
];
const LAST_NAMES = [
  "Silva", "Souza", "Oliveira", "Pereira", "Costa", "Rodrigues", "Almeida",
  "Carvalho", "Gomes", "Martins", "Araújo", "Ribeiro", "Fernandes", "Barbosa",
  "Rocha", "Dias", "Monteiro", "Cardoso", "Teixeira", "Moraes",
];

const BLOOD = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "NAO_SEI"];
const EXP = ["NUNCA", "MENOS_1", "MAIS_1", "MAIS_5", "MAIS_10", "PARADO"];
const HEALTH = [
  "Alérgico", "Hipertensão", "Diabetes", "Vertigens", "Problema cardíaco",
  "Problema pulmonar", "Doença reumática", "Hérnia", "Outros",
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function pad(n: number, len: number): string {
  return String(n).padStart(len, "0");
}

async function main() {
  console.log("🌱 Limpando dados...");
  await prisma.auditLog.deleteMany();
  await prisma.messageLog.deleteMany();
  await prisma.messengerConfig.deleteMany();
  await prisma.eventRegistration.deleteMany();
  await prisma.eventPhoto.deleteMany();
  await prisma.event.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.userDepartment.deleteMany();
  await prisma.patrimonioMovimentacao.deleteMany();
  await prisma.patrimonioBem.deleteMany();
  await prisma.patrimonioLocal.deleteMany();
  await prisma.bibliotecaEmprestimo.deleteMany();
  await prisma.bibliotecaReserva.deleteMany();
  await prisma.bibliotecaLivro.deleteMany();
  await prisma.bibliotecaCategoria.deleteMany();
  await prisma.member.deleteMany();
  await prisma.department.deleteMany();
  await prisma.plan.deleteMany();
  await prisma.user.deleteMany();

  console.log("👤 Criando administradores...");
  // Enforce a política de senha no ponto onde a senha é definida.
  passwordSchema.parse(SEED_PASSWORD);
  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 12);
  await prisma.user.createMany({
    data: [
      { name: "Administrador CEF", email: "admin@cef.org.br", passwordHash, role: "ADMIN" },
      { name: "Dario", email: "dario@wedesign.com.br", passwordHash, role: "ADMIN" },
      { name: "Diretoria CEF", email: "diretoria@cef.org.br", passwordHash, role: "ADMIN" },
    ],
  });

  console.log("💳 Criando planos...");
  const efetivo = await prisma.plan.create({
    data: {
      name: "Sócio Efetivo",
      monthlyPrice: 50,
      description: "Acesso completo a todas as atividades e eventos do clube.",
    },
  });
  const familiar = await prisma.plan.create({
    data: {
      name: "Sócio Familiar",
      monthlyPrice: 80,
      description: "Plano para grupo familiar (até 4 dependentes).",
    },
  });
  const estudante = await prisma.plan.create({
    data: {
      name: "Sócio Estudante",
      monthlyPrice: 25,
      description: "Plano com desconto para estudantes (mediante comprovação).",
    },
  });
  const plans = [efetivo, familiar, estudante];

  console.log("🏔️  Criando departamentos...");
  const departments = await Promise.all(
    [
      { name: "Trilhas e Caminhadas", slug: "trilhas" },
      { name: "Escalada", slug: "escalada" },
      { name: "Cicloturismo", slug: "cicloturismo" },
      { name: "Espeleologia", slug: "espeleologia" },
    ].map((d) => prisma.department.create({ data: d })),
  );

  console.log("🧗 Criando 30 associados...");
  const now = new Date(2026, 4, 16); // 2026-05-16 (mês 4 = Maio)
  const memberIds: string[] = [];

  for (let i = 0; i < 30; i++) {
    const isMale = Math.random() < 0.5;
    const first = isMale ? pick(FIRST_NAMES_M) : pick(FIRST_NAMES_F);
    const fullName = `${first} ${pick(LAST_NAMES)} ${pick(LAST_NAMES)}`;
    const plan = pick(plans);

    // Garante que ~6 associados façam aniversário no mês atual (Maio)
    const birthMonth = i < 6 ? 4 : randInt(0, 11);
    const birthDate = new Date(
      Date.UTC(randInt(1962, 2005), birthMonth, randInt(1, 28)),
    );

    const conditions: string[] = [];
    if (Math.random() < 0.35) {
      const c = pick(HEALTH);
      conditions.push(c);
      if (Math.random() < 0.3) conditions.push(pick(HEALTH));
    }

    const member = await prisma.member.create({
      data: {
        registration: 1000 + i,
        fullName,
        sex: isMale ? "M" : "F",
        email: `${first.toLowerCase()}.${i}@email.com`,
        phone: `(22) 9${randInt(8000, 9999)}${randInt(1000, 9999)}`,
        birthDate,
        cpf: generateCpf(),
        cep: `286${randInt(10, 99)}-${pad(randInt(0, 999), 3)}`,
        street: pick(STREETS),
        number: String(randInt(1, 1200)),
        complement: Math.random() < 0.3 ? `Apt ${randInt(101, 904)}` : null,
        neighborhood: pick(NEIGHBORHOODS),
        city: "Nova Friburgo",
        state: "RJ",
        bloodType: pick(BLOOD),
        emergencyName: `${pick([...FIRST_NAMES_M, ...FIRST_NAMES_F])} ${pick(LAST_NAMES)}`,
        emergencyPhone: `(22) 9${randInt(8000, 9999)}${randInt(1000, 9999)}`,
        healthConditions: JSON.stringify(conditions),
        healthDetails:
          conditions.length > 0 ? "Acompanhamento médico regular." : null,
        mountainExperience: pick(EXP),
        otherGroup: Math.random() < 0.25,
        otherGroupName: Math.random() < 0.25 ? "Grupo Trilhas RJ" : null,
        interestHiking: randInt(1, 5),
        interestClimbing: randInt(1, 5),
        interestCourse: randInt(1, 5),
        interestBike: randInt(1, 5),
        interestEcological: randInt(1, 5),
        suggestions: null,
        status: Math.random() < 0.85 ? "ACTIVE" : "INACTIVE",
        planId: plan.id,
        departmentId: pick(departments).id,
      },
    });
    memberIds.push(member.id);

    // Pagamentos dos últimos 6 meses
    for (let m = 5; m >= 0; m--) {
      const ref = new Date(now.getFullYear(), now.getMonth() - m, 1);
      const refMonth = ref.getMonth() + 1;
      const refYear = ref.getFullYear();
      const dueDate = new Date(Date.UTC(refYear, refMonth - 1, 10));

      let status = "PAGO";
      let paidAt: Date | null = new Date(Date.UTC(refYear, refMonth - 1, randInt(1, 10)));
      if (m === 0) {
        // mês corrente: parte pendente
        if (Math.random() < 0.4) {
          status = "PENDENTE";
          paidAt = null;
        }
      } else if (Math.random() < 0.12) {
        status = "ATRASADO";
        paidAt = null;
      }

      await prisma.payment.create({
        data: {
          memberId: member.id,
          planId: plan.id,
          amount: plan.monthlyPrice,
          referenceMonth: refMonth,
          referenceYear: refYear,
          status,
          dueDate,
          paidAt,
        },
      });
    }
  }

  console.log("🔐 Criando usuário de departamento e associado...");
  const trilhas = departments[0];
  const deptUser = await prisma.user.create({
    data: {
      name: "Coordenador Trilhas",
      email: "trilhas@cef.org.br",
      passwordHash,
      role: "DEPARTAMENTO",
      departments: { create: { departmentId: trilhas.id } },
    },
  });
  // Garante que o coordenador tenha associados visíveis no seu escopo.
  await prisma.member.updateMany({
    where: { id: { in: memberIds.slice(0, 8) } },
    data: { departmentId: trilhas.id },
  });

  // Um associado com login (nível ASSOCIADO) vinculado ao seu cadastro.
  const firstMember = await prisma.member.findUnique({
    where: { id: memberIds[0] },
  });
  if (firstMember) {
    const assocUser = await prisma.user.create({
      data: {
        name: firstMember.fullName,
        email: "associado@cef.org.br",
        passwordHash,
        role: "ASSOCIADO",
      },
    });
    await prisma.member.update({
      where: { id: firstMember.id },
      data: { userId: assocUser.id },
    });
  }
  void deptUser;

  console.log("📅 Criando eventos...");
  const events = await Promise.all([
    prisma.event.create({
      data: {
        name: "Travessia Petrópolis x Teresópolis",
        description:
          "Travessia clássica de 3 dias pelo Parque Nacional da Serra dos Órgãos.",
        dateTime: new Date(2026, 1, 14, 6, 0),
        location: "Parque Nacional da Serra dos Órgãos",
        difficulty: "DIFICIL",
        slots: 20,
        status: "REALIZADO",
      },
    }),
    prisma.event.create({
      data: {
        name: "Trilha Pico da Caledônia",
        description: "Subida ao Pico da Caledônia, um dos cartões-postais de Friburgo.",
        dateTime: new Date(2026, 3, 5, 7, 0),
        location: "Caledônia, Nova Friburgo",
        difficulty: "MODERADO",
        slots: 30,
        status: "REALIZADO",
      },
    }),
    prisma.event.create({
      data: {
        name: "Mutirão Ecológico - Pedra do Cão Sentado",
        description: "Limpeza de trilha e plantio de mudas nativas.",
        dateTime: new Date(2026, 4, 16, 8, 0),
        location: "Pedra do Cão Sentado, Nova Friburgo",
        difficulty: "FACIL",
        slots: 40,
        status: "CONFIRMADO",
      },
    }),
    prisma.event.create({
      data: {
        name: "Curso de Escalada em Rocha - Nível 1",
        description: "Curso introdutório de escalada esportiva com instrutores certificados.",
        dateTime: new Date(2026, 5, 20, 8, 0),
        location: "Setor de Escalada - Três Picos",
        difficulty: "TECNICO",
        slots: 12,
        status: "CONFIRMADO",
      },
    }),
    prisma.event.create({
      data: {
        name: "Acampamento de Inverno - Pedra do Sino",
        description: "Acampamento de 2 dias com pernoite no abrigo da Pedra do Sino.",
        dateTime: new Date(2026, 6, 11, 6, 0),
        location: "Pedra do Sino - PARNASO",
        difficulty: "DIFICIL",
        slots: 15,
        status: "PLANEJADO",
      },
    }),
  ]);

  // Vincula cada evento a um departamento (escopo do nível DEPARTAMENTO)
  for (let e = 0; e < events.length; e++) {
    await prisma.event.update({
      where: { id: events[e].id },
      data: { departmentId: departments[e % departments.length].id },
    });
  }

  console.log("📝 Inscrevendo associados em eventos...");
  for (const event of events) {
    const count = randInt(5, Math.min(event.slots, 18));
    const shuffled = [...memberIds].sort(() => Math.random() - 0.5).slice(0, count);
    for (const memberId of shuffled) {
      await prisma.eventRegistration.create({
        data: { eventId: event.id, memberId },
      });
    }
  }

  console.log("🎂 Configuração de mensagem de aniversário...");
  await prisma.messengerConfig.create({
    data: {
      template:
        "Feliz aniversario, {nome}! O Clube Excursionista de Friburgo deseja muitas trilhas e conquistas neste novo ciclo!",
      enabled: true,
    },
  });

  console.log("📦 Criando patrimônio...");
  const [sede, deposito, campo] = await Promise.all([
    prisma.patrimonioLocal.create({ data: { nome: "Sede CEF", descricao: "Sede principal do CEF em Nova Friburgo" } }),
    prisma.patrimonioLocal.create({ data: { nome: "Depósito", descricao: "Depósito de equipamentos" } }),
    prisma.patrimonioLocal.create({ data: { nome: "Campo", descricao: "Equipamentos em uso em atividades externas" } }),
  ]);

  function codigo(ano: number, seq: number) {
    return `CEF-${ano}-${String(seq).padStart(3, "0")}`;
  }

  const bensDados: Parameters<typeof prisma.patrimonioBem.create>[0]["data"][] = [
    { codigo: codigo(2024, 1), nome: "Corda Semiestática 50m", marca: "Petzl", modelo: "Arial 10.5", categoria: "equipamento", estado: "bom", status: "disponivel", localId: deposito.id, valorAquisicao: 480, dataAquisicao: new Date("2024-02-10"), fornecedor: "Loja do Alpinista" },
    { codigo: codigo(2024, 2), nome: "Corda Dinâmica 60m", marca: "Mammut", modelo: "Crag Classic", categoria: "equipamento", estado: "bom", status: "disponivel", localId: deposito.id, valorAquisicao: 650, dataAquisicao: new Date("2024-03-15") },
    { codigo: codigo(2024, 3), nome: "Capacete de Escalada #1", marca: "Black Diamond", modelo: "Half Dome", numeroSerie: "BD2024-0043", categoria: "equipamento", estado: "otimo", status: "disponivel", localId: deposito.id, valorAquisicao: 320, dataAquisicao: new Date("2024-01-20") },
    { codigo: codigo(2024, 4), nome: "Capacete de Escalada #2", marca: "Black Diamond", modelo: "Half Dome", numeroSerie: "BD2024-0044", categoria: "equipamento", estado: "bom", status: "emprestado", localId: campo.id, valorAquisicao: 320, dataAquisicao: new Date("2024-01-20") },
    { codigo: codigo(2024, 5), nome: "Kit Mosquetões HMS (10 un.)", marca: "Petzl", modelo: "William Ball-Lock", categoria: "equipamento", estado: "bom", status: "disponivel", localId: deposito.id, valorAquisicao: 750, dataAquisicao: new Date("2023-11-05") },
    { codigo: codigo(2024, 6), nome: "Arnês de Escalada #1", marca: "Singing Rock", modelo: "Onyx", categoria: "equipamento", estado: "regular", status: "manutencao", localId: sede.id, valorAquisicao: 280, dataAquisicao: new Date("2022-06-12"), observacoes: "Costura de fixação com desgaste. Enviado para revisão." },
    { codigo: codigo(2024, 7), nome: "Arnês de Escalada #2", marca: "Singing Rock", modelo: "Onyx", categoria: "equipamento", estado: "bom", status: "disponivel", localId: deposito.id, valorAquisicao: 280, dataAquisicao: new Date("2023-04-08") },
    { codigo: codigo(2024, 8), nome: "Barraca Expedition 4 lugares", marca: "Mountain Hardwear", modelo: "EV 4", categoria: "equipamento", estado: "bom", status: "disponivel", localId: deposito.id, valorAquisicao: 1850, dataAquisicao: new Date("2023-07-20") },
    { codigo: codigo(2024, 9), nome: "Barraca Camping 2 lugares", marca: "Quechua", modelo: "MH100 Ultra", categoria: "equipamento", estado: "bom", status: "disponivel", localId: deposito.id, valorAquisicao: 390, dataAquisicao: new Date("2024-04-01") },
    { codigo: codigo(2024, 10), nome: "Kit Primeiros Socorros", categoria: "equipamento", estado: "bom", status: "disponivel", localId: sede.id, valorAquisicao: 180, dataAquisicao: new Date("2024-01-05"), observacoes: "Verificar validade dos medicamentos semestralmente." },
    { codigo: codigo(2024, 11), nome: "Rádio Comunicador (par)", marca: "Motorola", modelo: "T400", categoria: "eletronico", estado: "bom", status: "disponivel", localId: sede.id, valorAquisicao: 420, dataAquisicao: new Date("2023-09-15"), vidaUtilAnos: 5, valorResidual: 50 },
    { codigo: codigo(2024, 12), nome: "GPS de Navegação", marca: "Garmin", modelo: "eTrex 32x", numeroSerie: "GMN-2024-7741", categoria: "eletronico", estado: "otimo", status: "emprestado", localId: campo.id, valorAquisicao: 890, dataAquisicao: new Date("2024-02-28"), vidaUtilAnos: 7, valorResidual: 100 },
    { codigo: codigo(2024, 13), nome: "Projetor Multimídia", marca: "Epson", modelo: "S41+", numeroSerie: "EPS-2023-1188", categoria: "eletronico", estado: "bom", status: "disponivel", localId: sede.id, valorAquisicao: 1200, dataAquisicao: new Date("2023-03-10"), vidaUtilAnos: 6, valorResidual: 200 },
    { codigo: codigo(2024, 14), nome: "Notebook Dell", marca: "Dell", modelo: "Inspiron 15", numeroSerie: "DL2023-44821", categoria: "eletronico", estado: "bom", status: "em_uso", localId: sede.id, valorAquisicao: 2800, dataAquisicao: new Date("2023-06-01"), vidaUtilAnos: 4, valorResidual: 400 },
    { codigo: codigo(2024, 15), nome: "Mesa de Reunião 8 lugares", marca: "Tok&Stok", categoria: "movel_utensilio", estado: "bom", status: "em_uso", localId: sede.id, valorAquisicao: 950, dataAquisicao: new Date("2020-08-15"), vidaUtilAnos: 10, valorResidual: 100 },
    { codigo: codigo(2024, 16), nome: "Cadeiras Empilháveis (8 un.)", categoria: "movel_utensilio", estado: "bom", status: "em_uso", localId: sede.id, valorAquisicao: 640, dataAquisicao: new Date("2020-08-15"), vidaUtilAnos: 10, valorResidual: 80 },
    { codigo: codigo(2024, 17), nome: "Armário de Equipamentos", descricao: "Armário metálico com 4 compartimentos para EPIs", categoria: "movel_utensilio", estado: "bom", status: "em_uso", localId: deposito.id, valorAquisicao: 780, dataAquisicao: new Date("2021-05-20"), vidaUtilAnos: 15, valorResidual: 100 },
    { codigo: codigo(2024, 18), nome: "Fogão Camping 2 bocas", marca: "Brasfort", categoria: "movel_utensilio", estado: "bom", status: "disponivel", localId: deposito.id, valorAquisicao: 220, dataAquisicao: new Date("2023-10-05") },
    { codigo: codigo(2023, 1), nome: "Caixa de Som Portátil", marca: "JBL", modelo: "Charge 5", numeroSerie: "JBL-2023-9902", categoria: "eletronico", estado: "danificado", status: "baixado", localId: sede.id, valorAquisicao: 780, dataAquisicao: new Date("2023-01-10"), observacoes: "Entrada de carregamento danificada por água. Descartado." },
  ];

  for (const data of bensDados) {
    const bem = await prisma.patrimonioBem.create({ data });
    await prisma.patrimonioMovimentacao.create({
      data: { bemId: bem.id, tipo: "entrada", data: (data.dataAquisicao as Date) ?? new Date(), localDestinoId: data.localId as string ?? null, observacoes: "Cadastro inicial do bem." },
    });
    if (data.status === "manutencao") {
      await prisma.patrimonioMovimentacao.create({ data: { bemId: bem.id, tipo: "manutencao", data: new Date("2026-06-01"), localOrigemId: deposito.id, observacoes: "Enviado para manutenção." } });
    }
    if (data.status === "emprestado") {
      await prisma.patrimonioMovimentacao.create({ data: { bemId: bem.id, tipo: "emprestimo", data: new Date("2026-06-10"), localOrigemId: deposito.id, localDestinoId: campo.id, dataDevolucaoPrevista: new Date("2026-06-30"), observacoes: "Emprestado para atividade de campo." } });
    }
    if (data.status === "baixado") {
      await prisma.patrimonioMovimentacao.create({ data: { bemId: bem.id, tipo: "baixa", data: new Date("2026-06-05"), observacoes: "Bem danificado além do reparo. Descartado." } });
    }
  }

  // ─── Biblioteca ──────────────────────────────────────────────────────────
  console.log("📚 Criando biblioteca...");

  const [catMont, catTrek, catNat, catAv, catPrim, catFoto, catOut] = await Promise.all([
    prisma.bibliotecaCategoria.create({ data: { nome: "Montanhismo e Escalada", descricao: "Técnicas, história e relatos de montanhismo" } }),
    prisma.bibliotecaCategoria.create({ data: { nome: "Trekking e Caminhada", descricao: "Guias e roteiros de trilhas" } }),
    prisma.bibliotecaCategoria.create({ data: { nome: "Natureza e Meio Ambiente", descricao: "Ecologia, flora e fauna" } }),
    prisma.bibliotecaCategoria.create({ data: { nome: "Aventura e Exploração", descricao: "Relatos de expedições e aventuras" } }),
    prisma.bibliotecaCategoria.create({ data: { nome: "Primeiros Socorros", descricao: "Emergências em campo" } }),
    prisma.bibliotecaCategoria.create({ data: { nome: "Fotografia de Natureza", descricao: "Técnicas fotográficas em ambiente externo" } }),
    prisma.bibliotecaCategoria.create({ data: { nome: "Outros", descricao: "Demais títulos" } }),
  ]);

  const anoAtual = 2026;
  const livros = [
    { titulo: "Oitomilistas", autor: "Reinhold Messner", editora: "Martins Fontes", anoPublicacao: 1989, categoriaId: catMont.id, estado: "bom", origem: "proprio", numeroTombo: `CEF-LIV-${anoAtual}-001`, descricao: "Relato das conquistas dos 14 picos acima de 8000m por Messner." },
    { titulo: "Annapurna", autor: "Maurice Herzog", editora: "Record", anoPublicacao: 1952, categoriaId: catMont.id, estado: "regular", origem: "proprio", numeroTombo: `CEF-LIV-${anoAtual}-002`, descricao: "A primeira conquista de um pico acima de 8000m." },
    { titulo: "Into Thin Air", autor: "Jon Krakauer", editora: "Anchor Books", anoPublicacao: 1997, categoriaId: catMont.id, estado: "otimo", origem: "doacao", doadorNome: "Paulo Moutinho", numeroTombo: `CEF-LIV-${anoAtual}-003` },
    { titulo: "Guia de Trilhas da Serra dos Órgãos", autor: "Roberto Verdan", editora: "Editora Serra", anoPublicacao: 2018, categoriaId: catTrek.id, estado: "bom", origem: "proprio", numeroTombo: `CEF-LIV-${anoAtual}-004` },
    { titulo: "Trilhas do Rio de Janeiro", autor: "Marcus Buendia", editora: "Qualitymark", anoPublicacao: 2015, categoriaId: catTrek.id, estado: "bom", origem: "proprio", numeroTombo: `CEF-LIV-${anoAtual}-005` },
    { titulo: "A Mata Atlântica", autor: "Carlos Joly", editora: "Audubon", anoPublicacao: 2011, categoriaId: catNat.id, estado: "otimo", origem: "doacao", doadorNome: "Fernanda Lopes", numeroTombo: `CEF-LIV-${anoAtual}-006` },
    { titulo: "Fotografia na Natureza", autor: "John Shaw", editora: "Bookman", anoPublicacao: 2000, categoriaId: catFoto.id, estado: "regular", origem: "proprio", numeroTombo: `CEF-LIV-${anoAtual}-007` },
    { titulo: "Primeiros Socorros em Campo", autor: "Warren Bowman", editora: "Wilderness Medical Society", anoPublicacao: 2009, categoriaId: catPrim.id, estado: "bom", origem: "proprio", numeroTombo: `CEF-LIV-${anoAtual}-008` },
    { titulo: "O Chamado da Natureza", autor: "Jack London", editora: "Martin Claret", anoPublicacao: 1903, categoriaId: catAv.id, estado: "bom", origem: "proprio", numeroTombo: `CEF-LIV-${anoAtual}-009` },
    { titulo: "Escalada — Técnicas Avançadas", autor: "John Long", editora: "Falcon Guides", anoPublicacao: 2004, categoriaId: catMont.id, estado: "otimo", origem: "proprio", disponivel: false, numeroTombo: `CEF-LIV-${anoAtual}-010` },
  ];

  const livrosCriados = await Promise.all(
    livros.map((l) => prisma.bibliotecaLivro.create({ data: l }))
  );

  // Empréstimo ativo no livro 10 (disponivel: false)
  const membro = memberIds[0] ? await prisma.member.findUnique({ where: { id: memberIds[0] } }) : null;
  if (membro) {
    await prisma.bibliotecaEmprestimo.create({
      data: {
        livroId: livrosCriados[9].id,
        socioId: membro.id,
        retiradoEm: new Date("2026-06-01"),
        prazoDevolucao: new Date("2026-07-01"),
        estadoRetirada: "otimo",
        status: "ativo",
        observacoes: "Empréstimo para estudo de técnicas de escalada.",
      },
    });
  }

  console.log(`  ✅ ${livrosCriados.length} livros criados, 7 categorias`);

  console.log("✅ Seed concluído!");
  console.log(`   ADMIN        admin@cef.org.br     / ${SEED_PASSWORD}`);
  console.log(`   ADMIN        dario@wedesign.com.br / ${SEED_PASSWORD}`);
  console.log(`   DEPARTAMENTO trilhas@cef.org.br   / ${SEED_PASSWORD}`);
  console.log(`   ASSOCIADO    associado@cef.org.br / ${SEED_PASSWORD}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
