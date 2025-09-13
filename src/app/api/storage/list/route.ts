// src/app/api/storage/list/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { supabaseAdmin } from "@/lib/supabase";

const BUCKET = process.env.SUPABASE_BUCKET!;
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const medicoId = (session.user as any)?.medicoId as number | null;
    if (!medicoId) {
      return NextResponse.json({ error: "Sem médico" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const path = searchParams.get("path") || "";
    if (!path) {
      return NextResponse.json({ error: "path é obrigatório" }, { status: 400 });
    }
    if (!path.startsWith(`${medicoId}/`)) {
      return NextResponse.json({ error: "Forbidden path" }, { status: 403 });
    }

    const { data, error } = await supabaseAdmin.storage.from(BUCKET).list(path, {
      limit: 200,
      offset: 0,
      sortBy: { column: "name", order: "asc" },
    });

    if (error) throw error;

    // 🚫 escondemos o .keep na origem
    const entries =
      (data ?? [])
        .filter((it) => it.name !== ".keep")
        .map((it) => ({
          name: it.name,
          path: `${path}/${it.name}`,
          type: (it as any).metadata ? ("file" as const) : ("folder" as const),
          size: (it as any).metadata?.size ?? null,
        }));

    return NextResponse.json({ entries });
  } catch (e) {
    console.error("GET /api/storage/list error:", e);
    return NextResponse.json({ error: "List failed" }, { status: 500 });
  }
}
