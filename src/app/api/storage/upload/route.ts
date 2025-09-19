// src/app/api/storage/upload/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

const BUCKET = process.env.SUPABASE_BUCKET!;

export const dynamic = "force-dynamic";

/**
 * POST /api/storage/upload
 * body: FormData { path: <pasta da consulta>, file: <File> }
 */
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const medicoId = (session.user as any)?.medicoId as number | null;
    if (!medicoId) return NextResponse.json({ error: "Sem médico" }, { status: 401 });

    const form = await req.formData();
    const rawPath = String(form.get("path") || "");
    const path = rawPath.replace(/^\/+|\/+$/g, ""); // trim "/"
    const file = form.get("file") as File | null;

    if (!file) return NextResponse.json({ error: "Arquivo não enviado" }, { status: 400 });
    if (!path) return NextResponse.json({ error: "Caminho da pasta inválido" }, { status: 400 });
    if (!path.startsWith(`${medicoId}/`)) {
      return NextResponse.json({ error: "Forbidden path" }, { status: 403 });
    }

    const filePath = `${path}/${file.name}`;
    const { error } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(filePath, file, {
        upsert: true,
        contentType: file.type || undefined,
        cacheControl: "3600",
      });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true, path: filePath });
  } catch (e: any) {
    console.error("[storage/upload][POST]", e);
    return NextResponse.json({ error: "Upload error" }, { status: 500 });
  }
}
