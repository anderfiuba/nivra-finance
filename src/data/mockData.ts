export const accounts = [
  { id: "1", bank: "Itaú", type: "Conta Corrente", balance: 18420.55, status: "ativa", lastSync: "há 2 minutos", color: "#EC7000" },
  { id: "2", bank: "Nubank", type: "Conta Corrente", balance: 4890.12, status: "ativa", lastSync: "há 5 minutos", color: "#820AD1" },
  { id: "3", bank: "Bradesco", type: "Poupança", balance: 32150.00, status: "ativa", lastSync: "há 18 minutos", color: "#CC092F" },
  { id: "4", bank: "Inter", type: "Conta Corrente", balance: 2305.78, status: "pendente", lastSync: "há 3 horas", color: "#FF7A00" },
  { id: "5", bank: "BTG Pactual", type: "Investimento", balance: 87420.10, status: "ativa", lastSync: "há 12 minutos", color: "#003366" },
];

export const transactions = [
  { id: "t1", date: "2025-04-22", description: "Salário Empresa XYZ", category: "Salário", account: "Itaú", value: 12500, type: "entrada" },
  { id: "t2", date: "2025-04-22", description: "Aluguel Apartamento", category: "Moradia", account: "Itaú", value: -3200, type: "saida" },
  { id: "t3", date: "2025-04-21", description: "iFood - Restaurante Sushi", category: "Alimentação", account: "Nubank", value: -148.90, type: "saida" },
  { id: "t4", date: "2025-04-21", description: "Uber - Trajeto", category: "Transporte", account: "Nubank", value: -32.50, type: "saida" },
  { id: "t5", date: "2025-04-20", description: "Netflix Assinatura", category: "Assinaturas", account: "Itaú", value: -55.90, type: "saida" },
  { id: "t6", date: "2025-04-20", description: "Spotify Premium", category: "Assinaturas", account: "Nubank", value: -21.90, type: "saida" },
  { id: "t7", date: "2025-04-19", description: "Mercado Pago - Recebimento", category: "Freelance", account: "Nubank", value: 2400, type: "entrada" },
  { id: "t8", date: "2025-04-19", description: "Posto Shell - Combustível", category: "Transporte", account: "Itaú", value: -280.00, type: "saida" },
  { id: "t9", date: "2025-04-18", description: "Amazon - Eletrônicos", category: "Compras", account: "Nubank", value: -1290.00, type: "saida" },
  { id: "t10", date: "2025-04-18", description: "Academia Bluefit", category: "Saúde", account: "Itaú", value: -129.90, type: "saida" },
  { id: "t11", date: "2025-04-17", description: "Supermercado Pão de Açúcar", category: "Alimentação", account: "Itaú", value: -642.30, type: "saida" },
  { id: "t12", date: "2025-04-16", description: "Transferência recebida", category: "Outros", account: "Bradesco", value: 800, type: "entrada" },
  { id: "t13", date: "2025-04-15", description: "Conta de Luz Enel", category: "Moradia", account: "Itaú", value: -312.45, type: "saida" },
  { id: "t14", date: "2025-04-15", description: "Internet Vivo Fibra", category: "Moradia", account: "Itaú", value: -149.90, type: "saida" },
  { id: "t15", date: "2025-04-14", description: "Farmácia Drogasil", category: "Saúde", account: "Nubank", value: -86.50, type: "saida" },
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

export const expensesByCategory = [
  { name: "Moradia", value: 3662, color: "hsl(214 95% 62%)" },
  { name: "Alimentação", value: 791, color: "hsl(42 86% 62%)" },
  { name: "Transporte", value: 312, color: "hsl(152 65% 48%)" },
  { name: "Compras", value: 1290, color: "hsl(280 70% 60%)" },
  { name: "Saúde", value: 216, color: "hsl(0 75% 60%)" },
  { name: "Assinaturas", value: 77, color: "hsl(180 70% 50%)" },
];

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
