"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type FileRow = {
  name: string;
};

type Props = {
  /** caminho completo da PASTA da consulta no bucket (ex.: 31/000030_daniel-.../20250919_0900_000045) */
  folderPath: string;
  /** lista de nomes de arquivos (sem caminho) */
  files: string[];
};

/** ícone por extensão simples */
function iconFor(name: string) {
  const n = name.toLowerCase();
  if (n.endsWith(".txt")) return "📄";
  if (n.endsWith(".webm") || n.endsWith(".mp3") || n.endsWith(".wav")) return "🎧";
  return "📦";
}

export default function Explorer({ folderPath, files }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const rows: FileRow[] = useMemo(
    () => (files || []).map((name) => ({ name })),
    [files]
  );

  const openFile = useCallback(async (name: string) => {
    try {
      const urlRes = await fetch(
        `/api/storage/signed-url?path=${encodeURIComponent(`${folderPath}/${name}`)}`
      );
      const { url } = await urlRes.json();
      if (!url) throw new Error("signed url vazio");
      // abre em nova aba para preview (sem forçar download)
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      alert("Falha ao abrir arquivo.");
      console.error(e);
    }
  }, [folderPath]);

  const downloadFile = useCallback(async (name: string) => {
    try {
      const urlRes = await fetch(
        `/api/storage/signed-url?path=${encodeURIComponent(`${folderPath}/${name}`)}&download=${encodeURIComponent(name)}`
      );
      const { url } = await urlRes.json();
      if (!url) throw new Error("signed url vazio");
      window.location.href = url; // dispara download
    } catch (e) {
      alert("Falha ao gerar download.");
      console.error(e);
    }
  }, [folderPath]);

  const deleteFile = useCallback(async (name: string) => {
    if (!confirm(`Excluir "${name}"?`)) return;
    setBusy(true);
    try {
      const res = await fetch("/api/storage/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: `${folderPath}/${name}` }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "Delete failed");
      router.refresh();
    } catch (e) {
      alert("Falha ao excluir.");
      console.error(e);
    } finally {
      setBusy(false);
    }
  }, [folderPath, router]);

  const onPickFiles = useCallback(async (ev: React.ChangeEvent<HTMLInputElement>) => {
    const files = ev.target.files;
    if (!files || files.length === 0) return;

    setBusy(true);
    try {
      // envia em sequência (mantém simples). Se preferir, pode fazer Promise.all.
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append("path", folderPath);   // sua rota espera "path" (pasta)
        fd.append("file", file);         // e "file"
        const res = await fetch("/api/storage/upload", { method: "POST", body: fd });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j?.error || `Falha ao enviar ${file.name}`);
        }
      }
      router.refresh();
    } catch (e) {
      alert((e as Error).message || "Falha no upload.");
      console.error(e);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }, [folderPath, router]);

  const triggerPicker = () => inputRef.current?.click();

  return (
    <div className="border rounded divide-y min-h-[52px]">
      {/* toolbar */}
      <div className="px-3 py-2 flex items-center gap-2">
        <button
          onClick={triggerPicker}
          disabled={busy}
          className="px-3 py-1 border rounded disabled:opacity-50"
          title="Enviar arquivos para esta consulta"
        >
          ⬆️ Upload (vários)
        </button>
        {busy && <span className="text-sm text-gray-500">Processando…</span>}
        <input
          ref={inputRef}
          type="file"
          multiple
          hidden
          onChange={onPickFiles}
        />
      </div>

      {/* lista */}
      {rows.length === 0 ? (
        <div className="px-3 py-2 text-sm text-gray-600">Sem arquivos.</div>
      ) : (
        rows.map(({ name }) => (
          <div key={name} className="px-3 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span aria-hidden>{iconFor(name)}</span>
              <span className="text-sm break-all">{name}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => openFile(name)}
                className="px-2 py-1 text-sm border rounded"
                title="Visualizar"
              >
                👁️
              </button>
              <button
                onClick={() => downloadFile(name)}
                className="px-2 py-1 text-sm border rounded"
                title="Download"
              >
                ⬇️
              </button>
              <button
                onClick={() => deleteFile(name)}
                className="px-2 py-1 text-sm border rounded text-red-700"
                title="Excluir"
              >
                🗑️
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
