// src/app/api/medico/horario/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

function parseHHMM(s: string) {
  const [h, m] = s.split(":").map(Number);
  return h * 60 + m;
}

export const dynamic = "force-dynamic";

/**
 * GET: lista horários do médico
 */
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
 * POST: cria um mesmo intervalo para vários dias (ex.: padrão Seg–Sex 09–17)
 * body: { weekdays:number[], start:"HH:mm", end:"HH:mm", replace?:boolean }
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
      replace?: boolean;
    };

    const startMin = parseHHMM(body.start);
    const endMin = parseHHMM(body.end);

    await prisma.$transaction(async (tx) => {
      if (body.replace) {
        await tx.medicoHorario.deleteMany({ where: { medicoId } });
      }
      if (Array.isArray(body.weekdays)) {
        await tx.medicoHorario.createMany({
          data: body.weekdays.map((wd) => ({
            medicoId,
            weekday: wd,
            startMin,
            endMin,
          })),
          skipDuplicates: true,
        });
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
 * PUT: substitui todos os horários por uma grade manual (um intervalo por dia)
 * body: { replace?: boolean; items: { weekday:number; start:"HH:mm"; end:"HH:mm"; enabled?:boolean }[] }
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
      items: { weekday: number; start: string; end: string; enabled?: boolean }[];
    };

    const rows =
      (body.items || [])
        .filter((it) => it.enabled !== false && typeof it.weekday === "number" && it.start && it.end)
        .map((it) => ({
          medicoId,
          weekday: it.weekday,
          startMin: parseHHMM(it.start),
          endMin: parseHHMM(it.end),
        })) ?? [];

    await prisma.$transaction(async (tx) => {
      if (body.replace !== false) {
        await tx.medicoHorario.deleteMany({ where: { medicoId } });
      }
      if (rows.length) {
        await tx.medicoHorario.createMany({ data: rows });
      }
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
