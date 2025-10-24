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
  return new Date(dt).toLocaleString("pt-BR");
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
    <main className="min-h-screen bg-[#F7F9FC] p-8 md:p-10 space-y-8">
      {/* Cabeçalho */}
      <header>
        <h1 className="text-2xl md:text-3xl font-semibold text-[#1E63F3]">Agenda</h1>
        <p className="text-gray-500 mt-1">Verifique disponibilidade e crie eventos.</p>
      </header>

      {/* Disponibilidade */}
      <section className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-3 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[#1E63F3]">Disponibilidade do médico</h2>
          <button
            onClick={createDefaultHours}
            className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Criar horário padrão (Seg–Sex 09:00–17:00)
          </button>
        </div>

        <div className="p-6">
          {horMsg && <div className="mb-3 text-sm text-gray-700">{horMsg}</div>}

          {horarios.length === 0 ? (
            <div className="text-sm text-gray-600">Nenhum horário configurado.</div>
          ) : (
            <ul className="text-sm text-gray-700">
              {horarios.map((h) => (
                <li key={h.id} className="py-1">
                  {WD_PT[h.weekday]} · {mmToHHMM(h.startMin)} — {mmToHHMM(h.endMin)}
                </li>
              ))}
            </ul>
          )}

          {/* Editor manual de horários */}
          <div className="mt-4">
            <HoursEditor
              horarios={horarios}
              onSaved={(next, msg) => {
                setHorarios(next);
                setHorMsg(msg);
              }}
            />
          </div>
        </div>
      </section>

      {/* Formulário de agendamento */}
      <section className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-3 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-[#1E63F3]">Novo agendamento</h2>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="flex flex-col gap-1 md:col-span-2">
              <label className="text-sm text-gray-600">Paciente</label>
              <select
                value={patientId}
                onChange={(e) => {
                  setPatientId(e.target.value);
                  if (!title.trim()) autoTitleIfEmpty(e.target.value);
                }}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-[#1E63F3] focus:border-[#1E63F3] bg-white"
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
              <label className="text-sm text-gray-600">Título</label>
              <input
                type="text"
                placeholder="Ex.: Consulta clínica"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-[#1E63F3] focus:border-[#1E63F3] bg-white"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm text-gray-600">Data</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-[#1E63F3] focus:border-[#1E63F3] bg-white"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm text-gray-600">Início</label>
              <input
                type="time"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-[#1E63F3] focus:border-[#1E63F3] bg-white"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm text-gray-600">Fim</label>
              <input
                type="time"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-[#1E63F3] focus:border-[#1E63F3] bg-white"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={checkAvailability}
              disabled={loading}
              className="inline-flex items-center rounded-lg bg-[#1E63F3] text-white px-4 py-2 font-medium hover:bg-[#0F4CCF] disabled:opacity-50"
            >
              {loading ? "Verificando..." : "Verificar disponibilidade"}
            </button>
            <button
              onClick={createEvent}
              disabled={loading}
              className="inline-flex items-center rounded-lg border border-gray-300 bg-white text-gray-800 px-4 py-2 font-medium hover:bg-gray-50 disabled:opacity-50"
            >
              {loading ? "Criando..." : "Criar evento"}
            </button>
          </div>

          {createMsg && (
            <div className="mt-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
              {createMsg}
            </div>
          )}
        </div>
      </section>

      {/* Resultado da verificação */}
      {resp && (
        <section className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-3 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-[#1E63F3]">Resultado</h2>
          </div>

          <div className="p-6 space-y-4">
            {resp.error && (
              <div className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                Erro: {resp.error}
              </div>
            )}

            {!resp.error && (
              <>
                <div
                  className={`rounded-lg px-3 py-2 text-sm ${
                    resp.conflict
                      ? "border border-rose-300 bg-rose-50 text-rose-700"
                      : "border border-emerald-300 bg-emerald-50 text-emerald-700"
                  }`}
                >
                  <div className="font-medium">
                    {resp.conflict ? "Conflito" : "Disponível"}
                  </div>
                  {resp.reasons && resp.reasons.length > 0 && (
                    <ul className="list-disc ml-5 mt-1">
                      {resp.reasons.map((r) => (
                        <li key={r}>{REASONS_PT[r] ?? r}</li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="rounded-lg border border-gray-200">
                  <div className="px-3 py-2 border-b border-gray-200 font-medium text-gray-800">
                    Ocupações no período
                  </div>
                  <div className="p-3">
                    {!resp.busy || resp.busy.length === 0 ? (
                      <div className="text-sm text-gray-600">Nenhuma.</div>
                    ) : (
                      <ul className="space-y-1 text-sm text-gray-800">
                        {resp.busy.map((b, idx) => (
                          <li key={idx}>
                            <span className="font-mono">{asLocal(b.inicio)}</span>{" "}
                            — <span className="font-mono">{asLocal(b.fim)}</span> ·{" "}
                            <span className="uppercase">{b.origem}</span>
                            {typeof b.refId === "number" ? ` (#${b.refId})` : ""}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </section>
      )}

      {/* Próximos eventos */}
      <UpcomingEvents registerReload={(fn) => (upcoming.reload = fn)} />
    </main>
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
    <div className="mt-2">
      <button
        className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? "Fechar editor" : "Editar horários"}
      </button>

      {open && (
        <div className="mt-3 rounded-xl border border-gray-200 p-3 md:p-4 space-y-2 bg-white">
          {rows.map((r) => (
            <div key={r.weekday} className="flex flex-wrap items-center gap-3">
              <label className="w-16 text-gray-700">{WD_PT[r.weekday]}</label>
              <label className="flex items-center gap-1 text-gray-700">
                <input
                  type="checkbox"
                  checked={r.enabled}
                  onChange={(e) =>
                    setRows((curr) =>
                      curr.map((x) =>
                        x.weekday === r.weekday ? { ...x, enabled: e.target.checked } : x
                      )
                    )
                  }
                  className="accent-[#1E63F3] cursor-pointer"
                />
                Atender
              </label>
              <input
                type="time"
                value={r.start}
                disabled={!r.enabled}
                onChange={(e) =>
                  setRows((curr) =>
                    curr.map((x) => (x.weekday === r.weekday ? { ...x, start: e.target.value } : x))
                  )
                }
                className="rounded-lg border border-gray-300 px-2 py-1 outline-none focus:ring-2 focus:ring-[#1E63F3] focus:border-[#1E63F3] bg-white disabled:bg-gray-100"
              />
              <span className="text-gray-600">às</span>
              <input
                type="time"
                value={r.end}
                disabled={!r.enabled}
                onChange={(e) =>
                  setRows((curr) =>
                    curr.map((x) => (x.weekday === r.weekday ? { ...x, end: e.target.value } : x))
                  )
                }
                className="rounded-lg border border-gray-300 px-2 py-1 outline-none focus:ring-2 focus:ring-[#1E63F3] focus:border-[#1E63F3] bg-white disabled:bg-gray-100"
              />
            </div>
          ))}

          <div className="pt-2">
            <button
              disabled={saving}
              onClick={save}
              className="inline-flex items-center rounded-lg bg-[#1E63F3] text-white px-4 py-2 text-sm font-medium hover:bg-[#0F4CCF] disabled:opacity-50"
            >
              {saving ? "Salvando..." : "Salvar horários"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** =================== Próximos eventos (14 dias) — versão simplificada =================== */
function UpcomingEvents({
  registerReload,
}: {
  registerReload: (fn: () => Promise<void>) => void;
}) {
  const [items, setItems] = useState<
    { id: number; titulo: string; inicio: string; fim: string; paciente?: { id: number; nome: string } }[]
  >([]);
  const [msg, setMsg] = useState<string | null>(null);

  const load = async () => {
    const r = await fetch("/api/calendar/events/upcoming?days=14", { cache: "no-store" });
    const j = await r.json();
    setItems(j?.eventos ?? []);
  };

  useEffect(() => {
    registerReload(load);
    load();
  }, []); // eslint-disable-line

  async function cancel(id: number) {
    setMsg(null);
    const r = await fetch(`/api/calendar/events/${id}`, { method: "DELETE" });
    if (r.ok) {
      setMsg(`Evento #${id} cancelado.`);
      await load();
    } else {
      const j = await r.json();
      setMsg(`Erro ao cancelar: ${j?.error ?? r.statusText}`);
    }
  }

  return (
    <section className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-6 py-3 border-b border-gray-200 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-[#1E63F3]">Próximos eventos (14 dias)</h2>
        <a
          href="/medico/consultas"
          className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Ver na lista
        </a>
      </div>

      <div className="p-6">
        {msg && (
          <div className="mb-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
            {msg}
          </div>
        )}

        {items.length === 0 ? (
          <div className="text-sm text-gray-600">Nenhum evento.</div>
        ) : (
          <ul className="space-y-3">
            {items.map((ev) => (
              <li key={ev.id} className="rounded-lg border border-gray-200 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-medium text-gray-800">
                      #{ev.id} · {ev.titulo}
                      {ev.paciente ? ` · ${ev.paciente.nome}` : ""}
                    </div>
                    <div className="text-sm text-gray-600">
                      {asLocal(ev.inicio)} — {asLocal(ev.fim)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => cancel(ev.id)}
                      className="inline-flex items-center rounded-lg bg-red-500 text-white px-3 py-1.5 text-sm font-medium hover:bg-red-600"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
