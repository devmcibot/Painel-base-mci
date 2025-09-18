// src/lib/agenda-sync.ts
import { prisma } from "@/lib/prisma";
import { addMinutes } from "@/src/lib/datetime";

export async function ensureEventForConsulta(consultaId: number) {
  const consulta = await prisma.consulta.findUnique({
    where: { id: consultaId },
    include: { paciente: true },
  });
  if (!consulta) return;

  const inicio = new Date(consulta.data);
  const fim = addMinutes(inicio, 30); // 30 min padrão
  const titulo = `Consulta — ${consulta.paciente?.nome ?? ""}`.trim();

  const existing = await prisma.agendaEvento.findFirst({
    where: { consultaId: consulta.id },
    select: { id: true },
  });

  if (existing) {
    await prisma.agendaEvento.update({
      where: { id: existing.id },
      data: { inicio, fim, titulo, origem: "evento" },
    });
    return existing.id;
  }

  const created = await prisma.agendaEvento.create({
    data: {
      medicoId: consulta.medicoId,
      pacienteId: consulta.pacienteId!,
      consultaId: consulta.id,
      titulo,
      inicio,
      fim,
      origem: "evento",
    },
    select: { id: true },
  });
  return created.id;
}

export async function deleteEventForConsulta(consultaId: number) {
  const existing = await prisma.agendaEvento.findFirst({
    where: { consultaId },
    select: { id: true },
  });
  if (existing) {
    await prisma.agendaEvento.delete({ where: { id: existing.id } });
  }
}
