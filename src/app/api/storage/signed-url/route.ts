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
    const path = searchParams.get("path");
    const downloadName = searchParams.get("download") || undefined; // << opcional

    if (!path) {
      return NextResponse.json({ error: "path é obrigatório" }, { status: 400 });
    }
    if (!path.startsWith(`${medicoId}/`)) {
      return NextResponse.json({ error: "Forbidden path" }, { status: 403 });
    }

    const { data, error } = await supabaseAdmin
      .storage
      .from(BUCKET)
      .createSignedUrl(path, 60 * 10, downloadName ? { download: downloadName } : undefined);

    if (error) throw error;

    return NextResponse.json({ url: data?.signedUrl ?? null });
  } catch (e) {
    console.error("GET /api/storage/signed-url error:", e);
    return NextResponse.json({ error: "Signed URL failed" }, { status: 500 });
  }
}
