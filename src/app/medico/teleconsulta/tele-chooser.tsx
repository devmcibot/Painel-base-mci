// src/app/medico/teleconsulta/tele-chooser.tsx
"use client";

import { useMemo, useState, useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type PacienteOpt = { id: number; nome: string; cpf: string | null };
type ConsultaOpt = { id: number; dataISO: string };

export default function TeleChooser(props: {
  pacientes: PacienteOpt[];
  consultas: ConsultaOpt[];
  selectedPacienteId: number | null;
  selectedConsultaId: number | null;
}) {
  const { pacientes, consultas, selectedPacienteId, selectedConsultaId } = props;

  const [pacienteId, setPacienteId] = useState<number | null>(selectedPacienteId);
  const [consultaId, setConsultaId] = useState<number | null>(selectedConsultaId);

  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  // Atualiza a URL quando muda o paciente (e limpa consulta)
  useEffect(() => {
    if (pacienteId) {
      const params = new URLSearchParams(sp.toString());
      params.set("pacienteId", String(pacienteId));
      params.delete("consultaId");
      router.replace(`${pathname}?${params.toString()}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pacienteId]);

  // Atualiza a URL quando muda a consulta
  useEffect(() => {
    if (consultaId) {
      const params = new URLSearchParams(sp.toString());
      params.set("consultaId", String(consultaId));
      router.replace(`${pathname}?${params.toString()}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consultaId]);

  const consultasFmt = useMemo(
    () =>
      consultas.map((c) => ({
        id: c.id,
        label: new Date(c.dataISO).toLocaleString(),
      })),
    [consultas]
  );

  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm block mb-1">Paciente</label>
        <select
          className="border rounded px-3 py-2 min-w-[260px]"
          value={pacienteId ?? ""}
          onChange={(e) => setPacienteId(e.target.value ? Number(e.target.value) : null)}
        >
          <option value="">Selecione…</option>
          {pacientes.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome} {p.cpf ? `• ${p.cpf}` : ""}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-sm block mb-1">Consulta</label>
        <select
          className="border rounded px-3 py-2 min-w-[260px]"
          value={consultaId ?? ""}
          onChange={(e) => setConsultaId(e.target.value ? Number(e.target.value) : null)}
          disabled={!pacienteId}
        >
          <option value="">Selecione…</option>
          {consultasFmt.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      <button
        onClick={() => {
          if (pacienteId && consultaId) {
            const params = new URLSearchParams(sp.toString());
            params.set("pacienteId", String(pacienteId));
            params.set("consultaId", String(consultaId));
            router.replace(`${pathname}?${params.toString()}`);
            // A page server detecta e renderiza o <Call />
          }
        }}
        className="rounded bg-black text-white px-4 py-2 disabled:opacity-50"
        disabled={!pacienteId || !consultaId}
      >
        Iniciar Tele-Consulta
      </button>
    </div>
  );
}
