"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type ConsultaItem = { id: number; data: string; pastaPath: string | null };
type PacienteItem = { id: number; nome: string; cpf: string | null; consultas: ConsultaItem[] };

export default function Explorer({ pacientes }: { pacientes: PacienteItem[] }) {
  const [pacienteId, setPacienteId] = useState<number | null>(null);
  const [consultaId, setConsultaId] = useState<number | null>(null);
  const [folderPath, setFolderPath] = useState<string>("");

  const [entries, setEntries] = useState<
    { name: string; path: string; type: "file" | "folder"; size: number | null }[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null); // ⬅️ novo
  const fileRef = useRef<HTMLInputElement>(null);

  const paciente = useMemo(
    () => pacientes.find((p) => p.id === pacienteId) || null,
    [pacienteId, pacientes]
  );
  const consulta = useMemo(
    () => paciente?.consultas.find((c) => c.id === consultaId) || null,
    [paciente, consultaId]
  );

  useEffect(() => {
    if (!paciente) {
      setConsultaId(null);
      setFolderPath("");
      setEntries([]);
      return;
    }
    if (paciente.consultas.length > 0) {
      setConsultaId(paciente.consultas[0].id);
    } else {
      setConsultaId(null);
      setFolderPath("");
      setEntries([]);
    }
  }, [paciente]);

  useEffect(() => {
    if (!consulta || !consulta.pastaPath) {
      setFolderPath("");
      setEntries([]);
      return;
    }
    setFolderPath(consulta.pastaPath);
  }, [consulta]);

  // 🔁 helper pra recarregar a lista
  async function refreshList() {
    if (!folderPath) return;
    const qs = new URLSearchParams({ path: folderPath });
    const r = await fetch(`/api/storage/list?${qs.toString()}`);
    const j = await r.json();
    setEntries(r.ok ? j.entries || [] : []);
  }

  useEffect(() => {
    (async () => {
      if (!folderPath) return;
      setLoading(true);
      try {
        await refreshList();
      } finally {
        setLoading(false);
      }
    })();
  }, [folderPath]);

  async function onClickUpload() {
    if (!folderPath) {
      alert("Selecione uma consulta com pasta válida para subir o arquivo.");
      return;
    }
    fileRef.current?.click();
  }

  async function onFilePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !folderPath) return;
    try {
      const fd = new FormData();
      fd.append("path", folderPath);
      fd.append("file", file);

      const res = await fetch("/api/storage/upload", { method: "POST", body: fd });
      const j = await res.json();
      if (!res.ok) {
        alert(j?.error || "Falha no upload");
        return;
      }
      await refreshList();
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  // 🔗 abrir em nova aba
  async function onOpen(path: string) {
    const qs = new URLSearchParams({ path });
    const r = await fetch(`/api/storage/signed-url?${qs.toString()}`);
    const j = await r.json();
    if (!r.ok || !j?.url) {
      alert(j?.error || "Falha ao gerar URL");
      return;
    }
    window.open(j.url, "_blank", "noopener,noreferrer");
  }

  // ⬇️ baixar
  async function onDownload(path: string, filename: string) {
    const qs = new URLSearchParams({ path });
    const r = await fetch(`/api/storage/signed-url?${qs.toString()}`);
    const j = await r.json();
    if (!r.ok || !j?.url) {
      alert(j?.error || "Falha ao gerar URL");
      return;
    }
    const a = document.createElement("a");
    a.href = j.url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  // 🗑️ excluir arquivo (não pasta; .keep já vem filtrado)
  async function onDeleteFile(path: string) {
    const name = path.split("/").pop() || "arquivo";
    if (!confirm(`Excluir "${name}"? Esta ação não pode ser desfeita.`)) return;

    try {
      setDeleting(path);
      const res = await fetch("/api/storage/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(j?.error || "Falha ao excluir");
        return;
      }
      await refreshList();
    } finally {
      setDeleting(null);
    }
  }

  function fmtBr(dtIso: string) {
    const d = new Date(dtIso);
    const data = d.toLocaleDateString("pt-BR");
    const hora = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    return `${data}, ${hora}`;
  }

  return (
    <div className="grid grid-cols-12 gap-6">
      {/* Pacientes */}
      <div className="col-span-3">
        <h2 className="font-semibold mb-2">Pacientes</h2>
        <div className="border rounded divide-y">
          {pacientes.map((p) => (
            <button
              key={p.id}
              onClick={() => setPacienteId(p.id)}
              className={`w-full text-left p-2 ${pacienteId === p.id ? "bg-gray-100" : ""}`}
            >
              <div className="font-medium">{p.nome}</div>
              <div className="text-xs text-gray-500">{p.cpf || "-"}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Consultas */}
      <div className="col-span-4">
        <h2 className="font-semibold mb-2">Consultas</h2>
        {paciente ? (
          paciente.consultas.length > 0 ? (
            <div className="border rounded divide-y">
              {paciente.consultas.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setConsultaId(c.id)}
                  className={`w-full text-left p-2 ${consultaId === c.id ? "bg-gray-100" : ""}`}
                >
                  <div className="font-medium">#{c.id} • {fmtBr(c.data)}</div>
                  <div className="text-xs text-gray-500">{c.pastaPath || "(sem pasta)"}</div>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">Sem consultas para este paciente.</p>
          )
        ) : (
          <p className="text-gray-500">Selecione um paciente.</p>
        )}
      </div>

      {/* Arquivos */}
      <div className="col-span-5">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold">Arquivos</h2>
          <button
            onClick={onClickUpload}
            className="px-3 py-1 rounded bg-black text-white"
            disabled={!folderPath}
          >
            Upload
          </button>
          <input ref={fileRef} type="file" className="hidden" onChange={onFilePicked} />
        </div>

        {!folderPath ? (
          <div className="border rounded p-3 text-gray-500">Selecione uma consulta.</div>
        ) : loading ? (
          <div className="border rounded p-3 text-gray-500">Carregando…</div>
        ) : entries.length === 0 ? (
          <div className="border rounded p-3 text-gray-500">Nenhum arquivo.</div>
        ) : (
          <ul className="border rounded divide-y">
            {entries.map((e) => (
              <li key={e.path} className="p-2 flex items-center gap-2">
                <span className="text-xs px-1 rounded border">
                  {e.type === "folder" ? "Pasta" : "Arquivo"}
                </span>
                <span className="truncate">{e.name}</span>

                {/* Ações: só para arquivos */}
                {e.type === "file" && (
                  <div className="ml-auto flex items-center gap-2">
                    <button
                      onClick={() => onOpen(e.path)}
                      className="px-2 py-1 text-sm border rounded hover:bg-gray-50"
                    >
                      Abrir
                    </button>
                    <button
                      onClick={() => onDownload(e.path, e.name)}
                      className="px-2 py-1 text-sm border rounded hover:bg-gray-50"
                    >
                      Baixar
                    </button>
                    <button
                      onClick={() => onDeleteFile(e.path)}
                      disabled={deleting === e.path}
                      className="px-2 py-1 text-sm border rounded text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      {deleting === e.path ? "Excluindo..." : "Excluir"}
                    </button>
                  </div>
                )}

                {e.size != null && e.type === "file" && (
                  <span className="text-xs text-gray-500">{e.size} bytes</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
