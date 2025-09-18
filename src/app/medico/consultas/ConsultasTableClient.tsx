"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

type Row = {
  id: number;
  data: string; // ISO
  status: string;
  paciente: string;
};

export default function ConsultasTableClient({ initialItems }: { initialItems: Row[] }) {
  const [rows, setRows] = useState<Row[]>(initialItems);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [msg, setMsg] = useState<string | null>(null);
  const allSelected = useMemo(() => rows.length > 0 && selected.size === rows.length, [rows, selected]);

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
      setSelected(new Set());
    } else {
      setSelected(new Set(rows.map((r) => r.id)));
    }
  }

  async function bulkDelete() {
    if (selected.size === 0) return;
    const ids = Array.from(selected);
    const ok = confirm(`Excluir ${ids.length} consulta(s)? Esta ação não pode ser desfeita.`);
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
      setMsg(`Excluídas: ${j.deleted}${j.removedEvents ? ` · Eventos removidos: ${j.removedEvents}` : ""}`);
    } catch (e: any) {
      setMsg(String(e));
    }
  }

  return (
    <div className="border rounded overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-gray-50">
        <div className="text-sm">
          {selected.size > 0 ? `${selected.size} selecionada(s)` : "Nenhuma seleção"}
          {msg ? ` — ${msg}` : ""}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={bulkDelete}
            disabled={selected.size === 0}
            className="px-3 py-1.5 rounded bg-red-600 text-white disabled:opacity-50"
          >
            Excluir selecionadas
          </button>
        </div>
      </div>

      <table className="w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="p-3 w-10">
              <input type="checkbox" checked={allSelected} onChange={(e) => toggleAll(e.target.checked)} />
            </th>
            <th className="p-3 text-left">Data/Hora</th>
            <th className="p-3 text-left">Paciente</th>
            <th className="p-3 text-left">Status</th>
            <th className="p-3 text-left">Ações</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.id} className="border-t">
              <td className="p-3 text-center">
                <input
                  type="checkbox"
                  checked={selected.has(c.id)}
                  onChange={(e) => toggleOne(c.id, e.target.checked)}
                />
              </td>
              <td className="p-3">{new Date(c.data).toLocaleString()}</td>
              <td className="p-3">{c.paciente}</td>
              <td className="p-3">{c.status}</td>
              <td className="p-3">
                <Link href={`/medico/consultas/${c.id}`} className="text-blue-700 underline">
                  abrir
                </Link>
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td className="p-3" colSpan={5}>
                Nenhuma consulta ainda.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
