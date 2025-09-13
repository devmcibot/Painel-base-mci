// src/lib/storage.ts
import { supabaseAdmin } from "./supabase";

const BUCKET = process.env.SUPABASE_BUCKET!;

// --- helpers de nomeação ---
function slugifyNome(nome: string) {
  return nome
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function pad6(n: number) {
  return String(n).padStart(6, "0");
}

function cpfLast4(cpf?: string | null) {
  if (!cpf) return "xxxx";
  const only = cpf.replace(/\D/g, "");
  return only.slice(-4).padStart(4, "x");
}

// caminho da PASTA do paciente
export function patientFolderPath(opts: {
  medicoId: number;
  pacienteId: number;
  nome: string;
  cpf?: string | null;
}) {
  const slug = slugifyNome(opts.nome);
  const last4 = cpfLast4(opts.cpf);
  // padrão: {medicoId}/{000123_nome-slug_1234}
  return `${opts.medicoId}/${pad6(opts.pacienteId)}_${slug}_${last4}`;
}

// subpasta da consulta dentro da pasta do paciente
export function consultaFolderPath(opts: {
  patientFolder: string;
  consultaId: number;
  data: Date;
}) {
  const y = opts.data.getFullYear();
  const m = String(opts.data.getMonth() + 1).padStart(2, "0");
  const d = String(opts.data.getDate()).padStart(2, "0");
  const hh = String(opts.data.getHours()).padStart(2, "0");
  const mm = String(opts.data.getMinutes()).padStart(2, "0");
  return `${opts.patientFolder}/${y}/${m}/${d}/consulta_${pad6(opts.consultaId)}_${hh}${mm}`;
}

// “cria” pasta subindo um arquivo .keep (1 byte)
export async function ensureFolder(path: string) {
  const keepPath = `${path}/.keep`;
  const file = new Blob(["."], { type: "text/plain" });

  // se já existe, ignora
  const { data: stat } = await supabaseAdmin.storage.from(BUCKET).list(path, { limit: 1 });
  if (stat && stat.length > 0) return { ok: true, path };

  const { error } = await supabaseAdmin.storage.from(BUCKET).upload(keepPath, file, {
    upsert: false,
  });
  if (error && !/The resource already exists/i.test(error.message)) {
    throw error;
  }
  return { ok: true, path };
}

// uploads simples (texto)
export async function uploadTextFile(fullPath: string, content: string) {
  const blob = new Blob([content], { type: "text/plain; charset=utf-8" });
  const { error } = await supabaseAdmin.storage.from(BUCKET).upload(fullPath, blob, {
    upsert: true,
  });
  if (error) throw error;
  return { ok: true, path: fullPath };
}

// ...imports e helpers que você já tem

function pad2(n: number) { return String(n).padStart(2, "0"); }

export function consultaFolderName(consultaId: number, data: Date) {
  const y = data.getFullYear();
  const m = pad2(data.getMonth() + 1);
  const d = pad2(data.getDate());
  const hh = pad2(data.getHours());
  const mm = pad2(data.getMinutes());
  // ex.: 20250918_1030_000123
  return `${y}${m}${d}_${hh}${mm}_${String(consultaId).padStart(6, "0")}`;
}

/**
 * Cria (materializa) a subpasta da consulta dentro da pasta do paciente
 * e retorna o caminho completo.
 */
export async function ensureConsultaFolder(opts: {
  medicoId: number;
  pacienteId: number;
  nome: string;
  cpf?: string | null;
  consultaId: number;
  data: Date;
}) {
  const root = patientFolderPath({
    medicoId: opts.medicoId,
    pacienteId: opts.pacienteId,
    nome: opts.nome,
    cpf: opts.cpf,
  });
  const folder = `${root}/${consultaFolderName(opts.consultaId, opts.data)}`;
  await ensureFolder(folder);
  return folder;
}
