"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

type Row = {
  id: number;
  data: string; // ISO
  status: string;
  paciente: string;
};

export default function ConsultasTableClient({
  initialItems,
}: {
  initialItems: Row[];
}) {
  const [rows, setRows] = useState<Row[]>(initialItems);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [msg, setMsg] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // filtro por paciente
  const filteredRows = useMemo(() => {
    if (!searchQuery) return rows;
    return rows.filter((row) =>
      row.paciente.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [rows, searchQuery]);

  // selecionar tudo (somente os filtrados)
  const allSelected = useMemo(
    () => filteredRows.length > 0 && filteredRows.every((r) => selected.has(r.id)),
    [filteredRows, selected]
  );

  function toggleOne(id: number, checked: boolean) {
    setSelected((curr) => {
      const next = new Set(curr);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleAll(checked: boolean) {
    if (!checked) {
      const next = new Set(selected);
      filteredRows.forEach((row) => next.delete(row.id));
      setSelected(next);
    } else {
      const next = new Set(selected);
      filteredRows.forEach((row) => next.add(row.id));
      setSelected(next);
    }
  }

  async function bulkDelete() {
    if (selected.size === 0) return;
    const ids = Array.from(selected);
    const ok = confirm(
      `Excluir ${ids.length} consulta(s)? Esta ação não pode ser desfeita.`
    );
    if (!ok) return;

    setMsg(null);
    try {
      const r = await fetch("/api/medico/consultas/bulk-delete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const j = await r.json();
      if (!r.ok) {
        setMsg(j?.error ?? r.statusText);
        return;
      }
      // remove do estado
      setRows((curr) => curr.filter((x) => !selected.has(x.id)));
      setSelected(new Set());
      setMsg(
        `Excluídas: ${j.deleted}${
          j.removedEvents ? ` · Eventos removidos: ${j.removedEvents}` : ""
        }`
      );
    } catch (e: any) {
      setMsg(String(e));
    }
  }

  function fmtDateTime(iso: string) {
    const d = new Date(iso);
    return d.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function StatusBadge({ status }: { status: string }) {
    const s = status.toUpperCase();
    const styles =
      s === "ABERTA"
        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
        : s === "CONCLUIDA" || s === "CONCLUÍDA"
        ? "bg-gray-50 text-gray-700 border-gray-200"
        : s === "CANCELADA"
        ? "bg-rose-50 text-rose-700 border-rose-200"
        : "bg-indigo-50 text-indigo-700 border-indigo-200";
    return (
      <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium border ${styles}`}>
        {status}
      </span>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 px-4 py-3 border-b border-gray-200">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Buscar por paciente…"
          className="w-full md:max-w-xs rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1E63F3] focus:border-[#1E63F3] bg-white"
        />

        <div className="flex-1 text-sm text-center md:text-left text-gray-600">
          {selected.size > 0
            ? `${selected.size} selecionada(s)`
            : "Nenhuma seleção"}
          {msg ? ` — ${msg}` : ""}
        </div>

        <div className="flex items-center gap-2 justify-end">
          <button
            onClick={bulkDelete}
            disabled={selected.size === 0}
            className="px-3 py-2 rounded-lg text-sm bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Excluir selecionadas
          </button>
        </div>
      </div>

      {/* Tabela */}
      <div className="w-full overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="text-gray-600">
              <th className="p-3 w-10">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={(e) => toggleAll(e.target.checked)}
                  className="accent-[#1E63F3] cursor-pointer"
                  aria-label="Selecionar todas"
                />
              </th>
              <th className="p-3 text-left font-medium">Data/Hora</th>
              <th className="p-3 text-left font-medium">Paciente</th>
              <th className="p-3 text-left font-medium">Status</th>
              <th className="p-3 text-left font-medium">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredRows.map((c) => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="p-3 text-center">
                  <input
                    type="checkbox"
                    checked={selected.has(c.id)}
                    onChange={(e) => toggleOne(c.id, e.target.checked)}
                    className="accent-[#1E63F3] cursor-pointer"
                    aria-label={`Selecionar consulta ${c.id}`}
                  />
                </td>
                <td className="p-3 text-gray-800">{fmtDateTime(c.data)}</td>
                <td className="p-3 font-medium text-gray-900">{c.paciente}</td>
                <td className="p-3">
                  <StatusBadge status={c.status} />
                </td>
                <td className="p-3">
                  {/* Ações — visual pill consistente com o design MCI */}
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/medico/consultas/${c.id}`}
                      className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-[#1E63F3] hover:bg-gray-50"
                      title="Abrir consulta"
                    >
                      Abrir
                    </Link>
                    {/* Se quiser adicionar mais ações no futuro, seguem exemplos:
                    <button
                      type="button"
                      className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                      title="Reagendar (em breve)"
                      disabled
                    >
                      Reagendar
                    </button>
                    */}
                  </div>
                </td>
              </tr>
            ))}

            {/* Estados vazios */}
            {rows.length > 0 && filteredRows.length === 0 && (
              <tr>
                <td className="p-6 text-center text-gray-500" colSpan={5}>
                  Nenhuma consulta encontrada para este paciente.
                </td>
              </tr>
            )}
            {rows.length === 0 && (
              <tr>
                <td className="p-6 text-center text-gray-500" colSpan={5}>
                  Nenhuma consulta ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
