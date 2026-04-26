const MONTHS_PT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export interface CycleRange {
  start: Date;
  end: Date;
}

/**
 * Calcula o intervalo do "mês financeiro" do usuário com base no dia de fechamento.
 * Ex.: cycleDay=8 e ref dentro de abril → 09/mar/00:00 a 08/abr/23:59
 *      cycleDay=8 e ref no dia 15/abr → 09/abr/00:00 a 08/mai/23:59
 */
export function getCycleRange(cycleDay: number, ref: Date = new Date()): CycleRange {
  const day = Math.max(1, Math.min(28, Math.floor(cycleDay)));
  const refY = ref.getFullYear();
  const refM = ref.getMonth();
  const refD = ref.getDate();

  let endY: number;
  let endM: number;
  if (refD <= day) {
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

  const end = new Date(endY, endM, day, 23, 59, 59, 999);

  // start = day+1 do mês anterior ao do end
  let startM = endM - 1;
  let startY = endY;
  if (startM < 0) {
    startM = 11;
    startY -= 1;
  }
  const start = new Date(startY, startM, day + 1, 0, 0, 0, 0);

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
