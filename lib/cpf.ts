export function stripCpf(cpf: string): string {
  return cpf.replace(/\D/g, "");
}

export function isValidCpf(cpf: string): boolean {
  const digits = stripCpf(cpf);
  if (digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false;

  const calcCheck = (len: number): number => {
    let sum = 0;
    for (let i = 0; i < len; i++) {
      sum += parseInt(digits[i], 10) * (len + 1 - i);
    }
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };

  return (
    calcCheck(9) === parseInt(digits[9], 10) &&
    calcCheck(10) === parseInt(digits[10], 10)
  );
}

export function formatCpf(cpf: string): string {
  const d = stripCpf(cpf).padStart(11, "0").slice(0, 11);
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9, 11)}`;
}

// 999.***.***-99 — usado na carteirinha
export function maskCpf(cpf: string): string {
  const d = stripCpf(cpf).padStart(11, "0").slice(0, 11);
  return `${d.slice(0, 3)}.***.***-${d.slice(9, 11)}`;
}

// Gera um CPF válido (apenas para seed de dados de teste)
export function generateCpf(): string {
  const n = () => Math.floor(Math.random() * 9);
  const base = Array.from({ length: 9 }, n);

  const check = (arr: number[]): number => {
    let sum = 0;
    const len = arr.length;
    for (let i = 0; i < len; i++) {
      sum += arr[i] * (len + 1 - i);
    }
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };

  const d1 = check(base);
  const d2 = check([...base, d1]);
  return [...base, d1, d2].join("");
}
