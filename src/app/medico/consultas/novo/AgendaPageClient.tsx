"use client";

import { useEffect, useMemo, useState } from "react";

/** =================== Tipos =================== */
type BusyBlock = {
  inicio: string;
  fim: string;
  origem: "evento" | "ausencia";
  refId?: number;
};
type PatientLite = { id: number; nome: string };
type Horario = { id: number; weekday: number; startMin: number; endMin: number };

const WD_PT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

/** =================== Helpers =================== */
function toISO(dateStr: string, timeStr: string) {
  return new Date(`${dateStr}T${timeStr}:00`).toISOString();
}
function asLocal(dt: string) {
  return new Date(dt).toLocaleString();
}
function mmToHHMM(m: number) {
  const h = String(Math.floor(m / 60)).padStart(2, "0");
  const mi = String(m % 60).padStart(2, "0");
  return `${h}:${mi}`;
}
function add30(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  const total = h * 60 + m + 30;
  const H = String(Math.floor(total / 60)).padStart(2, "0");
  const M = String(total % 60).padStart(2, "0");
  return `${H}:${M}`;
}

/** Motivos com mensagem amigável */
const REASONS_PT: Record<string, string> = {
  outside_hours: "Fora do horário de atendimento",
  crosses_midnight: "Cruza a meia-noite (não permitido)",
  in_absence: "Dentro de uma ausência/bloqueio",
  overlap_busy: "Sobrepõe evento existente",
};
function friendlyConflict(reasons?: string[]) {
  if (!reasons || reasons.length === 0) return "Conflito de agenda.";
  if (reasons.includes("outside_hours")) {
    return "Fora do horário de atendimento. Ajuste a data/hora ou configure seus horários em “Disponibilidade do médico”.";
  }
  const known = reasons.find((r) => REASONS_PT[r]);
  return known ? REASONS_PT[known] : "Conflito de agenda.";
}

/** =================== Página =================== */
export default function AgendaPageClient({ medicoId }: { medicoId: number }) {
  // pacientes e horários
  const [patients, setPatients] = useState<PatientLite[]>([]);
  const [horarios, setHorarios] = useState<Horario[]>([]);
  const [horMsg, setHorMsg] = useState<string | null>(null);

  // form de agendamento
  const [patientId, setPatientId] = useState<string>("");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [loading, setLoading] = useState(false);

  // resposta/avisos
  const [resp, setResp] = useState<{
    status?: number;
    conflict?: boolean;
    reasons?: string[];
    busy?: BusyBlock[];
    error?: string;
  } | null>(null);
  const [createMsg, setCreateMsg] = useState<string | null>(null);

  // auto fim +30 quando o início muda
  useEffect(() => {
    if (start && (!end || end <= start)) setEnd(add30(start));
  }, [start]); // eslint-disable-line

  async function loadHorarios() {
    try {
      const r = await fetch("/api/medico/horario", { cache: "no-store" });
      const j = await r.json();
      setHorarios(j?.horarios ?? []);
    } catch (e) {
      console.error("Erro listando horários:", e);
    }
  }

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

  function autoTitleIfEmpty(nextPatientId: string) {
    if (!title.trim()) {
      const p = patients.find((x) => String(x.id) === nextPatientId);
      if (p) setTitle(`Consulta — ${p.nome}`);
    }
  }

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
        setHorMsg(`Horário criado/atualizado.`);
        setHorarios(j.horarios ?? []);
      } else {
        setHorMsg(`Erro ao salvar: ${j?.error ?? r.statusText}`);
      }
    } catch (e: any) {
      setHorMsg(`Erro: ${String(e)}`);
    }
  }

  async function checkAvailability() {
    setCreateMsg(null);
    if (!date || !start || !end) {
      alert("Preencha data, início e fim.");
      return;
    }
    setLoading(true);
    setResp(null);
    try {
      const body = { medicoId, start: toISO(date, start), end: toISO(date, end) };
      const r = await fetch("/api/calendar/freebusy", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await r.json();
      if (r.status === 409) {
        setResp({ status: r.status, conflict: true, reasons: json.reasons, busy: json.busy });
        setCreateMsg(friendlyConflict(json.reasons));
      } else {
        setResp({ status: r.status, ...json });
        setCreateMsg(null);
      }
    } catch (e: any) {
      setResp({ error: String(e) });
    } finally {
      setLoading(false);
    }
  }

  async function createEvent() {
    setCreateMsg(null);
    if (!patientId) return alert("Selecione um paciente.");
    if (!title.trim() || !date || !start || !end) return alert("Preencha Título, Data, Início e Fim.");

    setLoading(true);
    try {
      const body = {
        medicoId,
        pacienteId: Number(patientId),
        titulo: title.trim(),
        inicio: toISO(date, start),
        fim: toISO(date, end),
        origem: "manual",
      };
      const r = await fetch("/api/calendar/events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await r.json();

      if (r.status === 201) {
        setCreateMsg(`Evento criado (#${json.id}).`);
        await checkAvailability();
        await upcoming.reload(); // atualiza lista
      } else if (r.status === 409) {
        setCreateMsg(friendlyConflict(json.reasons));
      } else {
        setCreateMsg(`Erro ao criar: ${json?.error ?? r.statusText}`);
      }
    } catch (e: any) {
      setCreateMsg(`Erro: ${String(e)}`);
    } finally {
      setLoading(false);
    }
  }

  /** handle child reload */
  const upcoming = useMemo(() => ({ reload: async () => {} }), []);

  return (
    <section className="space-y-6">
      {/* Disponibilidade */}
      <div className="p-3 border rounded">
        <div className="flex items-center justify-between">
          <div className="font-medium">Disponibilidade do médico</div>
          <button onClick={createDefaultHours} className="bg-gray-800 text-white px-3 py-1.5 rounded">
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

        {/* Editor manual de horários */}
        <HoursEditor
          horarios={horarios}
          onSaved={(next, msg) => {
            setHorarios(next);
            setHorMsg(msg);
          }}
        />
      </div>

      {/* Formulário */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        <div className="flex flex-col gap-1 md:col-span-2">
          <label className="text-sm">Paciente</label>
          <select
            value={patientId}
            onChange={(e) => {
              setPatientId(e.target.value);
              if (!title.trim()) autoTitleIfEmpty(e.target.value);
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
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="border rounded px-3 py-2" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm">Início</label>
          <input type="time" value={start} onChange={(e) => setStart(e.target.value)} className="border rounded px-3 py-2" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm">Fim</label>
          <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className="border rounded px-3 py-2" />
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
        <button onClick={createEvent} disabled={loading} className="bg-green-600 text-white px-4 py-2 rounded disabled:opacity-50">
          {loading ? "Criando..." : "Criar evento"}
        </button>
      </div>

      {createMsg && <div className="p-3 border rounded bg-gray-50 text-sm">{createMsg}</div>}

      {resp && (
        <div className="mt-4 space-y-3">
          {resp.error && <div className="p-3 border border-red-300 rounded bg-red-50">Erro: {resp.error}</div>}

          {!resp.error && (
            <>
              <div
                className={`p-3 rounded ${
                  resp.conflict ? "border border-red-300 bg-red-50" : "border border-green-300 bg-green-50"
                }`}
              >
                <div className="font-medium">{resp.conflict ? "Conflito" : "Disponível"}</div>
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
                        <span className="font-mono">{asLocal(b.inicio)}</span> —{" "}
                        <span className="font-mono">{asLocal(b.fim)}</span> ·{" "}
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
      <UpcomingEvents registerReload={(fn) => (upcoming.reload = fn)} />
    </section>
  );
}

/** =================== HoursEditor (um intervalo por dia) =================== */
function HoursEditor({
  horarios,
  onSaved,
}: {
  horarios: Horario[];
  onSaved: (next: Horario[], msg: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState(
    Array.from({ length: 7 }, (_, wd) => {
      const h = horarios.find((x) => x.weekday === wd);
      return {
        weekday: wd,
        enabled: !!h,
        start: h ? mmToHHMM(h.startMin) : "09:00",
        end: h ? mmToHHMM(h.endMin) : "17:00",
      };
    })
  );

  async function save() {
    setSaving(true);
    const r = await fetch("/api/medico/horario", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ replace: true, items: rows }),
    });
    const j = await r.json();
    setSaving(false);
    if (r.ok) {
      onSaved(j.horarios ?? [], "Horários atualizados.");
      setOpen(false);
    } else {
      alert(j?.error ?? r.statusText);
    }
  }

  return (
    <div className="mt-3">
      <button className="px-3 py-1.5 rounded bg-gray-700 text-white" onClick={() => setOpen((v) => !v)}>
        {open ? "Fechar editor" : "Editar horários"}
      </button>

      {open && (
        <div className="mt-3 border rounded p-3 space-y-2">
          {rows.map((r) => (
            <div key={r.weekday} className="flex flex-wrap items-center gap-3">
              <label className="w-16">{WD_PT[r.weekday]}</label>
              <label className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={r.enabled}
                  onChange={(e) =>
                    setRows((curr) => curr.map((x) => (x.weekday === r.weekday ? { ...x, enabled: e.target.checked } : x)))
                  }
                />
                Atender
              </label>
              <input
                type="time"
                value={r.start}
                disabled={!r.enabled}
                onChange={(e) => setRows((curr) => curr.map((x) => (x.weekday === r.weekday ? { ...x, start: e.target.value } : x)))}
                className="border rounded px-2 py-1"
              />
              <span>às</span>
              <input
                type="time"
                value={r.end}
                disabled={!r.enabled}
                onChange={(e) => setRows((curr) => curr.map((x) => (x.weekday === r.weekday ? { ...x, end: e.target.value } : x)))}
                className="border rounded px-2 py-1"
              />
            </div>
          ))}

          <div className="pt-2">
            <button disabled={saving} onClick={save} className="px-3 py-1.5 rounded bg-blue-primary text-white disabled:opacity-50">
              {saving ? "Salvando..." : "Salvar horários"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

{/* Lista de próximos eventos */}
<div className="mt-4">
  <h3 className="font-semibold text-sm mb-2">Próximos eventos (14 dias)</h3>
  <ul className="border rounded">
    {eventos.map((ev) => (
      <li key={ev.id} className="flex items-center justify-between px-2 py-1 border-t text-sm">
        {/* Info somente leitura */}
        <div className="truncate">
          <span className="font-medium">#{ev.id}</span>
          {" · "}
          <span>{ev.titulo || "Consulta"}</span>
          {" — "}
          <span>
            {formatDate(ev.inicio)} — {formatDate(ev.fim)}
          </span>
          {ev.paciente && (
            <>
              {" · "}
              <span className="text-gray-600">
                {ev.paciente.nome}
              </span>
            </>
          )}
        </div>

        {/* Apenas Cancelar */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleCancelar(ev.id)}
            className="px-3 py-1 rounded bg-red-600 text-white hover:bg-red-700"
            title="Cancelar evento"
          >
            Cancelar
          </button>
        </div>
      </li>
    ))}
    {eventos.length === 0 && (
      <li className="px-2 py-2 text-gray-500">Nenhum evento encontrado.</li>
    )}
  </ul>
</div>

