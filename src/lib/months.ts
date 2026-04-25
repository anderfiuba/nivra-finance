const MONTHS_PT_SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export interface MonthBucket {
  /** "YYYY-MM" — chave estável para comparações. */
  key: string;
  /** Label curto: "abr 26". */
  label: string;
  /** Label longo: "Abril de 2026". */
  longLabel: string;
  year: number;
  /** 0-11 (igual a Date.getMonth). */
  month: number;
  /** Início do mês (00:00). */
  start: Date;
  /** Fim do mês (23:59:59.999). */
  end: Date;
}

function pad2(n: number) {
  return n.toString().padStart(2, "0");
}

function buildBucket(year: number, month: number): MonthBucket {
  const start = new Date(year, month, 1, 0, 0, 0, 0);
  const end = new Date(year, month + 1, 0, 23, 59, 59, 999);
  const yy = String(year).slice(2);
  return {
    key: `${year}-${pad2(month + 1)}`,
    label: `${MONTHS_PT_SHORT[month]} ${yy}`,
    longLabel: `${MONTHS_PT_SHORT[month][0].toUpperCase()}${MONTHS_PT_SHORT[month].slice(1)} de ${year}`,
    year,
    month,
    start,
    end,
  };
}

/** Lista os últimos N meses (mais recente primeiro), incluindo o mês de `ref`. */
export function lastNMonths(n: number, ref: Date = new Date()): MonthBucket[] {
  const list: MonthBucket[] = [];
  const baseY = ref.getFullYear();
  const baseM = ref.getMonth();
  for (let i = 0; i < n; i++) {
    const m = baseM - i;
    const y = baseY + Math.floor(m / 12);
    const month = ((m % 12) + 12) % 12;
    list.push(buildBucket(y, month));
  }
  return list;
}

/** "YYYY-MM" a partir de um ISO string da Pluggy/Postgres. */
export function monthKeyOf(iso: string): string {
  // Mantém timezone local — o filtro do Extrato é pelo mês civil do usuário.
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

/** Retorna o bucket atual (mês corrente). */
export function currentMonthBucket(ref: Date = new Date()): MonthBucket {
  return buildBucket(ref.getFullYear(), ref.getMonth());
}

/** Bucket a partir de uma chave "YYYY-MM"; null se inválida. */
export function monthBucketFromKey(key: string): MonthBucket | null {
  const m = /^(\d{4})-(\d{2})$/.exec(key);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  if (mo < 0 || mo > 11) return null;
  return buildBucket(y, mo);
}