// src/app/api/medico/horario/route.ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

const prisma = new PrismaClient();

function hhmmToMin(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}
function minToHHMM(min: number) {
  const h = String(Math.floor(min / 60)).padStart(2, "0");
  const m = String(min % 60).padStart(2, "0");
  return `${h}:${m}`;
}

// Normaliza para o cliente: { weekday, intervals: [{startMin,endMin}, ...] }
async function readAll(medicoId: number) {
  const rows = await prisma.medicoHorario.findMany({
    where: { medicoId, isActive: true },
    orderBy: [{ weekday: "asc" }, { startMin: "asc" }],
  });
  const byDay: Record<number, { startMin: number; endMin: number }[]> = {};
  for (const r of rows) {
    byDay[r.weekday] ??= [];
    byDay[r.weekday].push({ startMin: r.startMin, endMin: r.endMin });
  }
  return Object.entries(byDay).map(([weekday, intervals]) => ({
    weekday: Number(weekday),
    intervals,
  }));
}

// --- GET: lista horários (agora com vários intervalos por dia)
export async function GET() {
  const session = await getServerSession(authOptions);
  const medicoId = (session?.user as any)?.medicoId as number | undefined;
  if (!medicoId) return NextResponse.json({ error: "no medico" }, { status: 401 });

  const horarios = await readAll(medicoId);
  return NextResponse.json({ horarios });
}

// --- POST: criar padrão (um intervalo Seg–Sex 09:00–17:00)
export async function POST() {
  const session = await getServerSession(authOptions);
  const medicoId = (session?.user as any)?.medicoId as number | undefined;
  if (!medicoId) return NextResponse.json({ error: "no medico" }, { status: 401 });

  await prisma.$transaction([
    prisma.medicoHorario.deleteMany({ where: { medicoId } }),
    prisma.medicoHorario.createMany({
      data: [1, 2, 3, 4, 5].map((weekday) => ({
        medicoId,
        weekday,
        startMin: hhmmToMin("09:00"),
        endMin: hhmmToMin("17:00"),
        isActive: true,
      })),
    }),
  ]);

  const horarios = await readAll(medicoId);
  return NextResponse.json({ horarios }, { status: 201 });
}

// --- PUT: substitui tudo com vários intervalos por dia
// Body esperado:
// { replace: true, items: [{ weekday: 1..6, enabled: boolean, slots: [{start:"09:00", end:"12:00"}, ...] }, ...] }
export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  const medicoId = (session?.user as any)?.medicoId as number | undefined;
  if (!medicoId) return NextResponse.json({ error: "no medico" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const items = (body?.items ?? []) as Array<{
    weekday: number;
    enabled?: boolean;
    slots?: Array<{ start: string; end: string }>;
  }>;

  // validação básica e sobreposição
  for (const it of items) {
    if (!it.enabled) continue;
    const slots = (it.slots ?? [])
      .map((s) => ({ startMin: hhmmToMin(s.start), endMin: hhmmToMin(s.end) }))
      .filter((s) => s.startMin < s.endMin)
      .sort((a, b) => a.startMin - b.startMin);

    for (let i = 1; i < slots.length; i++) {
      if (slots[i].startMin < slots[i - 1].endMin) {
        return NextResponse.json(
          { error: `Intervalos sobrepostos em ${it.weekday}` },
          { status: 400 }
        );
      }
    }
  }

  // persiste
  await prisma.$transaction(async (tx) => {
    await tx.medicoHorario.deleteMany({ where: { medicoId } });
    const data = items
      .filter((it) => it.enabled && (it.slots ?? []).length > 0)
      .flatMap((it) =>
        (it.slots ?? []).map((s) => ({
          medicoId,
          weekday: it.weekday,
          startMin: hhmmToMin(s.start),
          endMin: hhmmToMin(s.end),
          isActive: true,
        }))
      );
    if (data.length) await tx.medicoHorario.createMany({ data });
  });

  const horarios = await readAll(medicoId);
  return NextResponse.json({ horarios });
}
