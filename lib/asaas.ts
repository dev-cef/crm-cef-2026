const API_KEY = process.env.ASAAS_API_KEY;
const ENV = process.env.ASAAS_ENV; // "sandbox" | "production"
const BASE_URL =
  ENV === "production"
    ? "https://api.asaas.com/v3"
    : "https://sandbox.asaas.com/api/v3";

export function asaasConfigured(): boolean {
  return !!(API_KEY && ENV);
}

async function asaasFetch<T>(path: string, init?: RequestInit): Promise<T> {
  if (!asaasConfigured()) {
    throw new Error("Asaas não configurado (ASAAS_API_KEY / ASAAS_ENV).");
  }
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      access_token: API_KEY!,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Asaas ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

export async function asaasFindCustomerByCpf(
  cpfDigits: string,
): Promise<{ id: string } | null> {
  const data = await asaasFetch<{ data: { id: string }[] }>(
    `/customers?cpfCnpj=${cpfDigits}`,
  );
  return data.data[0] ?? null;
}

export async function asaasCreateCustomer(data: {
  name: string;
  cpfCnpj: string;
  email: string;
  phone: string;
}): Promise<{ id: string }> {
  return asaasFetch<{ id: string }>("/customers", {
    method: "POST",
    body: JSON.stringify({
      name: data.name,
      cpfCnpj: data.cpfCnpj,
      email: data.email,
      mobilePhone: data.phone.replace(/\D/g, ""),
    }),
  });
}

export async function asaasCreatePixCharge(data: {
  customer: string;
  value: number;
  dueDate: string; // YYYY-MM-DD
  externalReference: string;
  description: string;
}): Promise<{ id: string }> {
  return asaasFetch<{ id: string }>("/payments", {
    method: "POST",
    body: JSON.stringify({
      customer: data.customer,
      billingType: "PIX",
      value: data.value,
      dueDate: data.dueDate,
      description: data.description,
      externalReference: data.externalReference,
    }),
  });
}

export async function asaasGetPixQrCode(chargeId: string): Promise<{
  encodedImage: string;
  payload: string;
  expirationDate: string;
}> {
  return asaasFetch(`/payments/${chargeId}/pixQrCode`);
}

// Best-effort — chamado antes de excluir/invalidar uma cobrança local; falha não deve bloquear a ação local.
export async function asaasCancelCharge(chargeId: string): Promise<void> {
  await asaasFetch(`/payments/${chargeId}`, { method: "DELETE" });
}
