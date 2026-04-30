/**
 * Utilitários de CPF.
 * - normalize(): mantém apenas dígitos.
 * - format(): aplica máscara visual 000.000.000-00.
 * - isValid(): valida matematicamente os dois dígitos verificadores.
 *
 * Implementação clássica do algoritmo da Receita Federal:
 *   - 11 dígitos numéricos
 *   - rejeita sequências repetidas (000..., 111..., ..., 999...)
 *   - DV1 = mod11(soma(d[i]*(10-i)) for i in 0..8)
 *   - DV2 = mod11(soma(d[i]*(11-i)) for i in 0..9)
 */

export function normalizeCpf(value: string): string {
  return (value || "").replace(/\D+/g, "");
}

export function formatCpf(value: string): string {
  const d = normalizeCpf(value).slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9, 11)}`;
}

function checkDigit(digits: number[], factorStart: number): number {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    sum += digits[i] * (factorStart - i);
  }
  const rest = (sum * 10) % 11;
  return rest === 10 ? 0 : rest;
}

export function isValidCpf(input: string): boolean {
  const cpf = normalizeCpf(input);
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false; // todos iguais

  const digits = cpf.split("").map((c) => Number.parseInt(c, 10));
  const dv1 = checkDigit(digits.slice(0, 9), 10);
  if (dv1 !== digits[9]) return false;
  const dv2 = checkDigit(digits.slice(0, 10), 11);
  if (dv2 !== digits[10]) return false;
  return true;
}