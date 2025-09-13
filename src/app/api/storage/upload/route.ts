import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

const BUCKET = process.env.SUPABASE_BUCKET!;

/**
 * POST /api/storage/upload
 * body: FormData { path: <pasta da consulta>, file: <File> }
 */
export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const rawPath = String(form.get("path") || "");
    const path = rawPath.replace(/^\/+|\/+$/g, ""); // trim "/"
    const file = form.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Arquivo não enviado" }, { status: 400 });
    }
    if (!path) {
      return NextResponse.json({ error: "Caminho da pasta inválido" }, { status: 400 });
    }

    const filePath = `${path}/${file.name}`;
    const { error } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(filePath, file, {
        upsert: true,
        contentType: file.type || undefined,
        cacheControl: "3600",
      });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, path: filePath });
  } catch (e: any) {
    return NextResponse.json({ error: "Upload error" }, { status: 500 });
  }
}
