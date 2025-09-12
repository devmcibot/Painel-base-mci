"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function NovaConsultaPage() {
  const [pacientes, setPacientes] = useState<any[]>([]);
  const [pacienteId, setPacienteId] = useState<string>("");
  const [data, setData] = useState<string>("");
  const router = useRouter();

  useEffect(() => {
    fetch("/api/medico/pacientes")
      .then(r => r.json())
      .then(setPacientes)
      .catch(() => setPacientes([]));
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/medico/consultas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pacienteId, data }),
    });
    if (res.ok) {
      const nova = await res.json();
      router.push(`/medico/consultas/${nova.id}`);
    } else {
      alert("Erro ao criar consulta");
    }
  }

  return (
    <main className="p-6 max-w-2xl space-y-4">
      <div>
        <a className="underline" href="/medico/consultas">&larr; Voltar</a>
      </div>

      <h1 className="text-2xl font-semibold">Nova consulta</h1>
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Paciente</label>
          <select
            className="border rounded w-full p-2"
            value={pacienteId}
            onChange={(e) => setPacienteId(e.target.value)}
            required
          >
            <option value="">Selecione...</option>
            {pacientes.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome} {p.cpf ? `— ${p.cpf}` : ""}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Data e hora</label>
          <input
            type="datetime-local"
            className="border rounded w-full p-2"
            value={data}
            onChange={(e) => setData(e.target.value)}
            required
          />
        </div>

        <div className="flex gap-2">
          <button className="px-3 py-2 rounded bg-blue-600 text-white" type="submit">
            Criar
          </button>
        </div>
      </form>
    </main>
  );
}
