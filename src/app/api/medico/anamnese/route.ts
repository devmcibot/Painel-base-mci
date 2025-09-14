// src/app/api/medico/anamnese/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const BUCKET = process.env.SUPABASE_BUCKET!;

// helpers p/ nomes de arquivo
function slugify(s: string) {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}
function cpfSuffix(cpf?: string | null) {
  if (!cpf) return "";
  const d = cpf.replace(/\D/g, "");
  return d ? "_" + d.slice(-4) : "";
}
function nowStamp() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(
    d.getHours()
  )}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}
function rand4() {
  return String(Math.floor(Math.random() * 10000)).padStart(4, "0");
}

export async function POST(req: Request) {
  try {
    // auth
    const session = await getServerSession(authOptions);
    const medicoId = (session?.user as any)?.medicoId as number | undefined;
    if (!medicoId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // form-data
    const form = await req.formData();

    const pastaPath =
      (form.get("pastaPath") as string | null) ||
      (form.get("path") as string | null);
    const pacienteNome = (form.get("pacienteNome") as string | null) ?? "";
    const pacienteCpf = (form.get("pacienteCpf") as string | null) ?? "";

    // audio (File)
    const audio = form.get("audio") as File | null;

    // texto pode vir como string ou como File; suportar os dois
    let text = "";
    const txtField = form.get("text");
    if (typeof txtField === "string") text = txtField;
    else if (txtField instanceof File) text = await txtField.text();

    if (!pastaPath || !audio || text == null) {
      return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
    }

    // segurança de caminho
    if (!pastaPath.startsWith(`${medicoId}/`)) {
      return NextResponse.json({ error: "Forbidden path" }, { status: 403 });
    }

    const base =
      `anamnese_${slugify(pacienteNome)}${cpfSuffix(pacienteCpf)}_${nowStamp()}_${rand4()}`;

    const audioPath = `${pastaPath}/${base}.webm`;
    const textPath = `${pastaPath}/${base}.txt`;

    // ---- upload do áudio
    const audioBuf = Buffer.from(await audio.arrayBuffer());
    const au = await supabaseAdmin.storage.from(BUCKET).upload(audioPath, audioBuf, {
      contentType: audio.type || "audio/webm",
      upsert: false,
    });
    if (au.error) {
      // tenta uma segunda vez com outro sufixo se colidir
      const alt = `${pastaPath}/${base}_${rand4()}.webm`;
      const au2 = await supabaseAdmin.storage.from(BUCKET).upload(alt, audioBuf, {
        contentType: audio.type || "audio/webm",
        upsert: false,
      });
      if (au2.error) throw au2.error;
    }

    // ---- upload do texto (UTF-8)
    const textBuf = Buffer.from(text, "utf-8");
    const tu = await supabaseAdmin.storage.from(BUCKET).upload(textPath, textBuf, {
      contentType: "text/plain; charset=utf-8",
      upsert: false,
    });
    if (tu.error) {
      const alt = `${pastaPath}/${base}_${rand4()}.txt`;
      const tu2 = await supabaseAdmin.storage
        .from(BUCKET)
        .upload(alt, textBuf, {
          contentType: "text/plain; charset=utf-8",
          upsert: false,
        });
      if (tu2.error) throw tu2.error;
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("POST /api/medico/anamnese error:", e);
    return NextResponse.json({ error: "Erro no upload" }, { status: 500 });
  }
}
