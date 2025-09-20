"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Status = "ABERTA" | "CONCLUIDA" | "CANCELADA" | "FALTOU" | "REMARCADA";

export default function Editor({
  id,
  defaultDate,
  defaultStatus,
}: {
  id: number;
  defaultDate: string; // "YYYY-MM-DDTHH:mm" (local)
  defaultStatus: Status;
}) {
  const router = useRouter();

  const [dateValue, setDateValue] = useState(defaultDate);
  const [status, setStatus] = useState<Status>(defaultStatus);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function save(partial?: { date?: string; status?: Status }) {
    setSaving(true);
    setMsg(null);
    try {
      const body: any = {};
      body.data = (partial?.date ?? dateValue) || undefined;   // << envia 'data'
      body.status = (partial?.status ?? status) || undefined;  // << e 'status'

      const r = await fetch(`/api/medico/consultas/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await r.json();

      if (!r.ok) {
        setMsg(j?.error ?? r.statusText);
        return;
      }

      setMsg("Alterações salvas.");
      // Recarrega os dados da página (e mantém no mesmo card)
      router.refresh();
    } catch (e: any) {
      setMsg(String(e));
    } finally {
      setSaving(false);
    }
  }

  async function del() {
    if (!confirm("Tem certeza que deseja excluir esta consulta?")) return;
    setSaving(true);
    try {
      const r = await fetch(`/api/medico/consultas/${id}`, { method: "DELETE" });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        alert(j?.error ?? r.statusText);
        return;
      }
      // volta para a lista
      router.push("/medico/consultas");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      {msg && (
        <div className="text-sm text-green-700">{msg}</div>
      )}

      <label className="block text-sm font-medium">
        Data/Hora (30 min padrão)
      </label>
      <div className="flex gap-2 items-center">
        <input
          type="datetime-local"
          value={dateValue}
          onChange={(e) => setDateValue(e.target.value)}
          className="border rounded px-3 py-2 w-64"
        />
      </div>

      <label className="block text-sm font-medium mt-2">Status</label>
      <select
        value={status}
        onChange={(e) => setStatus(e.target.value as Status)}
        className="border rounded px-3 py-2"
      >
        <option value="ABERTA">ABERTA</option>
        <option value="CONCLUIDA">CONCLUÍDA</option>
        <option value="CANCELADA">CANCELADA</option>
        <option value="FALTOU">FALTOU</option>
        <option value="REMARCADA">REMARCADA</option>
      </select>

      <div className="flex flex-wrap gap-2 mt-3">
        <button
          onClick={() => save()}
          disabled={saving}
          className="bg-blue-600 text-white px-3 py-2 rounded disabled:opacity-50"
        >
          {saving ? "Salvando..." : "Salvar alterações"}
        </button>

        <button
          onClick={() => save({ status: "CONCLUIDA" })}
          disabled={saving}
          className="px-3 py-2 rounded border"
        >
          Marcar atendida
        </button>

        <button
          onClick={() => save({ status: "FALTOU" })}
          disabled={saving}
          className="px-3 py-2 rounded border"
        >
          Marcar falta
        </button>

        <button
          onClick={() => save({ status: "REMARCADA" })}
          disabled={saving}
          className="px-3 py-2 rounded border"
        >
          Marcar remarcada
        </button>

        <button
          onClick={del}
          disabled={saving}
          className="bg-red-600 text-white px-3 py-2 rounded disabled:opacity-50 ml-auto"
        >
          Excluir consulta
        </button>
      </div>

      <p className="text-xs text-gray-600 mt-2">
        • Ao salvar com nova data/hora, o evento da agenda é criado/atualizado automaticamente
        (30 min).<br />
        • Conflitos são checados (horário do médico, ausências e sobreposição).
      </p>
    </div>
  );
}
