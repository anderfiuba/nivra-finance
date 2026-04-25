export type PendingType =
  | "sem_categoria"
  | "transferencia_suspeita"
  | "recorrencia_detectada"
  | "inconsistencia";

export interface Transaction {
  id: string;
  date: string;
  description: string;
  category: string;
  account: string;
  value: number;
  type: "entrada" | "saida";
  pendingType?: PendingType;
  confidence?: number;
  suggestedCategory?: string;
  recurrenceGroup?: string;
  /** Valor original quando a transação foi feita em moeda estrangeira. */
  originalAmount?: number;
  /** Código da moeda original (ex.: USD) quando difere da moeda da conta. */
  originalCurrency?: string;
}

export const CATEGORIES = [
  "Moradia",
  "Alimentação",
  "Transporte",
  "Compras",
  "Assinaturas",
  "Saúde",
  "Lazer",
  "Educação",
  "Investimentos",
  "Salário",
  "Freelance",
  "Transferências",
  "Outros",
] as const;

export interface Account {
  id: string;
  bank: string;
  type: string;
  balance: number;
  status: string;
  lastSync: string;
  color: string;
}

export const accounts: Account[] = [];

export const transactions: Transaction[] = [];

export const balanceEvolution: { month: string; saldo: number }[] = [];

export const incomeVsExpense: { month: string; receita: number; despesa: number }[] = [];

export const CATEGORY_COLORS: Record<string, string> = {
  "Moradia": "hsl(214 95% 62%)",
  "Alimentação": "hsl(42 86% 62%)",
  "Transporte": "hsl(152 65% 48%)",
  "Compras": "hsl(280 70% 60%)",
  "Saúde": "hsl(0 75% 60%)",
  "Assinaturas": "hsl(180 70% 50%)",
  "Lazer": "hsl(330 70% 60%)",
  "Educação": "hsl(200 80% 55%)",
  "Investimentos": "hsl(140 60% 50%)",
  "Salário": "hsl(160 70% 45%)",
  "Freelance": "hsl(50 80% 55%)",
  "Transferências": "hsl(220 10% 55%)",
  "Outros": "hsl(220 10% 45%)",
};

export const aiInsights: { type: string; title: string; description: string }[] = [];

export const connections: { id: string; bank: string; status: string; lastSync: string; scopes: string[] }[] = [];
