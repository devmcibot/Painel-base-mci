"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

type FileRow = {
  name: string;
};

type Props = {
  /** caminho completo da PASTA da consulta no bucket (ex.: 31/000030_daniel-.../20250919_0900_000045) */
  folderPath: string;
  /** lista de nomes de arquivos (sem caminho) */
  files: string[];
};

/** formata data/hora a partir dos tokens do nome do arquivo */
function formatDateTimeFromTokens(dateStr?: string, timeStr?: string) {
  if (!dateStr || dateStr.length !== 8 || !timeStr || timeStr.length < 4) {
    return null;
  }

  const year = Number(dateStr.slice(0, 4));
  const month = Number(dateStr.slice(4, 6));
  const day = Number(dateStr.slice(6, 8));
  const hour = Number(timeStr.slice(0, 2));
  const minute = Number(timeStr.slice(2, 4));

  if (
    Number.isNaN(year) ||
    Number.isNaN(month) ||
    Number.isNaN(day) ||
    Number.isNaN(hour) ||
    Number.isNaN(minute)
  ) {
    return null;
  }

  const d = new Date(year, month - 1, day, hour, minute);
  if (Number.isNaN(d.getTime())) return null;

  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** monta um rótulo amigável pro arquivo */
function formatFileLabel(name: string) {
  const lower = name.toLowerCase();
  const base = lower.replace(/\.[^/.]+$/, ""); // remove extensão
  const parts = base.split("_");

  // anamnese texto:  anamnese_paciente_20251114_173059_0010.txt
  // anamnese áudio:  anamnese_paciente_e_20251114_173059_0010.webm
  if (lower.startsWith("anamnese_paciente_")) {
    const isAudio =
      lower.endsWith(".webm") ||
      lower.endsWith(".mp3") ||
      lower.endsWith(".wav");

    const dateStr = parts[parts.length - 3]; // 20251114
    const timeStr = parts[parts.length - 2]; // 173059
    const formatted = formatDateTimeFromTokens(dateStr, timeStr);

    const prefix = isAudio ? "Áudio da anamnese" : "Anamnese";

    if (formatted) return `${prefix} – ${formatted}`;
    return prefix;
  }

  // laudo_1763752168901.docx / .txt (timestamp em ms)
  if (lower.startsWith("laudo_")) {
    const tsStr = base.slice("laudo_".length);
    const tsNum = Number(tsStr);
    if (!Number.isNaN(tsNum)) {
      const d = new Date(tsNum);
      if (!Number.isNaN(d.getTime())) {
        const formatted = d.toLocaleString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
        return `Laudo – ${formatted}`;
      }
    }
    return "Laudo";
  }

  // fallback: mostra nome original
  return name;
}

/** componente de ícone por tipo de arquivo */
function FileIcon({ name }: { name: string }) {
  const lower = name.toLowerCase();

  // laudo -> ícone do Word (public/icons/wordicon.png)
  if (lower.startsWith("laudo_")) {
    return (
      <Image
        src="/icons/wordicon.png"
        alt="Laudo"
        width={18}
        height={18}
        className="inline-block"
      />
    );
  }

  // áudio
  if (
    lower.endsWith(".webm") ||
    lower.endsWith(".mp3") ||
    lower.endsWith(".wav")
  ) {
    return <span aria-hidden>🎧</span>;
  }

  // texto/anamnese/doc
  if (lower.endsWith(".txt") || lower.endsWith(".docx")) {
    return <span aria-hidden>📄</span>;
  }

  // genérico
  return <span aria-hidden>📦</span>;
}

/**
 * Extrai dados do paciente a partir do folderPath.
 *
 * Exemplo de folderPath:
 *   "2/000017_jose-carlos_8877/20251110_1000_000007"
 *
 * Estrutura:
 *   [0] = medicoId
 *   [1] = pacienteFolder => "000017_jose-carlos_8877"
 *   [2] = pasta da consulta
 */
function extractPacienteFromFolderPath(folderPath: string) {
  const parts = folderPath.split("/"); // ["2", "000017_jose-carlos_8877", "2025..."]
  if (parts.length < 2) {
    return { pacienteNome: "", cpfLast4: "", pacienteId: "" };
  }

  const pacientePart = parts[1]; // "000017_jose-carlos_8877"
  const sub = pacientePart.split("_"); // ["000017", "jose-carlos", "8877"]

  if (sub.length < 3) {
    return { pacienteNome: "", cpfLast4: "", pacienteId: "" };
  }

  const pacienteId = sub[0]; // "000017"
  const cpfLast4 = sub[sub.length - 1]; // "8877"
  const nomeSlug = sub.slice(1, -1).join("_"); // "jose-carlos"

  const nome = nomeSlug.replace(/-/g, " ");
  const pacienteNome = nome
    .split(" ")
    .filter(Boolean)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" "); // "Jose Carlos"

  return { pacienteNome, cpfLast4, pacienteId };
}

/** checa se é um arquivo de texto (anamnese) para liberar Laudo IA */
function isTextFile(name: string) {
  const n = name.toLowerCase();
  return n.endsWith(".txt");
}

export default function Explorer({ folderPath, files }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const rows: FileRow[] = useMemo(
    () => (files || []).map((name) => ({ name })),
    [files]
  );

  const pacienteInfo = useMemo(
    () => extractPacienteFromFolderPath(folderPath),
    [folderPath]
  );

  const openFile = useCallback(
    async (name: string) => {
      try {
        const urlRes = await fetch(
          `/api/storage/signed-url?path=${encodeURIComponent(
            `${folderPath}/${name}`
          )}`
        );
        const { url } = await urlRes.json();
        if (!url) throw new Error("signed url vazio");
        // abre em nova aba para preview (sem forçar download)
        window.open(url, "_blank", "noopener,noreferrer");
      } catch (e) {
        alert("Falha ao abrir arquivo.");
        console.error(e);
      }
    },
    [folderPath]
  );

  const downloadFile = useCallback(
    async (name: string) => {
      try {
        const urlRes = await fetch(
          `/api/storage/signed-url?path=${encodeURIComponent(
            `${folderPath}/${name}`
          )}&download=${encodeURIComponent(name)}`
        );
        const { url } = await urlRes.json();
        if (!url) throw new Error("signed url vazio");
        window.location.href = url; // dispara download
      } catch (e) {
        alert("Falha ao gerar download.");
        console.error(e);
      }
    },
    [folderPath]
  );

  const deleteFile = useCallback(
    async (name: string) => {
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
    },
    [folderPath, router]
  );

  /** chama a API de IA para gerar laudo a partir de um .txt */
  const generateLaudo = useCallback(
    async (name: string) => {
      if (!isTextFile(name)) {
        alert("O laudo só pode ser gerado a partir de arquivos .txt.");
        return;
      }

      setBusy(true);
      try {
        const res = await fetch("/api/ia/laudo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            path: `${folderPath}/${name}`,
            pacienteNome: pacienteInfo.pacienteNome,
            cpfLast4: pacienteInfo.cpfLast4,
            pacienteId: pacienteInfo.pacienteId,
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          console.error("Erro ao gerar laudo:", data);
          alert(data?.error || "Falha ao gerar laudo.");
          return;
        }

        alert("Laudo gerado com sucesso! Atualize a lista para vê-lo.");
        router.refresh();
      } catch (e) {
        console.error(e);
        alert("Erro inesperado ao gerar laudo.");
      } finally {
        setBusy(false);
      }
    },
    [folderPath, router, pacienteInfo]
  );

  const onPickFiles = useCallback(
    async (ev: React.ChangeEvent<HTMLInputElement>) => {
      const files = ev.target.files;
      if (!files || files.length === 0) return;

      setBusy(true);
      try {
        for (const file of Array.from(files)) {
          const fd = new FormData();
          fd.append("path", folderPath); // sua rota espera "path" (pasta)
          fd.append("file", file); // e "file"
          const res = await fetch("/api/storage/upload", {
            method: "POST",
            body: fd,
          });
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
    },
    [folderPath, router]
  );

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
          <div
            key={name}
            className="px-3 py-2 flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <FileIcon name={name} />
              <span className="text-sm break-all" title={name}>
                {formatFileLabel(name)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {/* Visualizar */}
              <button
                onClick={() => openFile(name)}
                className="px-2 py-1 text-sm border rounded"
                title="Visualizar"
              >
                👁️
              </button>

              {/* Download */}
              <button
                onClick={() => downloadFile(name)}
                className="px-2 py-1 text-sm border rounded"
                title="Download"
              >
                ⬇️
              </button>

              {/* Laudo IA (somente para .txt) - botão pequeno só com ícone */}
              {isTextFile(name) && (
                <button
                  onClick={() => generateLaudo(name)}
                  className="px-2 py-1 text-xs border rounded text-blue-700"
                  title="Gerar laudo médico a partir desta anamnese"
                >
                  🤖
                </button>
              )}

              {/* Excluir */}
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
