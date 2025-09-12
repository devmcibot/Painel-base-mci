import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const id = Number(params.id);
  const c = await prisma.consulta.findUnique({
    where: { id },
    include: { paciente: true },
  });
  if (!c) return NextResponse.json({ error: "Não encontrada" }, { status: 404 });
  return NextResponse.json(c);
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const id = Number(params.id);
  const body = await req.json();

  const data: any = {};
  if (body.data) data.data = new Date(body.data);
  if (body.status) data.status = body.status; // "ABERTA" | "CONCLUIDA" | "CANCELADA" | "FALTOU" | "REMARCADA"

  // paths opcionais (se vierem)
  ["pastaPath","preAnamnesePath","audioPath","anamnesePath","relatorioPath"].forEach((k) => {
    if (k in body) data[k] = body[k] ?? null;
  });

  const up = await prisma.consulta.update({ where: { id }, data });
  return NextResponse.json(up);
}
