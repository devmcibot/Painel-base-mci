// src/app/api/storage/list/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { supabaseAdmin } from "@/lib/supabase";

const BUCKET = process.env.SUPABASE_BUCKET!;

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const medicoId = (session.user as any)?.medicoId as number | null;
    if (!medicoId) return NextResponse.json({ error: "Sem médico" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const path = searchParams.get("path") || ""; // ex.: "1/000012_lulu_8780/20250918_1030_000123"

    // segurança: só permite listar caminhos do próprio médico
    if (!path.startsWith(`${medicoId}/`)) {
      return NextResponse.json({ error: "Forbidden path" }, { status: 403 });
    }

    const { data, error } = await supabaseAdmin
      .storage.from(BUCKET)
      .list(path, { limit: 1000, sortBy: { column: "name", order: "asc" } });

    if (error) throw error;

    // retorna direto a resposta do storage
    return NextResponse.json(data ?? []);
  } catch (e: any) {
    console.error("GET /api/storage/list error:", e);
    return NextResponse.json({ error: "List failed" }, { status: 500 });
  }
}
