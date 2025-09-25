"use client";

import { useEffect, useState } from "react";

/** Tipos */
type BusyBlock = {
  inicio: string;
  fim: string;
  origem: "evento" | "ausencia";
  refId?: number;
};
type PatientLite = { id: number; nome: string };
type Horario = { id: number; weekday: number; startMin: number; endMin: number };

/** Textos para motivos de conflito */
const REASONS_PT: Record<string, string> = {
  outside_hours: "Fora do horário configurado do médico",
  crosses_midnight: "Cruza a meia-noite (não permitido no MVP)",
  in_absence: "Dentro de uma ausência/bloqueio",
  overlap_busy: "Sobrepõe evento existente",
};

/** Helpers */
function toISO(dateStr: string, timeStr: string) {
  const d = new Date(`${dateStr}T${timeStr}:00`);
  return d.toISOString();
}
function asLocal(dt: string) {
  const d = new Date(dt);
  return d.toLocaleString();
}
function mmToHHMM(m: number) {
  const h = Math.floor(m / 60).toString().padStart(2, "0");
  const mi = (m % 60).toString().padStart(2, "0");
  return `${h}:${mi}`;
}
const WD_PT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

/** soma 30 minutos ao horário local informado (date + hh:mm) e retorna ISO */
function endISOPlus30(dateStr: string, timeStr: string) {
  const start = new Date(`${dateStr}T${timeStr}:00`);
  const end = new Date(start.getTime() + 30 * 60 * 1000);
  return end.toISOString();
}

/** --------- Componente principal --------- */
export default function AgendaTester({ medicoId }: { medicoId: number }) {
  // estado de pacientes e horários
  const [patients, setPatients] = useState<PatientLite[]>([]);
  const [patientId, setPatientId] = useState<string>("");
  const [horarios, setHorarios] = useState<Horario[]>([]);
  const [horMsg, setHorMsg] = useState<string | null>(null);

  // estado do formulário de agendamento
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [start, setStart] = useState("");
  const [loading, setLoading] = useState(false);

  // respostas
  const [resp, setResp] = useState<{
    status?: number;
    conflict?: boolean;
    reasons?: string[];
    busy?: BusyBlock[];
    error?: string;
  } | null>(null);
  const [createMsg, setCreateMsg] = useState<string | null>(null);

  /** Carrega horários do médico */
  async function loadHorarios() {
    try {
      const r = await fetch("/api/medico/horario");
      const j = await r.json();
      setHorarios(j?.horarios ?? []);
    } catch (e) {
      console.error("Erro listando horários:", e);
    }
  }

  /** Carrega pacientes e horários ao montar */
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/medico/pacientes/list");
        const json = await r.json();
        setPatients(json?.pacientes ?? []);
      } catch (e) {
        console.error("Erro listando pacientes:", e);
      }
      await loadHorarios();
    })();
  }, []);

  /** Preenche título automático */
  function autoTitleIfEmpty(nextPatientId: string) {
    if (!title.trim()) {
      const p = patients.find((x) => String(x.id) === nextPatientId);
      if (p) setTitle(`Consulta — ${p.nome}`);
    }
  }

  /** Cria horário padrão Seg–Sex 09:00–17:00 (substitui) */
  async function createDefaultHours() {
    setHorMsg(null);
    try {
      const r = await fetch("/api/medico/horario", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          weekdays: [1, 2, 3, 4, 5],
          start: "09:00",
          end: "17:00",
          replace: true,
        }),
      });
      const j = await r.json();
      if (r.status === 201) {
        setHorMsg(`Horário criado/atualizado (criados: ${j.created})`);
        setHorarios(j.horarios ?? []);
      } else {
        setHorMsg(`Erro ao salvar: ${j?.error ?? r.statusText}`);
      }
    } catch (e: any) {
      setHorMsg(`Erro: ${String(e)}`);
    }
  }

  /** Verificar disponibilidade (fim = início + 30 min) */
  async function checkAvailability() {
    setCreateMsg(null);
    if (!date || !start) {
      alert("Preencha data e início.");
      return;
    }
    setLoading(true);
    setResp(null);
    try {
      const body = {
        medicoId,
        start: toISO(date, start),
        end: endISOPlus30(date, start),
      };
      const r = await fetch("/api/calendar/freebusy", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await r.json();
      setResp({ status: r.status, ...json });
    } catch (e: any) {
      setResp({ error: String(e) });
    } finally {
      setLoading(false);
    }
  }

  /** Criar consulta (30 min) e sincronizar com Agenda */
  async function createConsulta() {
    setCreateMsg(null);
    if (!patientId) {
      alert("Selecione um paciente.");
      return;
    }
    if (!date || !start) {
      alert("Preencha Data e Início.");
      return;
    }
    setLoading(true);
    try {
      // valor no formato do input datetime-local
      const dataLocal = `${date}T${start}`;
      const body = { pacienteId: Number(patientId), data: dataLocal };

      const r = await fetch("/api/medico/consultas/novo", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await r.json();

      if (r.status === 201) {
        setCreateMsg(`Consulta criada (#${json.id})`);
        // avisa a lista de próximos eventos pra recarregar
        window.dispatchEvent(new CustomEvent("agenda:refresh"));
        await checkAvailability(); // feedback visual da disponibilidade/ocupações
      } else {
        setCreateMsg(`Erro: ${json?.error ?? r.statusText}`);
      }
    } catch (e: any) {
      setCreateMsg(`Erro: ${String(e)}`);
    } finally {
      setLoading(false);
    }
  }

  /** UI */
  return (
    <section className="space-y-6">
      {/* Disponibilidade */}
      <div className="p-3 border rounded">
        <div className="flex items-center justify-between">
          <div className="font-medium">Disponibilidade do médico</div>
          <button
            onClick={createDefaultHours}
            className="bg-gray-800 text-white px-3 py-1.5 rounded"
          >
            Criar horário padrão (Seg–Sex 09:00–17:00)
          </button>
        </div>
        {horMsg && <div className="text-sm mt-2">{horMsg}</div>}

        <ul className="mt-3 text-sm">
          {horarios.length === 0 ? (
            <li className="text-gray-600">Nenhum horário configurado.</li>
          ) : (
            horarios.map((h) => (
              <li key={h.id}>
                {WD_PT[h.weekday]} · {mmToHHMM(h.startMin)} — {mmToHHMM(h.endMin)}
              </li>
            ))
          )}
        </ul>
      </div>

      {/* Agendar */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        <div className="flex flex-col gap-1 md:col-span-2">
          <label className="text-sm">Paciente</label>
          <select
            value={patientId}
            onChange={(e) => {
              setPatientId(e.target.value);
              autoTitleIfEmpty(e.target.value);
            }}
            className="border rounded px-3 py-2"
          >
            <option value="">— selecione —</option>
            {patients.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1 md:col-span-3">
          <label className="text-sm">Título</label>
          <input
            type="text"
            placeholder="Ex.: Consulta clínica"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="border rounded px-3 py-2"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm">Data</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="border rounded px-3 py-2"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm">Início</label>
          <input
            type="time"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="border rounded px-3 py-2"
          />
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={checkAvailability}
          disabled={loading}
          className="bg-blue-primary text-white px-4 py-2 rounded disabled:opacity-50"
        >
          {loading ? "Verificando..." : "Verificar disponibilidade"}
        </button>
        <button
          onClick={createConsulta}
          disabled={loading}
          className="bg-green-600 text-white px-4 py-2 rounded disabled:opacity-50"
        >
          {loading ? "Criando..." : "Criar consulta (30 min)"}
        </button>
      </div>

      {createMsg && (
        <div className="p-3 border rounded bg-gray-50 text-sm">{createMsg}</div>
      )}

      {resp && (
        <div className="mt-4 space-y-3">
          {resp.error && (
            <div className="p-3 border border-red-300 rounded bg-red-50">
              Erro: {resp.error}
            </div>
          )}

          {!resp.error && (
            <>
              <div
                className={`p-3 rounded ${
                  resp.conflict
                    ? "border border-red-300 bg-red-50"
                    : "border border-green-300 bg-green-50"
                }`}
              >
                <div className="font-medium">
                  {resp.conflict ? "Conflito" : "Disponível"}
                </div>
                {resp.reasons && resp.reasons.length > 0 && (
                  <ul className="list-disc ml-5 text-sm mt-1">
                    {resp.reasons.map((r) => (
                      <li key={r}>{REASONS_PT[r] ?? r}</li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="p-3 border rounded">
                <div className="font-medium mb-2">Ocupações no período</div>
                {!resp.busy || resp.busy.length === 0 ? (
                  <div className="text-sm text-gray-600">Nenhuma.</div>
                ) : (
                  <ul className="space-y-1">
                    {resp.busy.map((b, idx) => (
                      <li key={idx} className="text-sm">
                        <span className="font-mono">{asLocal(b.inicio)}</span>
                        {" — "}
                        <span className="font-mono">{asLocal(b.fim)}</span>
                        {" · "}
                        <span className="uppercase">{b.origem}</span>
                        {typeof b.refId === "number" ? ` (#${b.refId})` : ""}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Próximos eventos */}
      <UpcomingEvents />
    </section>
  );
}

/** --------- Subcomponentes: lista e ações --------- */
function UpcomingEvents() {
  const [items, setItems] = useState<
    {
      id: number;
      titulo: string;
      inicio: string;
      fim: string;
      paciente?: { id: number; nome: string };
    }[]
  >([]);
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    const r = await fetch("/api/calendar/events/upcoming?days=14", {
      cache: "no-store",
    });
    const j = await r.json();
    setItems(j?.eventos ?? []);
  }

  useEffect(() => {
    load();
    const h = () => load();
    // escuta eventos de “refresh” da agenda
    window.addEventListener("agenda:refresh", h);
    return () => window.removeEventListener("agenda:refresh", h);
  }, []);

  async function cancel(id: number) {
    setMsg(null);
    const r = await fetch(`/api/calendar/events/${id}`, { method: "DELETE" });
    if (r.ok) {
      setMsg(`Evento #${id} cancelado.`);
      await load();
    } else {
      const j = await r.json().catch(() => ({}));
      setMsg(`Erro ao cancelar: ${j?.error ?? r.statusText}`);
    }
  }

  async function reschedule(id: number, date: string, start: string, end: string) {
    setMsg(null);
    if (!date || !start || !end) {
      alert("Informe data, início e fim.");
      return;
    }
    const body = { inicio: toISO(date, start), fim: toISO(date, end) };
    const r = await fetch(`/api/calendar/events/${id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const j = await r.json().catch(() => ({}));
    if (r.ok) {
      setMsg(`Evento #${id} reagendado.`);
      await load();
    } else if (r.status === 409) {
      setMsg(
        `Conflito: ${Array.isArray(j.reasons) ? j.reasons.join(", ") : "ocupado"}`
      );
    } else {
      setMsg(`Erro ao reagendar: ${j?.error ?? r.statusText}`);
    }
  }

  return (
    <div className="p-3 border rounded">
      <div className="font-medium mb-2">Próximos eventos (14 dias)</div>
      {msg && <div className="text-sm mb-2">{msg}</div>}
      {items.length === 0 ? (
        <div className="text-sm text-gray-600">Nenhum evento.</div>
      ) : (
        <ul className="space-y-3">
          {items.map((ev) => (
            <li key={ev.id} className="border rounded p-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="font-medium">
                    #{ev.id} · {ev.titulo}
                    {ev.paciente ? ` · ${ev.paciente.nome}` : ""}
                  </div>
                  <div className="text-sm">
                    {asLocal(ev.inicio)} — {asLocal(ev.fim)}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => cancel(ev.id)}
                    className="bg-red-600 text-white px-3 py-1.5 rounded"
                  >
                    Cancelar
                  </button>
                  <Rescheduler onSave={(d, s, e) => reschedule(ev.id, d, s, e)} />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Rescheduler({
  onSave,
}: {
  onSave: (date: string, start: string, end: string) => void;
}) {
  const [d, setD] = useState("");
  const [s, setS] = useState("");
  const [e, setE] = useState("");
  return (
    <div className="flex items-center gap-2">
      <input
        type="date"
        value={d}
        onChange={(ev) => setD(ev.target.value)}
        className="border rounded px-2 py-1"
      />
      <input
        type="time"
        value={s}
        onChange={(ev) => setS(ev.target.value)}
        className="border rounded px-2 py-1"
      />
      <input
        type="time"
        value={e}
        onChange={(ev) => setE(ev.target.value)}
        className="border rounded px-2 py-1"
      />
      <button
        onClick={() => onSave(d, s, e)}
        className="bg-gray-700 text-white px-3 py-1.5 rounded"
      >
        Salvar
      </button>
    </div>
  );
}
