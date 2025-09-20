"use client";

import { useState } from "react";

type Status = "ABERTA" | "CONCLUIDA" | "CANCELADA" | "FALTOU" | "REMARCADA";

export default function Editor({
  id,
  defaultDate,
  defaultStatus,
}: {
  id: number;
  defaultDate: string; // yyyy-MM-ddTHH:mm
  defaultStatus: Status;
}) {
  const STATUS_OPS: Status[] = ["ABERTA", "CONCLUIDA", "CANCELADA", "FALTOU", "REMARCADA"];

  const [dt, setDt] = useState(defaultDate);
  const [st, setSt] = useState<Status>(defaultStatus);
  const [saving, setSaving] = useState(false);

  async function salvar() {
    setSaving(true);
    const r = await fetch(`/api/medico/consultas/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: dt, status: st }),
    });
    setSaving(false);
    if (r.ok) {
      alert("Consulta atualizada");
    } else {
      const j = await r.json().catch(() => ({}));
      alert(j?.error || "Falha ao atualizar");
    }
  }

  return (
    <>
      <div className="space-y-1">
        <label className="block text-sm font-medium">Data/Hora</label>
        <input
          type="datetime-local"
          className="border rounded w-full p-2"
          value={dt}
          onChange={(e) => setDt(e.target.value)}
        />
      </div>

      <div className="space-y-1">
        <label className="block text-sm font-medium">Status</label>
        <select
          className="border rounded w-full p-2"
          value={st}
          onChange={(e) => setSt(e.target.value as Status)}
        >
          {STATUS_OPS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <div className="text-xs">
          • <b>CONCLUIDA</b>: paciente atendido<br />
          • <b>FALTOU</b>: não compareceu<br />
          • <b>REMARCADA</b>: reagendada (altere a data)
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={salvar}
          disabled={saving}
          className="px-3 py-2 rounded bg-blue-600 text-white disabled:opacity-60"
        >
          {saving ? "Salvando..." : "Salvar alterações"}
        </button>

        <button onClick={() => setSt("CONCLUIDA")} className="px-3 py-2 rounded border">
          Marcar atendida
        </button>
        <button onClick={() => setSt("FALTOU")} className="px-3 py-2 rounded border">
          Marcar falta
        </button>
        <button onClick={() => setSt("REMARCADA")} className="px-3 py-2 rounded border">
          Marcar remarcada
        </button>
      </div>
    </>
  );
}
