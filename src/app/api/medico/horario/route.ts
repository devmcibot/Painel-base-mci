import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

function parseHHMM(s: string) {
  const [h, m] = s.split(":").map(Number);
  return h * 60 + m;
}
function isValidRange(a?: number, b?: number) {
  return typeof a === "number" && typeof b === "number" && Number.isFinite(a) && Number.isFinite(b) && a < b;
}
// Transforma start/end (+ intervalo opcional) em 1..2 janelas (manhã/tarde)
function buildWindows(
  startStr: string,
  endStr: string,
  breakStartStr?: string,
  breakEndStr?: string
): Array<{ startMin: number; endMin: number }> {
  const startMin = parseHHMM(startStr);
  const endMin = parseHHMM(endStr);

  if (!isValidRange(startMin, endMin)) return [];

  // Sem intervalo informado → 1 janela
  if (!breakStartStr || !breakEndStr) {
    return [{ startMin, endMin }];
  }

  const bS = parseHHMM(breakStartStr);
  const bE = parseHHMM(breakEndStr);

  const breakOk = isValidRange(bS, bE) && startMin < bS && bE < endMin;
  if (!breakOk) {
    // Intervalo inválido → volta a ser 1 janela
    return [{ startMin, endMin }];
  }

  const wins: Array<{ startMin: number; endMin: number }> = [];
  if (isValidRange(startMin, bS)) wins.push({ startMin, endMin: bS });
  if (isValidRange(bE, endMin)) wins.push({ startMin: bE, endMin });
  return wins;
}

export const dynamic = "force-dynamic";

/** GET: lista horários do médico */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const medicoId = (session?.user as any)?.medicoId as number | undefined;
    if (!session || !medicoId) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }
    const horarios = await prisma.medicoHorario.findMany({
      where: { medicoId },
      orderBy: [{ weekday: "asc" }, { startMin: "asc" }],
    });
    return NextResponse.json({ horarios }, { status: 200 });
  } catch (e) {
    console.error("[medico.horario][GET]", e);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}

/**
 * POST: cria um mesmo intervalo (com pausa opcional) p/ vários dias
 * body: { weekdays:number[], start:"HH:mm", end:"HH:mm", breakStart?:"HH:mm", breakEnd?:"HH:mm", replace?:boolean }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const medicoId = (session?.user as any)?.medicoId as number | undefined;
    if (!session || !medicoId) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const body = (await req.json()) as {
      weekdays: number[];
      start: string;
      end: string;
      breakStart?: string;
      breakEnd?: string;
      replace?: boolean;
    };

    const wins = buildWindows(body.start, body.end, body.breakStart, body.breakEnd);
    if (!wins.length) return NextResponse.json({ error: "INVALID_TIME_RANGE" }, { status: 400 });

    await prisma.$transaction(async (tx) => {
      if (body.replace) {
        await tx.medicoHorario.deleteMany({ where: { medicoId } });
      }
      if (Array.isArray(body.weekdays) && body.weekdays.length) {
        const data = body.weekdays.flatMap((wd) =>
          wins.map((w) => ({
            medicoId,
            weekday: wd,
            startMin: w.startMin,
            endMin: w.endMin,
            isActive: true,
          }))
        );
        if (data.length) await tx.medicoHorario.createMany({ data });
      }
    });

    const horarios = await prisma.medicoHorario.findMany({
      where: { medicoId },
      orderBy: [{ weekday: "asc" }, { startMin: "asc" }],
    });
    return NextResponse.json({ created: horarios.length, horarios }, { status: 201 });
  } catch (e) {
    console.error("[medico.horario][POST]", e);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}

/**
 * PUT: substitui por grade manual (1 ou 2 blocos por dia)
 * body: {
 *   replace?: boolean;
 *   items: { weekday:number; start:"HH:mm"; end:"HH:mm"; enabled?:boolean; breakStart?: "HH:mm"; breakEnd?: "HH:mm" }[]
 * }
 */
export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const medicoId = (session?.user as any)?.medicoId as number | undefined;
    if (!session || !medicoId) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const body = (await req.json()) as {
      replace?: boolean;
      items: { weekday: number; start: string; end: string; enabled?: boolean; breakStart?: string; breakEnd?: string }[];
    };

    const rows: Array<{ medicoId: number; weekday: number; startMin: number; endMin: number; isActive: boolean }> = [];

    for (const it of body.items || []) {
      if (it?.enabled === false) continue;
      if (typeof it?.weekday !== "number" || !it?.start || !it?.end) continue;

      const wins = buildWindows(it.start, it.end, it.breakStart, it.breakEnd);
      for (const w of wins) {
        rows.push({ medicoId, weekday: it.weekday, startMin: w.startMin, endMin: w.endMin, isActive: true });
      }
    }

    await prisma.$transaction(async (tx) => {
      if (body.replace !== false) {
        await tx.medicoHorario.deleteMany({ where: { medicoId } });
      }
      if (rows.length) await tx.medicoHorario.createMany({ data: rows });
    });

    const horarios = await prisma.medicoHorario.findMany({
      where: { medicoId },
      orderBy: [{ weekday: "asc" }, { startMin: "asc" }],
    });
    return NextResponse.json({ updated: rows.length, horarios }, { status: 201 });
  } catch (e) {
    console.error("[medico.horario][PUT]", e);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}
