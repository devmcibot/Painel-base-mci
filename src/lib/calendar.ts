// src/lib/calendar.ts
import { prisma } from "@/lib/prisma";
import * as dt from "./datetime";

export type BusyBlock = {
  inicio: Date;
  fim: Date;
  origem: "evento" | "ausencia";
  refId?: number;
};

/**
 * Retorna ocupações (eventos + ausências) que cruzam o intervalo solicitado.
 */
export async function getBusy(
  medicoId: number,
  start: Date | string | number,
  end: Date | string | number
): Promise<BusyBlock[]> {
  const s = dt.toDate(start);
  const e = dt.toDate(end);
  dt.assertValidRange(s, e);

  const [eventos, ausencias] = await Promise.all([
    prisma.agendaEvento.findMany({
      where: {
        medicoId,
        AND: [{ fim: { gt: s } }, { inicio: { lt: e } }], // overlap
      },
      select: { id: true, inicio: true, fim: true },
      orderBy: { inicio: "asc" },
    }),
    // Caso o modelo exista no schema (como está no seu projeto)
    prisma.medicoAusencia.findMany({
      where: {
        medicoId,
        AND: [{ fim: { gt: s } }, { inicio: { lt: e } }],
      },
      select: { id: true, inicio: true, fim: true },
      orderBy: { inicio: "asc" },
    }),
  ]);

  const blocks: BusyBlock[] = [
    ...eventos.map((ev) => ({
      inicio: ev.inicio,
      fim: ev.fim,
      origem: "evento" as const,
      refId: ev.id,
    })),
    ...ausencias.map((a) => ({
      inicio: a.inicio,
      fim: a.fim,
      origem: "ausencia" as const,
      refId: a.id,
    })),
  ].sort((a, b) => a.inicio.getTime() - b.inicio.getTime());

  return blocks;
}

/**
 * Valida se o intervalo está dentro do horário configurado do médico.
 * - Garante que não cruza meia-noite no fuso (MVP).
 * - Verifica se [start,end] está contido em algum bloco de horário do dia.
 */
export async function isWithinAvailability(
  medicoId: number,
  start: Date | string | number,
  end: Date | string | number
): Promise<{ ok: true } | { ok: false; reason: "crosses_midnight" | "outside_hours" }> {
  const s = dt.toDate(start);
  const e = dt.toDate(end);
  dt.assertValidRange(s, e);

  // MVP: não permitimos cruzar a meia-noite no fuso padrão
  if (dt.crossesMidnightInTZ(s, e, dt.DEFAULT_TZ)) {
    return { ok: false, reason: "crosses_midnight" };
  }

  const weekday = dt.getWeekdayInTZ(s, dt.DEFAULT_TZ);

  const slots = await prisma.medicoHorario.findMany({
    where: { medicoId, weekday },
    select: { startMin: true, endMin: true },
    orderBy: { startMin: "asc" },
  });

  if (!slots.length) return { ok: false, reason: "outside_hours" };

  const mStart = dt.minutesOfDayInTZ(s, dt.DEFAULT_TZ);
  const mEnd = dt.minutesOfDayInTZ(e, dt.DEFAULT_TZ);

  // O intervalo deve caber 100% dentro de pelo menos um slot
  const covered = slots.some((sl) => mStart >= sl.startMin && mEnd <= sl.endMin);
  if (!covered) return { ok: false, reason: "outside_hours" };

  return { ok: true };
}

// (Opcional) reexport de utilitário, se algum lugar importar de calendar:
export const rangesOverlap = dt.rangesOverlap;
