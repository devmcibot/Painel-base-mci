import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma"; // se preferir, "@/src/lib/prisma"

export const dynamic = "force-dynamic";

type IncomingEvent = {
  id: string;                  // googleEventId
  calendarId?: string | null;  // googleCalendarId
  title?: string | null;
  start: string;               // ISO
  end: string;                 // ISO
  patientId?: number | string | null;
  consultaId?: number | string | null;
};

type SyncBody = {
  medicoId: number | string;
  events: IncomingEvent[];
};

function isValidISO(s: unknown): s is string {
  if (typeof s !== "string") return false;
  const d = new Date(s);
  return !Number.isNaN(d.getTime());
}

export async function POST(req: Request) {
  let body: SyncBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const medicoIdNum = Number(body?.medicoId);
  if (!medicoIdNum || !Array.isArray(body?.events)) {
    return NextResponse.json({ error: "payload inválido" }, { status: 400 });
  }

  for (const ev of body.events) {
    if (!ev?.id) return NextResponse.json({ error: "event.id ausente" }, { status: 400 });
    if (!isValidISO(ev?.start) || !isValidISO(ev?.end)) {
      return NextResponse.json({ error: `datas inválidas no evento ${ev.id}` }, { status: 400 });
    }

    const start = new Date(ev.start);
    const end = new Date(ev.end);
    const title = ev.title?.trim() || "Evento";
    const consultaIdNum = ev.consultaId ? Number(ev.consultaId) : null;
    const patientIdNum = ev.patientId ? Number(ev.patientId) : null;
    const calId = ev.calendarId ?? null;

    if (consultaIdNum) {
      // === Vinculado a uma Consulta: ExternalLink (google) ===
      const existing = await prisma.externalLink.findFirst({
        where: { provider: "google", externalId: ev.id },
      });

      if (existing) {
        await prisma.externalLink.update({
          where: { id: existing.id },
          data: { calendarId: calId, consultaId: consultaIdNum },
        });
      } else {
        await prisma.externalLink.create({
          data: {
            consultaId: consultaIdNum,
            provider: "google",
            externalId: ev.id,
            calendarId: calId,
          },
        });
      }

      // opcional: sincroniza a data da consulta com o Google
      await prisma.consulta.update({
        where: { id: consultaIdNum },
        data: { data: start },
      });
    } else {
      // === Evento "solto" na agenda do médico ===
      const existing = await prisma.agendaEvento.findFirst({
        where: { googleEventId: ev.id, googleCalendarId: calId, medicoId: medicoIdNum },
      });

      if (existing) {
        await prisma.agendaEvento.update({
          where: { id: existing.id },
          data: {
            titulo: title,
            inicio: start,
            fim: end,
            pacienteId: patientIdNum ?? null,
          },
        });
      } else {
        await prisma.agendaEvento.create({
          data: {
            medicoId: medicoIdNum,
            pacienteId: patientIdNum ?? null,
            consultaId: null,
            titulo: title,
            inicio: start,
            fim: end,
            origem: "google",
            googleEventId: ev.id,
            googleCalendarId: calId,
          },
        });
      }
    }
  }

  return NextResponse.json({ ok: true });
}
