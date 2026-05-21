/**
 * Cria (ou atualiza) a classe GenericClass no Google Wallet.
 * Execute UMA VEZ após configurar as variáveis de ambiente:
 *
 *   npx tsx --env-file=.env scripts/create-google-wallet-class.ts
 */
import jwt from "jsonwebtoken";

const issuerId = process.env.GOOGLE_WALLET_ISSUER_ID;
const classSuffix = process.env.GOOGLE_WALLET_CLASS_SUFFIX ?? "cef-carteirinha";
const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const serviceAccountKeyB64 = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;

if (!issuerId || !serviceAccountEmail || !serviceAccountKeyB64) {
  console.error(
    "❌  Variáveis ausentes. Certifique-se de que o .env contém:\n" +
      "   GOOGLE_WALLET_ISSUER_ID\n" +
      "   GOOGLE_SERVICE_ACCOUNT_EMAIL\n" +
      "   GOOGLE_SERVICE_ACCOUNT_KEY",
  );
  process.exit(1);
}

const serviceAccountKey = Buffer.from(serviceAccountKeyB64, "base64").toString("utf-8");
const classId = `${issuerId}.${classSuffix}`;

async function getAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const jwtPayload = {
    iss: serviceAccountEmail,
    sub: serviceAccountEmail,
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
    scope: "https://www.googleapis.com/auth/wallet_object.issuer",
  };

  const signedJwt = jwt.sign(jwtPayload, serviceAccountKey, { algorithm: "RS256" });

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: signedJwt,
    }),
  });

  const data = (await res.json()) as { access_token?: string; error?: string };
  if (!data.access_token) {
    throw new Error(`Falha ao obter token: ${JSON.stringify(data)}`);
  }
  return data.access_token;
}

async function main() {
  console.log("🔑  Obtendo token de acesso…");
  const token = await getAccessToken();
  console.log("✅  Token obtido.");

  const genericClass = {
    id: classId,
    classTemplateInfo: {
      cardTemplateOverride: {
        cardRowTemplateInfos: [
          {
            twoItems: {
              startItem: {
                firstValue: {
                  fields: [{ fieldPath: "object.textModulesData['membership']" }],
                },
              },
              endItem: {
                firstValue: {
                  fields: [{ fieldPath: "object.textModulesData['plan']" }],
                },
              },
            },
          },
          {
            twoItems: {
              startItem: {
                firstValue: {
                  fields: [{ fieldPath: "object.textModulesData['validity']" }],
                },
              },
              endItem: {
                firstValue: {
                  fields: [{ fieldPath: "object.textModulesData['cpf']" }],
                },
              },
            },
          },
        ],
      },
    },
  };

  // Tenta GET primeiro — se já existe, faz PATCH
  const getRes = await fetch(
    `https://walletobjects.googleapis.com/walletobjects/v1/genericClass/${classId}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );

  if (getRes.ok) {
    console.log(`ℹ️   Classe "${classId}" já existe — atualizando…`);
    const patchRes = await fetch(
      `https://walletobjects.googleapis.com/walletobjects/v1/genericClass/${classId}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(genericClass),
      },
    );
    const result = await patchRes.json();
    console.log("✅  Classe atualizada:", JSON.stringify(result, null, 2));
  } else {
    console.log(`➕  Criando classe "${classId}"…`);
    const postRes = await fetch(
      "https://walletobjects.googleapis.com/walletobjects/v1/genericClass",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(genericClass),
      },
    );
    const result = await postRes.json();
    if (postRes.ok) {
      console.log("✅  Classe criada com sucesso!");
      console.log("   classId:", classId);
    } else {
      console.error("❌  Erro ao criar classe:", JSON.stringify(result, null, 2));
      process.exit(1);
    }
  }
}

main().catch((err) => {
  console.error("❌  Erro:", err);
  process.exit(1);
});
