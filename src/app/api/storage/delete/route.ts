// src/app/api/storage/delete/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { supabaseAdmin } from "@/lib/supabase";

const BUCKET = process.env.SUPABASE_BUCKET!;
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const medicoId = (session.user as any)?.medicoId as number | null;
    if (!medicoId) {
      return NextResponse.json({ error: "Sem médico" }, { status: 401 });
    }

    const { path } = (await req.json()) as { path?: string };
    if (!path) {
      return NextResponse.json({ error: "path é obrigatório" }, { status: 400 });
    }

    // só permite caminhos do médico
    if (!path.startsWith(`${medicoId}/`)) {
      return NextResponse.json({ error: "Forbidden path" }, { status: 403 });
    }

    // não deixa excluir pastas nem o sentinel .keep
    const base = path.split("/").pop() || "";
    if (base === ".keep") {
      return NextResponse.json({ error: "Não é permitido excluir .keep" }, { status: 400 });
    }
    if (path.endsWith("/")) {
      return NextResponse.json({ error: "Exclusão de pastas não suportada" }, { status: 400 });
    }

    const { error } = await supabaseAdmin.storage.from(BUCKET).remove([path]);
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("POST /api/storage/delete error:", e);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
