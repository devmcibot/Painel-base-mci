"use client";
import { useState } from "react";
import Call from "./Call";

export default function TeleForm() {
  const [pacienteId, setPacienteId] = useState<number | null>(null);
  const [consultaId, setConsultaId] = useState<number | null>(null);

  const [start, setStart] = useState(false);

  if (start && pacienteId && consultaId) {
    return <Call pacienteId={pacienteId} consultaId={consultaId} />;
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="text-sm">Paciente ID</label>
        <input className="border rounded px-3 py-2 ml-2 w-40"
               type="number"
               onChange={e => setPacienteId(Number(e.target.value)||null)} />
      </div>
      <div>
        <label className="text-sm">Consulta ID</label>
        <input className="border rounded px-3 py-2 ml-2 w-40"
               type="number"
               onChange={e => setConsultaId(Number(e.target.value)||null)} />
      </div>
      <button
        className="rounded bg-black text-white px-4 py-2 disabled:opacity-50"
        disabled={!pacienteId || !consultaId}
        onClick={() => setStart(true)}
      >
        Iniciar Tele-Consulta
      </button>
      <p className="text-xs text-gray-500">Depois integramos com os selects reais de Paciente/Consulta.</p>
    </div>
  );
}
