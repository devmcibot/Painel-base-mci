import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { supabaseAdmin } from "@/lib/supabase";
import { prisma } from "@/lib/prisma";
import { ensureFolder, ensureConsultaFolder } from "@/lib/storage";

export const dynamic = "force-dynamic";

const BUCKET = process.env.SUPABASE_BUCKET!;
if (!BUCKET) throw new Error("SUPABASE_BUCKET não definido.");

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
function pad2(n: number) { return String(n).padStart(2, "0"); }
function nowStamp(d = new Date()) {
  return `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}_${pad2(d.getHours())}${pad2(d.getMinutes())}${pad2(d.getSeconds())}`;
}
function rand4() {
  return String(Math.floor(Math.random() * 10000)).padStart(4, "0");
}

type MetaTele = {
  origin?: "tele" | "anamnese";
  medicoId?: number;
  pacienteId?: number;
  consultaId?: number;
  nome?: string;
  cpf?: string | null;
  timestamp?: string;
  transcript?: string;
};

export async function POST(req: Request) {
  try {
    // auth
    const session = await getServerSession(authOptions);
    const medicoIdSess = (session?.user as any)?.medicoId as number | undefined;
    if (!medicoIdSess) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // form-data
    const form = await req.formData();

    // áudio (obrigatório nos dois fluxos)
    const audio = form.get("audio") as File | null;
    if (!audio) {
      return NextResponse.json({ error: "MISSING_AUDIO" }, { status: 400 });
    }

    // texto pode vir como string (anamnese) OU dentro de meta.transcript (tele)
    let text = "";
    const txtField = form.get("text");
    if (typeof txtField === "string") {
      text = txtField;
    } else if (txtField instanceof File) {
      text = await txtField.text();
    }

    // ler meta (teleconsulta)
    const metaRaw = form.get("meta") as string | null;
    let origin: "tele" | "anamnese" = "anamnese";
    let medicoId = medicoIdSess;
    let pacienteId: number | undefined;
    let consultaId: number | undefined;
    let pacienteNome: string | undefined;
    let pacienteCpf: string | null | undefined;
    let timestamp = nowStamp();

    if (metaRaw) {
      try {
        const meta = JSON.parse(metaRaw) as MetaTele;
        if (meta.origin === "tele") origin = "tele";
        if (typeof meta.medicoId === "number") medicoId = meta.medicoId;
        if (typeof meta.pacienteId === "number") pacienteId = meta.pacienteId;
        if (typeof meta.consultaId === "number") consultaId = meta.consultaId;
        if (typeof meta.nome === "string") pacienteNome = meta.nome;
        if (typeof meta.cpf !== "undefined") pacienteCpf = meta.cpf;
        if (typeof meta.timestamp === "string" && meta.timestamp) timestamp = meta.timestamp;
        if (typeof meta.transcript === "string") text = meta.transcript;
      } catch {
        // meta inválido → ignora
      }
    }

    // fluxo anamnese (pastaPath enviado pela tela)
    let pastaPath =
      (form.get("pastaPath") as string | null) ||
      (form.get("path") as string | null) ||
      undefined;

    // segurança de caminho (se a tela mandou pastaPath)
    if (pastaPath && !pastaPath.startsWith(`${medicoIdSess}/`)) {
      return NextResponse.json({ error: "Forbidden path" }, { status: 403 });
    }

    // Se não vier pastaPath, tentamos resolver pela consulta (tele OU anamnese sem path)
    if (!pastaPath) {
      if (!consultaId) {
        return NextResponse.json({ error: "MISSING_CONSULTA_ID_OR_PASTA" }, { status: 400 });
      }

      // valida consulta do próprio médico e pega dados do paciente/horário
      const consulta = await prisma.consulta.findFirst({
        where: { id: consultaId, medicoId: medicoIdSess },
        select: {
          id: true,
          data: true,
          pastaPath: true,
          paciente: { select: { id: true, nome: true, cpf: true } },
        },
      });
      if (!consulta) {
        return NextResponse.json({ error: "CONSULTA_NOT_FOUND" }, { status: 404 });
      }

      // preenche faltantes a partir da consulta
      pacienteId = pacienteId ?? consulta.paciente?.id;
      pacienteNome = pacienteNome ?? consulta.paciente?.nome;
      pacienteCpf = typeof pacienteCpf === "undefined" ? (consulta.paciente?.cpf ?? null) : pacienteCpf;

      if (consulta.pastaPath) {
        pastaPath = consulta.pastaPath;
        await ensureFolder(pastaPath);
      } else {
        if (!pacienteId || !pacienteNome) {
          return NextResponse.json({ error: "MISSING_PATIENT_DATA" }, { status: 400 });
        }
        // cria a pasta usando seu helper (padrão do projeto)
        pastaPath = await ensureConsultaFolder({
          medicoId: medicoIdSess,
          pacienteId,
          nome: pacienteNome,
          cpf: pacienteCpf ?? undefined,
          consultaId: consulta.id,
          data: consulta.data,
        });
        // persiste o path na consulta para reutilização futura
        await prisma.consulta.update({
          where: { id: consulta.id },
          data: { pastaPath },
        });
      }
    } else {
      // se veio pastaPath, garante a pasta materializada (.keep)
      await ensureFolder(pastaPath);
    }

    // monta base do nome (mantém padrão da ANAMNESE, adiciona _TELE só na tele)
    const base =
      `anamnese_${slugify(pacienteNome || "paciente")}${cpfSuffix(pacienteCpf)}_${timestamp}_${rand4()}`;
    const isTele = origin === "tele";

    const audioPath = `${pastaPath}/${base}${isTele ? "_TELE" : ""}.webm`;
    const textPath  = `${pastaPath}/${base}${isTele ? "_TELE" : ""}.txt`;

    // ---- upload do áudio
    const audioBuf = Buffer.from(await audio.arrayBuffer());
    const au = await supabaseAdmin.storage.from(BUCKET).upload(audioPath, audioBuf, {
      contentType: audio.type || "audio/webm",
      upsert: false,
    });
    if (au.error) {
      // em caso de colisão improvável, tenta novo sufixo
      const alt = `${pastaPath}/${base}_${rand4()}${isTele ? "_TELE" : ""}.webm`;
      const au2 = await supabaseAdmin.storage.from(BUCKET).upload(alt, audioBuf, {
        contentType: audio.type || "audio/webm",
        upsert: false,
      });
      if (au2.error) throw au2.error;
    }

    // ---- upload do texto (UTF-8; mesmo se vazio, grava)
    const textBuf = Buffer.from(text ?? "", "utf-8");
    const tu = await supabaseAdmin.storage.from(BUCKET).upload(textPath, textBuf, {
      contentType: "text/plain; charset=utf-8",
      upsert: false,
    });
    if (tu.error) {
      const alt = `${pastaPath}/${base}_${rand4()}${isTele ? "_TELE" : ""}.txt`;
      const tu2 = await supabaseAdmin.storage.from(BUCKET).upload(alt, textBuf, {
        contentType: "text/plain; charset=utf-8",
        upsert: false,
      });
      if (tu2.error) throw tu2.error;
    }

    return NextResponse.json({
      ok: true,
      origin,
      pastaPath,
      files: { audioPath, textPath },
    });
  } catch (e) {
    console.error("POST /api/medico/anamnese error:", e);
    return NextResponse.json({ error: "Erro no upload" }, { status: 500 });
  }
}
