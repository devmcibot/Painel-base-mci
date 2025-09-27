"use client";

import { useEffect, useMemo, useState } from "react";

type DayRow = {
  weekday: number;     // 0..6
  enabled: boolean;
  start: string;       // "09:00"
  end: string;         // "17:00"
  breakEnabled: boolean;
  breakStart: string;  // "12:00"
  breakEnd: string;    // "13:00"
};

const WD_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function minToHHMM(min: number) {
  const h = Math.floor(min / 60).toString().padStart(2, "0");
  const m = (min % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

export default function ScheduleEditor() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [days, setDays] = useState<DayRow[]>(
    Array.from({ length: 7 }, (_, i) => ({
      weekday: i,
      enabled: i >= 1 && i <= 5, // Seg–Sex habilitado por padrão
      start: "09:00",
      end: "17:00",
      breakEnabled: false,
      breakStart: "12:00",
      breakEnd: "13:00",
    }))
  );

  const summary = useMemo(() => {
    // só para exibir um resuminho no topo, usado na tua UI atual
    const lines: string[] = [];
    for (const d of days) {
      if (!d.enabled) continue;
      const base = `${WD_LABELS[d.weekday]}: ${d.start} — ${d.end}`;
      lines.push(
        d.breakEnabled ? `${base}  (intervalo ${d.breakStart}–${d.breakEnd})` : base
      );
    }
    return lines;
  }, [days]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/medico/horario", { cache: "no-store" });
        if (!res.ok) throw new Error("fail");
        const data = await res.json();
        const rows = data?.horarios as Array<{ weekday:number; startMin:number; endMin:number }>;
        if (Array.isArray(rows) && rows.length) {
          // agrupa por weekday; se houver 2 blocos, deduz intervalo
          const byWd = new Map<number, { startMin:number; endMin:number }[]>();
          for (const r of rows) {
            if (!byWd.has(r.weekday)) byWd.set(r.weekday, []);
            byWd.get(r.weekday)!.push({ startMin: r.startMin, endMin: r.endMin });
          }
          const next = days.map((d) => {
            const blocks = (byWd.get(d.weekday) || []).sort((a,b)=>a.startMin-b.startMin);
            if (!blocks.length) return { ...d, enabled: false };
            if (blocks.length === 1) {
              return {
                ...d,
                enabled: true,
                start: minToHHMM(blocks[0].startMin),
                end: minToHHMM(blocks[0].endMin),
                breakEnabled: false,
              };
            }
            // 2+ blocos → considera 2 blocos e pega intervalo entre eles
            const first = blocks[0], last = blocks[blocks.length-1];
            const maybeBreakStart = first.endMin;
            const maybeBreakEnd = last.startMin; // se houver mais de 2 blocos, simplifica
            return {
              ...d,
              enabled: true,
              start: minToHHMM(first.startMin),
              end: minToHHMM(last.endMin),
              breakEnabled: true,
              breakStart: minToHHMM(maybeBreakStart),
              breakEnd: minToHHMM(maybeBreakEnd),
            };
          });
          setDays(next);
        }
      } catch (e) {
        // silencia; mantém defaults
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function updateDay(idx: number, patch: Partial<DayRow>) {
    setDays((prev) => prev.map((d, i) => (i === idx ? { ...d, ...patch } : d)));
  }

  async function saveManual() {
    setSaving(true);
    try {
      const payload = {
        replace: true,
        items: days.map((d) => ({
          weekday: d.weekday,
          start: d.start,
          end: d.end,
          enabled: d.enabled,
          breakStart: d.breakEnabled ? d.breakStart : undefined,
          breakEnd: d.breakEnabled ? d.breakEnd : undefined,
        })),
      };
      const res = await fetch("/api/medico/horario", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Erro ao salvar");
      // opcional: toast
    } catch (e) {
      alert("Não foi possível salvar a grade.");
    } finally {
      setSaving(false);
    }
  }

  async function criarPadraoSegSex() {
    setSaving(true);
    try {
      const ref = days[1]; // usa segunda como referência
      const res = await fetch("/api/medico/horario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weekdays: [1, 2, 3, 4, 5],
          start: ref.start,
          end: ref.end,
          breakStart: ref.breakEnabled ? ref.breakStart : undefined,
          breakEnd: ref.breakEnabled ? ref.breakEnd : undefined,
          replace: true,
        }),
      });
      if (!res.ok) throw new Error();
      // opcional: toast
    } catch (e) {
      alert("Falha ao criar padrão.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="border rounded p-3 bg-slate-50 text-sm">
        <div className="font-medium mb-2">Disponibilidade do médico</div>
        <ul className="list-disc pl-5">
          {summary.length ? summary.map((l, i) => <li key={i}>{l}</li>) : <li>Nenhum horário definido</li>}
        </ul>
        <div className="mt-3">
          <button
            className="btn btn-sm btn-primary"
            onClick={criarPadraoSegSex}
            disabled={saving}
            title="Cria Seg–Sex com os horários de segunda"
          >
            Criar horário padrão (Seg–Sex)
          </button>
        </div>
      </div>

      <div className="border rounded p-3">
        {loading ? (
          <div>Carregando…</div>
        ) : (
          <>
            <div className="grid gap-2">
              {days.map((row, i) => (
                <div key={row.weekday} className="flex items-center gap-3 flex-wrap">
                  <div className="w-14 font-medium">{WD_LABELS[row.weekday]}</div>

                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={row.enabled}
                      onChange={(e) => updateDay(i, { enabled: e.target.checked })}
                    />
                    <span>Atender</span>
                  </label>

                  <input
                    type="time"
                    className="input input-bordered input-sm"
                    value={row.start}
                    onChange={(e) => updateDay(i, { start: e.target.value })}
                    disabled={!row.enabled}
                  />
                  <span>às</span>
                  <input
                    type="time"
                    className="input input-bordered input-sm"
                    value={row.end}
                    onChange={(e) => updateDay(i, { end: e.target.value })}
                    disabled={!row.enabled}
                  />

                  <div className="h-5 w-px bg-slate-200 mx-1" />

                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={row.breakEnabled}
                      onChange={(e) =>
                        updateDay(i, { breakEnabled: e.target.checked })
                      }
                      disabled={!row.enabled}
                    />
                    <span>Intervalo</span>
                  </label>

                  <input
                    type="time"
                    className="input input-bordered input-sm"
                    value={row.breakStart}
                    onChange={(e) => updateDay(i, { breakStart: e.target.value })}
                    disabled={!row.enabled || !row.breakEnabled}
                  />
                  <span>até</span>
                  <input
                    type="time"
                    className="input input-bordered input-sm"
                    value={row.breakEnd}
                    onChange={(e) => updateDay(i, { breakEnd: e.target.value })}
                    disabled={!row.enabled || !row.breakEnabled}
                  />
                </div>
              ))}
            </div>

            <div className="mt-3">
              <button className="btn btn-sm btn-primary" onClick={saveManual} disabled={saving}>
                Salvar horários
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
