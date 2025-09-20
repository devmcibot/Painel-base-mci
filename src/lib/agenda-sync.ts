// src/lib/agenda-sync.ts
import { prisma } from "@/lib/prisma";
import { addMinutes } from "@/lib/datetime";
import { ensureConsultaFolder } from "@/lib/storage";

/**
 * Garante (ou atualiza) o evento de agenda de uma consulta
 * e também materializa a pasta dessa consulta no Storage.
 * - Atualiza consulta.pastaPath se necessário
 * - Retorna o caminho da pasta
 */
export async function ensureEventForConsulta(consultaId: number) {
  const c = await prisma.consulta.findUnique({
    where: { id: consultaId },
    include: { paciente: true },
  });
  if (!c) return null;

  const inicio = new Date(c.data);
  const fim = addMinutes(inicio, 30);
  const titulo = `Consulta — ${c.paciente?.nome ?? "Paciente"}`;

  // cria/atualiza evento
  const ev = await prisma.agendaEvento.findFirst({ where: { consultaId } });
  if (ev) {
    await prisma.agendaEvento.update({
      where: { id: ev.id },
      data: { titulo, inicio, fim },
    });
  } else {
    await prisma.agendaEvento.create({
      data: {
        medicoId: c.medicoId,
        pacienteId: c.pacienteId,
        consultaId,
        titulo,
        inicio,
        fim,
        origem: "manual",
      },
    });
  }

  // cria/garante a pasta da consulta e grava em consulta.pastaPath
  const folder = await ensureConsultaFolder({
    medicoId: c.medicoId,
    pacienteId: c.pacienteId,
    nome: c.paciente?.nome ?? `paciente_${c.pacienteId}`,
    cpf: c.paciente?.cpf ?? null,
    consultaId,
    data: inicio,
  });

  if (c.pastaPath !== folder) {
    await prisma.consulta.update({
      where: { id: consultaId },
      data: { pastaPath: folder },
    });
  }

  return folder;
}
