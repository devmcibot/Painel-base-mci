// src/lib/datetime.ts

// Timezone padrão do app
export const DEFAULT_TZ = "America/Sao_Paulo" as const;

/** Converte qualquer coisa em Date. */
export function toDate(v: Date | string | number): Date {
  return v instanceof Date ? v : new Date(v);
}

/** Soma minutos a uma Date. */
export function addMinutes(d: Date, minutes: number): Date {
  return new Date(d.getTime() + minutes * 60_000);
}

/** Converte valor de <input type="datetime-local"> (horário local) para Date em UTC. */
export function fromLocalInputToUTC(value: string): Date {
  // 'YYYY-MM-DDTHH:mm'
  const [date, time] = value.split("T");
  const [y, m, day] = date.split("-").map(Number);
  const [h, min] = time.split(":").map(Number);
  return new Date(Date.UTC(y, m - 1, day, h, min, 0));
}

/** Converte Date (UTC) para string usada no <input datetime-local>. */
export function toLocalInputValueFromUTC(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  const h = String(d.getUTCHours()).padStart(2, "0");
  const min = String(d.getUTCMinutes()).padStart(2, "0");
  return `${y}-${m}-${day}T${h}:${min}`;
}

/** Para preencher <input type="datetime-local"> com horário local do device. */
export function toDatetimeLocalValue(dt: Date | string): string {
  const d = new Date(dt);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

/* ================= Utilitários dependentes de fuso ================= */

type Parts = { y: number; m: number; d: number; h: number; mi: number; weekday: number };

function partsInTZ(date: Date, tz: string): Parts {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hour12: false,
  });
  const map = Object.fromEntries(fmt.formatToParts(date).map(p => [p.type, p.value]));
  const wdMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    y: Number(map.year),
    m: Number(map.month),
    d: Number(map.day),
    h: Number(map.hour),
    mi: Number(map.minute),
    weekday: wdMap[map.weekday] ?? 0,
  };
}

/** 0=Dom ... 6=Sáb no fuso. */
export function getWeekdayInTZ(d: Date, tz: string = DEFAULT_TZ): number {
  return partsInTZ(d, tz).weekday;
}

/** Minutos desde 00:00 no fuso. */
export function minutesOfDayInTZ(d: Date, tz: string = DEFAULT_TZ): number {
  const p = partsInTZ(d, tz);
  return p.h * 60 + p.mi;
}

/** Range cruza a meia-noite no fuso? */
export function crossesMidnightInTZ(start: Date, end: Date, tz: string = DEFAULT_TZ): boolean {
  const a = partsInTZ(start, tz);
  const b = partsInTZ(end, tz);
  return a.y !== b.y || a.m !== b.m || a.d !== b.d;
}

/** Valida se start < end. */
export function assertValidRange(start: Date, end: Date): void {
  if (!(start instanceof Date) || !(end instanceof Date) || !(start.getTime() < end.getTime())) {
    throw new Error("Invalid range: start must be before end");
  }
}

/** Sobreposição de intervalos [a,b) e [c,d). */
export function rangesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && bStart < aEnd;
}

// alias opcional (se em algum lugar foi importado como rangeOverlap)
export const rangeOverlap = rangesOverlap;
