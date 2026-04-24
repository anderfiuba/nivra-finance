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

export const accounts = [
  { id: "1", bank: "Itaú", type: "Conta Corrente", balance: 18420.55, status: "ativa", lastSync: "há 2 minutos", color: "#EC7000" },
  { id: "2", bank: "Nubank", type: "Conta Corrente", balance: 4890.12, status: "ativa", lastSync: "há 5 minutos", color: "#820AD1" },
  { id: "3", bank: "Bradesco", type: "Poupança", balance: 32150.00, status: "ativa", lastSync: "há 18 minutos", color: "#CC092F" },
  { id: "4", bank: "Inter", type: "Conta Corrente", balance: 2305.78, status: "pendente", lastSync: "há 3 horas", color: "#FF7A00" },
  { id: "5", bank: "BTG Pactual", type: "Investimento", balance: 87420.10, status: "ativa", lastSync: "há 12 minutos", color: "#003366" },
];

export const transactions: Transaction[] = [
  { id: "t1", date: "2025-04-22", description: "Salário Empresa XYZ", category: "Salário", account: "Itaú", value: 12500, type: "entrada" },
  { id: "t2", date: "2025-04-22", description: "Aluguel Apartamento", category: "Moradia", account: "Itaú", value: -3200, type: "saida" },
  { id: "t3", date: "2025-04-21", description: "iFood - Restaurante Sushi", category: "Alimentação", account: "Nubank", value: -148.90, type: "saida" },
  { id: "t4", date: "2025-04-21", description: "Uber - Trajeto", category: "Transporte", account: "Nubank", value: -32.50, type: "saida" },
  { id: "t5", date: "2025-04-20", description: "Netflix Assinatura", category: "Assinaturas", account: "Itaú", value: -55.90, type: "saida", pendingType: "recorrencia_detectada", confidence: 0.94, recurrenceGroup: "netflix" },
  { id: "t6", date: "2025-04-20", description: "Spotify Premium", category: "Assinaturas", account: "Nubank", value: -21.90, type: "saida", pendingType: "recorrencia_detectada", confidence: 0.96, recurrenceGroup: "spotify" },
  { id: "t7", date: "2025-04-19", description: "Mercado Pago - Recebimento", category: "Freelance", account: "Nubank", value: 2400, type: "entrada" },
  { id: "t8", date: "2025-04-19", description: "Posto Shell - Combustível", category: "Transporte", account: "Itaú", value: -280.00, type: "saida" },
  { id: "t9", date: "2025-04-18", description: "Amazon - Eletrônicos", category: "Outros", account: "Nubank", value: -1290.00, type: "saida", pendingType: "inconsistencia", confidence: 0.42, suggestedCategory: "Compras" },
  { id: "t10", date: "2025-04-18", description: "Academia Bluefit", category: "Saúde", account: "Itaú", value: -129.90, type: "saida" },
  { id: "t11", date: "2025-04-17", description: "Supermercado Pão de Açúcar", category: "Alimentação", account: "Itaú", value: -642.30, type: "saida" },
  { id: "t12", date: "2025-04-16", description: "TED recebida — Itaú → Bradesco", category: "Outros", account: "Bradesco", value: 800, type: "entrada", pendingType: "transferencia_suspeita", confidence: 0.88 },
  { id: "t13", date: "2025-04-15", description: "Conta de Luz Enel", category: "Moradia", account: "Itaú", value: -312.45, type: "saida" },
  { id: "t14", date: "2025-04-15", description: "Internet Vivo Fibra", category: "Moradia", account: "Itaú", value: -149.90, type: "saida" },
  { id: "t15", date: "2025-04-14", description: "Farmácia Drogasil", category: "Saúde", account: "Nubank", value: -86.50, type: "saida" },
  // Pendências adicionais sem categoria
  { id: "t16", date: "2025-04-13", description: "PIX — João Mendes", category: "", account: "Nubank", value: -240.00, type: "saida", pendingType: "sem_categoria", confidence: 0.1 },
  { id: "t17", date: "2025-04-12", description: "Compra cartão débito 9821", category: "", account: "Itaú", value: -78.40, type: "saida", pendingType: "sem_categoria", confidence: 0.15 },
  { id: "t18", date: "2025-04-11", description: "TED enviada — Bradesco → BTG", category: "Transferências", account: "Bradesco", value: -1500.00, type: "saida", pendingType: "transferencia_suspeita", confidence: 0.91 },
  { id: "t19", date: "2025-04-10", description: "Cinemark BarraShopping", category: "Outros", account: "Nubank", value: -68.00, type: "saida", pendingType: "inconsistencia", confidence: 0.38, suggestedCategory: "Lazer" },
  { id: "t20", date: "2025-04-09", description: "Estacionamento Shopping", category: "", account: "Itaú", value: -22.00, type: "saida", pendingType: "sem_categoria", confidence: 0.12 },
];

export const balanceEvolution = [
  { month: "Nov", saldo: 98400 },
  { month: "Dez", saldo: 112300 },
  { month: "Jan", saldo: 108900 },
  { month: "Fev", saldo: 124500 },
  { month: "Mar", saldo: 132800 },
  { month: "Abr", saldo: 145186 },
];

export const incomeVsExpense = [
  { month: "Nov", receita: 14200, despesa: 9800 },
  { month: "Dez", receita: 18500, despesa: 11200 },
  { month: "Jan", receita: 14900, despesa: 12800 },
  { month: "Fev", receita: 17200, despesa: 10400 },
  { month: "Mar", receita: 15800, despesa: 9100 },
  { month: "Abr", receita: 14900, despesa: 6450 },
];

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

export const aiInsights = [
  { type: "alerta", title: "Aumento de 38% em Compras este mês", description: "Você gastou R$ 1.290 em Compras vs R$ 935 na média dos últimos 3 meses. A maior parte concentrada na Amazon." },
  { type: "recorrencia", title: "5 assinaturas recorrentes detectadas", description: "Netflix, Spotify, iCloud, Amazon Prime e Apple One somam R$ 187/mês — R$ 2.244/ano em assinaturas." },
  { type: "oportunidade", title: "Concentração de gastos em Alimentação", description: "62% dos gastos com alimentação foram em delivery. Avaliar refeições em casa pode liberar até R$ 480/mês." },
  { type: "positivo", title: "Saldo em crescimento consistente", description: "Seu saldo consolidado cresceu 47% nos últimos 6 meses. Ritmo saudável de capitalização mensal." },
];

export const connections = [
  { id: "c1", bank: "Itaú", status: "conectado", lastSync: "há 2 minutos", scopes: ["Saldo", "Extrato", "Cartões"] },
  { id: "c2", bank: "Nubank", status: "conectado", lastSync: "há 5 minutos", scopes: ["Saldo", "Extrato", "Cartões"] },
  { id: "c3", bank: "Bradesco", status: "conectado", lastSync: "há 18 minutos", scopes: ["Saldo", "Extrato"] },
  { id: "c4", bank: "Inter", status: "reautenticar", lastSync: "há 3 horas", scopes: ["Saldo", "Extrato"] },
  { id: "c5", bank: "BTG Pactual", status: "conectado", lastSync: "há 12 minutos", scopes: ["Saldo", "Investimentos"] },
];
