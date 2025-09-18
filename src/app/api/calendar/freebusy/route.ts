import { NextRequest, NextResponse } from "next/server";
import { isWithinAvailability, getBusy } from "@/src/lib/calendar";
import { rangesOverlap, toDate } from "@/src/lib/datetime";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const medicoId = Number(body.medicoId);
    const inicio = toDate(body.start);
    const fim = toDate(body.end);

    if (!medicoId || !(inicio instanceof Date) || !(fim instanceof Date)) {
      return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 });
    }

    // 1) Fora do horário de atendimento?
    const avail = await isWithinAvailability(medicoId, inicio, fim);
    if (!avail.ok) {
      return NextResponse.json(
        {
          conflict: true,
          reasons: [avail.reason], // ex.: "outside_hours" | "crosses_midnight" | "in_absence"
          busy: [],
        },
        { status: 200 }
      );
    }

    // 2) Sobreposição com eventos/ausências?
    const busy = await getBusy(medicoId, inicio, fim);
    const overlap = busy.some(b => rangesOverlap(inicio, fim, b.inicio, b.fim));

    return NextResponse.json(
      {
        conflict: overlap,
        reasons: overlap ? ["overlap_busy"] : [],
        busy,
      },
      { status: 200 }
    );
  } catch (e) {
    console.error("[freebusy][POST]", e);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}
