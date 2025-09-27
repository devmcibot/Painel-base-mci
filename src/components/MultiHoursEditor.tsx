// src/components/MultiHoursEditor.tsx
"use client";
import { useEffect, useState } from "react";

const WD_PT = ["Domingo","Segunda","Terça","Quarta","Quinta","Sexta","Sábado"];

type Slot = { start: string; end: string };
type DayRow = { weekday: number; enabled: boolean; slots: Slot[] };

function minToHHMM(min: number) {
  const h = String(Math.floor(min / 60)).padStart(2,"0");
  const m = String(min % 60).padStart(2,"0");
  return `${h}:${m}`;
}

export default function MultiHoursEditor() {
  const [rows, setRows] = useState<DayRow[]>(
    Array.from({ length: 7 }, (_, wd) => ({
      weekday: wd,
      enabled: wd >= 1 && wd <= 5,
      slots: wd >= 1 && wd <= 5 ? [{ start: "09:00", end: "17:00" }] : [],
    }))
  );
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // carrega horários atuais
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const r = await fetch("/api/medico/horario", { cache: "no-store" });
        const j = await r.json();
        const next = Array.from({ length: 7 }, (_, wd) => {
          const day = (j?.horarios ?? []).find((d: any) => d.weekday === wd);
          if (!day) return { weekday: wd, enabled: false, slots: [] } as DayRow;
          return {
            weekday: wd,
            enabled: true,
            slots: (day.intervals ?? []).map((s: any) => ({
              start: minToHHMM(s.startMin),
              end: minToHHMM(s.endMin),
            })),
          } as DayRow;
        });
        setRows(next);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function addSlot(wd: number) {
    setRows((curr) =>
      curr.map((r) =>
        r.weekday === wd
          ? { ...r, enabled: true, slots: [...r.slots, { start: "09:00", end: "12:00" }] }
          : r
      )
    );
  }
  function rmSlot(wd: number, idx: number) {
    setRows((curr) =>
      curr.map((r) =>
        r.weekday === wd ? { ...r, slots: r.slots.filter((_, i) => i !== idx) } : r
      )
    );
  }
  function setSlot(wd: number, idx: number, field: "start" | "end", val: string) {
    setRows((curr) =>
      curr.map((r) =>
        r.weekday === wd
          ? {
              ...r,
              slots: r.slots.map((s, i) => (i === idx ? { ...s, [field]: val } : s)),
            }
          : r
      )
    );
  }

  async function save() {
    setLoading(true);
    setMsg(null);
    try {
      const payload = {
        replace: true,
        items: rows.map((r) => ({
          weekday: r.weekday,
          enabled: r.enabled && r.slots.length > 0,
          slots: r.slots,
        })),
      };
      const res = await fetch("/api/medico/horario", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setMsg("Horários salvos.");
      } else {
        const j = await res.json().catch(() => ({}));
        setMsg(j?.error ?? res.statusText);
      }
    } catch (e: any) {
      setMsg(String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-4 border rounded-lg space-y-3">
      <div className="font-semibold">Horários de Atendimento</div>
      {rows.map((r) => (
        <div key={r.weekday} className="border rounded p-2 space-y-2">
          <div className="flex items-center gap-3">
            <label className="w-24">{WD_PT[r.weekday]}</label>
            <label className="flex items-center gap-2 text-sm">
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
              />
              Atender neste dia
            </label>
            <button
              type="button"
              onClick={() => addSlot(r.weekday)}
              className="px-2 py-1 bg-gray-800 text-white rounded text-sm"
            >
              Adicionar intervalo
            </button>
          </div>

          {r.enabled && (
            <div className="space-y-2 pl-24">
              {r.slots.length === 0 ? (
                <div className="text-sm text-gray-500">
                  Nenhum intervalo — clique em “Adicionar intervalo”.
                </div>
              ) : (
                r.slots.map((s, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type="time"
                      value={s.start}
                      onChange={(e) => setSlot(r.weekday, i, "start", e.target.value)}
                      className="border rounded px-2 py-1"
                    />
                    <span>às</span>
                    <input
                      type="time"
                      value={s.end}
                      onChange={(e) => setSlot(r.weekday, i, "end", e.target.value)}
                      className="border rounded px-2 py-1"
                    />
                    <button
                      type="button"
                      onClick={() => rmSlot(r.weekday, i)}
                      className="px-2 py-1 text-sm border rounded"
                    >
                      Remover
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      ))}

      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={loading}
          onClick={save}
          className="px-4 py-2 bg-blue-primary text-white rounded disabled:opacity-50"
        >
          {loading ? "Salvando..." : "Salvar horários"}
        </button>
        {msg && <span className="text-sm">{msg}</span>}
      </div>
    </div>
  );
}
