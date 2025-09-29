// src/app/api/tele/joinlink/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { signJoin } from "@/lib/tele";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const medicoId = (session?.user as any)?.medicoId as number | undefined;
    if (!medicoId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

    const { consultaId } = await req.json();
    if (!consultaId) return NextResponse.json({ error: "consultaId required" }, { status: 400 });

    // garante que a consulta é do médico logado
    const ok = await prisma.consulta.findFirst({
      where: { id: Number(consultaId), medicoId },
      select: { id: true },
    });
    if (!ok) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

    const ts = Date.now();
    const sig = signJoin(Number(consultaId), ts);
    const origin = process.env.NEXT_PUBLIC_BASE_URL || req.headers.get("origin") || "";
    const url = `${origin}/tele/${consultaId}?ts=${ts}&sig=${encodeURIComponent(sig)}`;

    return NextResponse.json({ url, ts }, { status: 200 });
  } catch (e: any) {
    console.error("[tele.joinlink][POST]", e);
    return NextResponse.json({ error: "INTERNAL" }, { status: 500 });
  }
}
