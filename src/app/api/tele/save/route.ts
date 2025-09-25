// src/app/api/tele/save/route.ts
import { NextRequest, NextResponse } from "next/server";
import { ensureConsultaFolder, uploadTextFile } from "@/lib/storage";
import { supabaseAdmin } from "@/lib/supabase";

// Garante runtime Node (precisamos de Buffer)
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();

    const audio = form.get("audio") as File | null;
    const metaRaw = form.get("meta") as string | null;
    if (!audio || !metaRaw) {
      return NextResponse.json({ error: "missing audio/meta" }, { status: 400 });
    }

    const meta = JSON.parse(metaRaw) as {
      medicoId: number;
      pacienteId: number;
      nome: string;
      cpf: string | null;
      consultaId: number;
      timestamp: string; // yyyymmdd_hhmmss
      transcript?: string;
    };

    // 1) materializa pasta da consulta
    const folder = await ensureConsultaFolder({
      medicoId: meta.medicoId,
      pacienteId: meta.pacienteId,
      nome: meta.nome,
      cpf: meta.cpf ?? null,
      consultaId: meta.consultaId,
      data: new Date(), // pode usar o timestamp se preferir
    });

    const bucket = process.env.STORAGE_BUCKET || process.env.SUPABASE_BUCKET!;
    if (!bucket) {
      return NextResponse.json({ error: "STORAGE_BUCKET not set" }, { status: 500 });
    }

    // 2) upload do áudio (.webm)
    const audioArrayBuffer = await audio.arrayBuffer();
    const buf = Buffer.from(audioArrayBuffer);
    const audioPath = `${folder}/tele_${meta.timestamp}.webm`;

    const { error: upErr } = await supabaseAdmin
      .storage
      .from(bucket)
      .upload(audioPath, buf, { upsert: true, contentType: "audio/webm" });

    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 500 });
    }

    // 3) upload do texto (.txt)
    const txtPath = `${folder}/tele_transcricao_${meta.timestamp}.txt`;
    await uploadTextFile(txtPath, meta.transcript ?? "");

    return NextResponse.json({ ok: true, folder, audioPath, txtPath });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}
