"use client";

import { useMemo, useState } from "react";

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
  // 1. Adicionar estado para o termo da busca
  const [searchQuery, setSearchQuery] = useState("");

  // 2. Filtrar os itens com base na busca. useMemo otimiza a performance.
  const filteredItems = useMemo(() => {
    // Se a busca estiver vazia, retorna todos os itens originais
    if (!searchQuery) {
      return items;
    }
    // Retorna apenas os itens cujo nome (em minúsculas) inclui o termo da busca
    return items.filter((patient) =>
      patient.nome.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [items, searchQuery]); // A lista é recalculada somente se `items` ou `searchQuery` mudarem

  // A lógica de "selecionar todos" agora deve se basear nos itens filtrados
  const allFilteredIds = useMemo(
    () => filteredItems.map((p) => p.id),
    [filteredItems]
  );
  const allSelected =
    filteredItems.length > 0 && selected.length === filteredItems.length;

  function toggleOne(id: number) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function toggleAll() {
    // A função toggleAll agora usa os IDs dos itens filtrados
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
    <div className="border rounded overflow-hidden">
      <div className="flex items-center justify-between gap-4 px-3 py-2 bg-gray-50 border-b">
        {/* 3. Adicionar o campo de input para a busca */}
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Buscar por nome..."
          className="border rounded px-3 py-1.5 text-sm w-full max-w-xs"
        />

        <div className="flex items-center gap-4">
          <div className="text-sm">
            {selected.length === 0
              ? "Nenhuma seleção"
              : `${selected.length} selecionado(s)`}
          </div>
          <button
            onClick={bulkDelete}
            disabled={selected.length === 0}
            className="px-3 py-1.5 rounded bg-red-500 text-white disabled:opacity-50"
          >
            Excluir selecionados
          </button>
        </div>
      </div>

      <table className="w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="p-3 w-10">
              <input
                type="checkbox"
                aria-label="Selecionar todos"
                checked={allSelected}
                onChange={toggleAll}
              />
            </th>
            <th className="p-3 text-left">ID</th>
            <th className="p-3 text-left">Nome</th>
            <th className="p-3 text-left">CPF</th>
            <th className="p-3 text-left">Telefone</th>
            <th className="p-3 text-left">E-mail</th>
            <th className="p-3 text-left">Nascimento</th>
            <th className="p-3 text-left">Ações</th>
          </tr>
        </thead>
        <tbody>
          {/* 4. Mapear sobre a lista filtrada (`filteredItems`) em vez de `items` */}
          {filteredItems.map((p) => (
            <tr key={p.id} className="border-t">
              <td className="p-3">
                <input
                  type="checkbox"
                  checked={selected.includes(p.id)}
                  onChange={() => toggleOne(p.id)}
                />
              </td>
              <td className="p-3">{p.id}</td>
              <td className="p-3">{p.nome}</td>
              <td className="p-3">{p.cpf ?? "-"}</td>
              <td className="p-3">{p.telefone ?? "-"}</td>
              <td className="p-3">{p.email ?? "-"}</td>
              <td className="p-3">
                {p.nascimento
                  ? new Date(p.nascimento).toLocaleDateString()
                  : "-"}
              </td>
              <td className="p-3">
                <a
                  className="text-blue-700 underline"
                  href={`/medico/pacientes/${p.id}`}
                >
                  editar
                </a>
              </td>
            </tr>
          ))}
          {/* 5. Mensagem para quando a busca não encontra resultados */}
          {items.length > 0 && filteredItems.length === 0 && (
            <tr>
              <td className="p-3 text-center" colSpan={8}>
                Nenhum paciente encontrado com este nome.
              </td>
            </tr>
          )}
          {items.length === 0 && (
            <tr>
              <td className="p-3 text-center" colSpan={8}>
                Nenhum paciente ainda.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
