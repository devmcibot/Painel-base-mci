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

function pad2(n: number) { return String(n).padStart(2, "0"); }
function pad6(n: number) { return String(n).padStart(6, "0"); }

function cpfLast4(cpf?: string | null) {
  if (!cpf) return "xxxx";
  const only = cpf.replace(/\D/g, "");
  return only.slice(-4).padStart(4, "x");
}

// caminho da PASTA do paciente: {medicoId}/{000123_nome-slug_1234}
export function patientFolderPath(opts: {
  medicoId: number;
  pacienteId: number;
  nome: string;
  cpf?: string | null;
}) {
  const slug = slugifyNome(opts.nome);
  const last4 = cpfLast4(opts.cpf);
  return `${opts.medicoId}/${pad6(opts.pacienteId)}_${slug}_${last4}`;
}

// Nome curto e ordenável p/ pasta da consulta: 20250918_1030_000123
export function consultaFolderName(consultaId: number, data: Date) {
  const y = data.getFullYear();
  const m = pad2(data.getMonth() + 1);
  const d = pad2(data.getDate());
  const hh = pad2(data.getHours());
  const mm = pad2(data.getMinutes());
  return `${y}${m}${d}_${hh}${mm}_${String(consultaId).padStart(6, "0")}`;
}

/** Sobe um .keep para "materializar" a pasta. (Node-friendly) */
export async function ensureFolder(path: string) {
  const keepPath = `${path}/.keep`;

  // já tem conteúdo?
  const { data, error: statErr } = await supabaseAdmin.storage.from(BUCKET).list(path, { limit: 1 });
  if (statErr) throw statErr;
  if (data && data.length > 0) return { ok: true, path };

  // usar Buffer garante compatibilidade em runtime Node (Next.js API)
  const buf = Buffer.from(".", "utf-8");
  const { error } = await supabaseAdmin.storage.from(BUCKET).upload(keepPath, buf, {
    upsert: false,
    contentType: "text/plain",
  });
  if (error && !/The resource already exists/i.test(error.message)) {
    throw error;
  }
  return { ok: true, path };
}

/** Cria (materializa) a subpasta da consulta dentro da pasta do paciente. */
export async function ensureConsultaFolder(opts: {
  medicoId: number;
  pacienteId: number;
  nome: string;
  cpf?: string | null;
  consultaId: number;
  data: Date;
}) {
  const root = patientFolderPath(opts);
  const folder = `${root}/${consultaFolderName(opts.consultaId, opts.data)}`;
  await ensureFolder(folder);
  return folder;
}

/** Upload simples (texto). */
export async function uploadTextFile(fullPath: string, content: string) {
  const buf = Buffer.from(content, "utf-8");
  const { error } = await supabaseAdmin.storage.from(BUCKET).upload(fullPath, buf, {
    upsert: true,
    contentType: "text/plain; charset=utf-8",
  });
  if (error) throw error;
  return { ok: true, path: fullPath };
}

/** Lista conteúdo de uma pasta (filtra .keep) */
export async function listDir(prefix: string) {
  const path = prefix.replace(/^\/+/, "").replace(/\/+$/, "");

  const { data, error } = await supabaseAdmin
    .storage
    .from(BUCKET)
    .list(path, { limit: 1000, sortBy: { column: "name", order: "asc" } });

  if (error) throw error;

  const entries = (data ?? [])
    .filter((it: any) => it.name !== ".keep")
    .map((it: any) => ({
      name: it.name as string,
      isFolder: !it.metadata,
      size: it.metadata?.size ?? 0,
      updatedAt: it.updated_at ?? it.created_at ?? null,
    }));

  return {
    folders: entries.filter(e => e.isFolder).map(e => e.name),
    files: entries.filter(e => !e.isFolder).map(e => e.name),
    raw: entries,
    path,
  };
}

/** Remove recursivamente QUALQUER pasta no bucket (consulta/paciente/etc). */
export async function rmRecursive(prefix: string) {
  const root = prefix.replace(/^\/+/, "").replace(/\/+$/, "");

  async function listAll(dir: string): Promise<string[]> {
    const { data, error } = await supabaseAdmin.storage.from(BUCKET).list(dir, { limit: 1000 });
    if (error) throw error;
    if (!data?.length) return [];

    const paths: string[] = [];
    for (const item of data) {
      const full = `${dir}/${item.name}`;
      if ((item as any).metadata) {
        // arquivo
        paths.push(full);
      } else {
        // subpasta -> descer
        paths.push(...await listAll(full));
      }
    }
    return paths;
  }

  const files = await listAll(root);
  if (!files.length) return { ok: true, deleted: 0 };

  const { error: delErr } = await supabaseAdmin.storage.from(BUCKET).remove(files);
  if (delErr) throw delErr;

  return { ok: true, deleted: files.length };
}
