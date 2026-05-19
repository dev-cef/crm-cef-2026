import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { generateCpf } from "../lib/cpf";

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
  await prisma.birthdayMessageLog.deleteMany();
  await prisma.birthdayMessageConfig.deleteMany();
  await prisma.eventRegistration.deleteMany();
  await prisma.eventPhoto.deleteMany();
  await prisma.event.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.member.deleteMany();
  await prisma.plan.deleteMany();
  await prisma.user.deleteMany();

  console.log("👤 Criando administradores...");
  const passwordHash = await bcrypt.hash("senha123", 10);
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
  await prisma.birthdayMessageConfig.create({
    data: {
      template:
        "Feliz aniversario, {nome}! O Clube Excursionista de Friburgo deseja muitas trilhas e conquistas neste novo ciclo!",
      enabled: true,
    },
  });

  console.log("✅ Seed concluído!");
  console.log("   Login: admin@cef.org.br / senha123");
  console.log("   Login: dario@wedesign.com.br / senha123");
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
