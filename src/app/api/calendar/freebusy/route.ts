// src/app/api/calendar/freebusy/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const medicoId = (session?.user as any)?.medicoId as number | undefined;
    if (!session || !medicoId) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const body = await req.json() as { start: string; end: string; };
    const ignoreEventId = Number(new URL(req.url).searchParams.get("ignoreEventId") || "0") || null;

    const start = new Date(body.start);
    const end   = new Date(body.end);

    // ... busque eventos e ausências COMO JÁ FAZIA ...
    const events = await prisma.agendaEvento.findMany({
      where: {
        medicoId,
        fim: { gt: start },
        inicio: { lt: end },
      },
      select: { id: true, inicio: true, fim: true },
      orderBy: { inicio: "asc" },
    });

    // 👉 filtra fora o próprio evento, se pedido
    const filtered = ignoreEventId
      ? events.filter(e => e.id !== ignoreEventId)
      : events;

    return NextResponse.json({ busy: filtered }, { status: 200 });
  } catch (e) {
    console.error("[calendar/freebusy][POST]", e);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}
