"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

type PatientRow = {
  id: number;
  nome: string;
  cpf: string | null;
  telefone: string | null;
  email: string | null;
  nascimento: Date | null;
};

type Props = { items: PatientRow[] };

export default function PatientsTableClient({ items }: Props) {
  const [selected, setSelected] = useState<number[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  // Filtra por nome (case-insensitive)
  const filteredItems = useMemo(() => {
    if (!searchQuery) return items;
    return items.filter((p) =>
      p.nome.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [items, searchQuery]);

  const allFilteredIds = useMemo(() => filteredItems.map((p) => p.id), [filteredItems]);
  const allSelected =
    filteredItems.length > 0 && selected.length === filteredItems.length;

  function toggleOne(id: number) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function toggleAll() {
    setSelected((prev) =>
      prev.length === filteredItems.length ? [] : allFilteredIds
    );
  }

  async function bulkDelete() {
    if (selected.length === 0) return;
    const ok = confirm(
      `Excluir ${selected.length} paciente(s)? Esta ação remove também seus arquivos e consultas.`
    );
    if (!ok) return;
    const r = await fetch("/api/medico/pacientes/bulk-delete", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ids: selected }),
    });
    if (r.ok) {
      location.reload();
    } else {
      const j = await r.json().catch(() => ({}));
      alert(`Falha ao excluir: ${j?.error ?? r.statusText}`);
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 px-4 py-3 border-b border-gray-200">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Buscar por nome…"
          className="w-full sm:max-w-xs rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1E63F3] focus:border-[#1E63F3] bg-white"
        />

        <div className="flex items-center gap-3">
          <div className="text-sm text-gray-600">
            {selected.length === 0
              ? "Nenhuma seleção"
              : `${selected.length} selecionado(s)`}
          </div>
          <button
            onClick={bulkDelete}
            disabled={selected.length === 0}
            className="px-3 py-2 rounded-lg text-sm bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Excluir selecionados
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
                  aria-label="Selecionar todos"
                  checked={allSelected}
                  onChange={toggleAll}
                  className="accent-[#1E63F3] cursor-pointer"
                />
              </th>
              <th className="p-3 text-left font-medium">ID</th>
              <th className="p-3 text-left font-medium">Nome</th>
              <th className="p-3 text-left font-medium">CPF</th>
              <th className="p-3 text-left font-medium">Telefone</th>
              <th className="p-3 text-left font-medium">E-mail</th>
              <th className="p-3 text-left font-medium">Nascimento</th>
              <th className="p-3 text-left font-medium">Ações</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-100">
            {filteredItems.map((p) => (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className="p-3">
                  <input
                    type="checkbox"
                    checked={selected.includes(p.id)}
                    onChange={() => toggleOne(p.id)}
                    className="accent-[#1E63F3] cursor-pointer"
                    aria-label={`Selecionar ${p.nome}`}
                  />
                </td>
                <td className="p-3 text-gray-700">{p.id}</td>
                <td className="p-3 font-medium text-gray-800">{p.nome}</td>
                <td className="p-3 text-gray-700">{p.cpf ?? "-"}</td>
                <td className="p-3 text-gray-700">{p.telefone ?? "-"}</td>
                <td className="p-3 text-gray-700">{p.email ?? "-"}</td>
                <td className="p-3 text-gray-700">
                  {p.nascimento
                    ? new Date(p.nascimento).toLocaleDateString("pt-BR")
                    : "-"}
                </td>
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/medico/pacientes/${p.id}`}
                      className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-[#1E63F3] hover:bg-gray-50"
                      title="Editar paciente"
                    >
                      Editar
                    </Link>
                    {/* exemplos futuros:
                    <button
                      type="button"
                      className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                      disabled
                      title="Gerar relatório (em breve)"
                    >
                      Relatório
                    </button>
                    */}
                  </div>
                </td>
              </tr>
            ))}

            {/* Estados vazios / sem resultado */}
            {items.length > 0 && filteredItems.length === 0 && (
              <tr>
                <td className="p-6 text-center text-gray-500" colSpan={8}>
                  Nenhum paciente encontrado com este nome.
                </td>
              </tr>
            )}
            {items.length === 0 && (
              <tr>
                <td className="p-6 text-center text-gray-500" colSpan={8}>
                  Nenhum paciente ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
