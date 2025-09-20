import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // força abrir conexão (se já estiver aberta, é no-op)
    await prisma.$connect();

    // informações do servidor e horário
    const version = await prisma.$queryRaw<{ version: string }[]>`SELECT version()`;
    const now = await prisma.$queryRaw<{ now: Date }[]>`SELECT NOW() AS now`;

    // alguns contadores para validar o "schema" esperado
    const pacientes = await prisma.paciente.count().catch(() => -1);
    const medicos = await prisma.medico.count().catch(() => -1);

    return NextResponse.json({
      ok: true,
      db: {
        version: version?.[0]?.version ?? null,
        now: now?.[0]?.now ?? null,
        counts: { pacientes, medicos },
        // mostra para qual host/database sua DATABASE_URL aponta (sem senha)
        target: safeDbTarget(),
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e.message, stack: e.stack },
      { status: 500 }
    );
  }
}

function safeDbTarget() {
  try {
    const u = new URL(process.env.DATABASE_URL || "");
    return {
      protocol: u.protocol.replace(":", ""),
      host: u.hostname,
      port: u.port || null,
      db: u.pathname.replace(/^\//, ""),
    };
  } catch {
    return null;
  }
}
