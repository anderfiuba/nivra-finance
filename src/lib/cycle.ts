const MONTHS_PT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export interface CycleRange {
  start: Date;
  end: Date;
}

/**
 * Quantos dias um determinado (ano, mês 0-indexado) tem.
 * Truque clássico: dia 0 do mês seguinte = último dia do mês atual.
 */
function daysInMonth(year: number, monthZeroIndexed: number): number {
  return new Date(year, monthZeroIndexed + 1, 0).getDate();
}

/**
 * Normaliza o dia preferido do usuário (ex.: 31) para o último dia válido
 * de um mês específico. Ex.: 31 em fevereiro → 28 (ou 29 em ano bissexto);
 * 30 em fevereiro → 28/29; 31 em abril → 30.
 */
export function normalizeCycleDayForMonth(
  preferredDay: number,
  year: number,
  monthZeroIndexed: number,
): number {
  const safe = Math.max(1, Math.min(31, Math.floor(preferredDay)));
  return Math.min(safe, daysInMonth(year, monthZeroIndexed));
}

/**
 * Calcula o intervalo do "mês financeiro" do usuário com base no dia de
 * fechamento PREFERIDO. O valor preferido (1–31) é preservado como referência;
 * a normalização para o último dia válido acontece dinamicamente em cada mês.
 *
 *   cycleDay=8  e ref dentro de abril/2026 → 09/mar a 08/abr
 *   cycleDay=31 e ref em fev/2025 (não-bissexto) → 01/fev a 28/fev
 *   cycleDay=31 e ref em fev/2024 (bissexto)     → 01/fev a 29/fev
 *   cycleDay=31 e ref em abril (30 dias)         → 01/abr a 30/abr
 *   cycleDay=30 e ref em fev/2025                → 01/fev a 28/fev
 *
 * Quando o end é "encurtado" (ex.: 28/fev), o start permanece sendo o dia
 * SEGUINTE ao end do ciclo anterior — preservando continuidade temporal.
 */
export function getCycleRange(cycleDay: number, ref: Date = new Date()): CycleRange {
  const preferred = Math.max(1, Math.min(31, Math.floor(cycleDay)));
  const refY = ref.getFullYear();
  const refM = ref.getMonth();
  const refD = ref.getDate();

  // Dia "alvo" no mês de referência (já normalizado para esse mês).
  const dayInRefMonth = normalizeCycleDayForMonth(preferred, refY, refM);

  let endY: number;
  let endM: number;
  if (refD <= dayInRefMonth) {
    endY = refY;
    endM = refM;
  } else {
    endM = refM + 1;
    endY = refY;
    if (endM > 11) {
      endM = 0;
      endY += 1;
    }
  }

  // Normaliza o dia para o mês do END (pode ser diferente do mês ref).
  const endDay = normalizeCycleDayForMonth(preferred, endY, endM);
  const end = new Date(endY, endM, endDay, 23, 59, 59, 999);

  // O START deve ser EXATAMENTE 1 dia após o END do ciclo anterior, garantindo
  // continuidade temporal mesmo quando o ciclo anterior foi encurtado (ex.: fev).
  // Em vez de calcular "(day+1) do mês anterior" — que falha se o mês anterior
  // tinha menos dias —, derivamos: start = end_do_ciclo_anterior + 1 dia.
  let startM = endM - 1;
  let startY = endY;
  if (startM < 0) {
    startM = 11;
    startY -= 1;
  }
  const prevEndDay = normalizeCycleDayForMonth(preferred, startY, startM);
  // start = (prevEnd + 1 dia) à meia-noite local.
  const startBase = new Date(startY, startM, prevEndDay, 0, 0, 0, 0);
  const start = new Date(startBase.getTime() + 24 * 60 * 60 * 1000);
  start.setHours(0, 0, 0, 0);

  return { start, end };
}

export function getPreviousCycleRange(cycleDay: number, ref: Date = new Date()): CycleRange {
  const current = getCycleRange(cycleDay, ref);
  // Pega 1 dia antes do start atual como referência → cai dentro do ciclo anterior
  const refPrev = new Date(current.start.getTime() - 24 * 60 * 60 * 1000);
  return getCycleRange(cycleDay, refPrev);
}

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

export function formatCycleLabel(range: CycleRange): string {
  const s = `${pad(range.start.getDate())} ${MONTHS_PT[range.start.getMonth()]}`;
  const e = `${pad(range.end.getDate())} ${MONTHS_PT[range.end.getMonth()]}`;
  return `${s} — ${e}`;
}

export function isWithinCycle(dateISO: string, range: CycleRange): boolean {
  const d = new Date(dateISO + "T12:00:00");
  return d.getTime() >= range.start.getTime() && d.getTime() <= range.end.getTime();
}

/** Bucket de ciclo (mesma forma que MonthBucket, para reuso na UI). */
export interface CycleBucket {
  /** Chave estável: YYYY-MM-DD do dia final do ciclo. */
  key: string;
  /** Label curto: "09/abr — 08/mai" sem ano. */
  label: string;
  /** Label longo com ano: "09 abr — 08 mai 2026". */
  longLabel: string;
  start: Date;
  end: Date;
}

function bucketFromRange(range: CycleRange): CycleBucket {
  const key = `${range.end.getFullYear()}-${pad(range.end.getMonth() + 1)}-${pad(range.end.getDate())}`;
  const s = `${pad(range.start.getDate())}/${MONTHS_PT[range.start.getMonth()]}`;
  const e = `${pad(range.end.getDate())}/${MONTHS_PT[range.end.getMonth()]}`;
  const longLabel = `${pad(range.start.getDate())} ${MONTHS_PT[range.start.getMonth()]} — ${pad(range.end.getDate())} ${MONTHS_PT[range.end.getMonth()]} ${range.end.getFullYear()}`;
  return { key, label: `${s} — ${e}`, longLabel, start: range.start, end: range.end };
}

/** Bucket do ciclo corrente. */
export function currentCycleBucket(cycleDay: number, ref: Date = new Date()): CycleBucket {
  return bucketFromRange(getCycleRange(cycleDay, ref));
}

/** Lista os últimos N ciclos (mais recente primeiro), incluindo o ciclo atual. */
export function lastNCycles(n: number, cycleDay: number, ref: Date = new Date()): CycleBucket[] {
  const out: CycleBucket[] = [];
  let r = getCycleRange(cycleDay, ref);
  for (let i = 0; i < n; i++) {
    out.push(bucketFromRange(r));
    // Próximo ciclo anterior: 1 dia antes do start vira ref do anterior.
    const refPrev = new Date(r.start.getTime() - 24 * 60 * 60 * 1000);
    r = getCycleRange(cycleDay, refPrev);
  }
  return out;
}
