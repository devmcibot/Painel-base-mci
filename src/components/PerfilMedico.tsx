"use client";

import { useState } from "react";
import type { User, Medico, MedicoHorario, MedicoAusencia } from "@prisma/client";
import { updateProfile, updateHorarios, addAusencia, deleteAusencia } from "@/app/medico/perfil/actions";
import { PencilIcon } from "./Icons";

type MedicoCompleto = Medico & {
  User: User;
  MedicoHorario: MedicoHorario[];
  MedicoAusencia: MedicoAusencia[];
};

const TimeInput = ({ value, onChange }: { value: number; onChange: (v: number) => void }) => {
  const hours = String(Math.floor(value / 60)).padStart(2, "0");
  const minutes = String(value % 60).padStart(2, "0");
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const [h, m] = e.target.value.split(":").map(Number);
    onChange(h * 60 + m);
  };
  return <input type="time" value={`${hours}:${minutes}`} onChange={handleChange} className="w-24 border rounded px-2 py-1" />;
};

export default function PerfilForm({ medico }: { medico: MedicoCompleto }) {
  // -------- PERFIL (User + Medico)
  const [profileData, setProfileData] = useState({
    name: medico.User.name || "",
    email: medico.User.email || "",
    crm: medico.crm || "",
  });

  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // -------- HORÁRIOS / AUSÊNCIAS (como já estavam)
  const [horarios, setHorarios] = useState(medico.MedicoHorario);
  const [ausencias, setAusencias] = useState<(Omit<MedicoAusencia, "id"> & { id: number | string })[]>(medico.MedicoAusencia);
  const [newAusenciaData, setNewAusenciaData] = useState({ inicio: "", fim: "", motivo: "" });

  const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setProfileData({ ...profileData, [e.target.name]: e.target.value });
    setIsDirty(true);
  };

  const handleHorarioChange = (index: number, field: "startMin" | "endMin", value: number) => {
    const novos = [...horarios];
    novos[index] = { ...novos[index], [field]: value };
    setHorarios(novos);
    setIsDirty(true);
  };

  const handleNewAusenciaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewAusenciaData({ ...newAusenciaData, [e.target.name]: e.target.value });
    setIsDirty(true);
  };

  const handleDeleteAusenciaFromList = (id: string) => {
    setAusencias(ausencias.filter((a) => a.id.toString() !== id));
    setIsDirty(true);
  };

  async function handleSaveAll(e: React.FormEvent) {
    e.preventDefault();
    if (!isDirty) return;
    setIsSaving(true);

    try {
      const promises: Promise<any>[] = [];

      // 1) Perfil (nome/email/CRM)
      const changedProfile =
        profileData.name !== medico.User.name ||
        profileData.email !== medico.User.email ||
        (profileData.crm || "") !== (medico.crm || "");

      if (changedProfile) {
        const fd = new FormData();
        fd.set("name", profileData.name);
        fd.set("email", profileData.email);
        fd.set("crm", profileData.crm);
        fd.set("medicoId", String(medico.id));
        promises.push(updateProfile(medico.userId, fd));
      }

      // 2) Horários
      if (JSON.stringify(horarios) !== JSON.stringify(medico.MedicoHorario)) {
        const hs = horarios.map(({ weekday, startMin, endMin }) => ({ weekday, startMin, endMin }));
        promises.push(updateHorarios(medico.id, hs));
      }

      // 3) Nova ausência
      if (newAusenciaData.inicio && newAusenciaData.fim) {
        promises.push(
          addAusencia(medico.id, {
            inicio: new Date(newAusenciaData.inicio),
            fim: new Date(newAusenciaData.fim),
            motivo: newAusenciaData.motivo || "",
          })
        );
      }

      // 4) Remoções
      const originalIds = new Set(medico.MedicoAusencia.map((a) => a.id));
      const currentIds = new Set(ausencias.map((a) => a.id));
      for (const id of originalIds) if (!currentIds.has(id)) promises.push(deleteAusencia(id));

      const results = await Promise.all(promises);
      const err = results.find((r) => r?.error);
      if (err?.error) alert(err.error);
      else {
        alert("Alterações salvas com sucesso!");
        setNewAusenciaData({ inicio: "", fim: "", motivo: "" });
        setIsDirty(false);
      }
    } catch (e) {
      console.error(e);
      alert("Erro ao salvar.");
    } finally {
      setIsSaving(false);
    }
  }

  const diasDaSemana = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

  return (
    <form onSubmit={handleSaveAll} className="space-y-12">
      {/* SEÇÃO 1: DADOS PESSOAIS (editável com caixinhas) */}
      <div className="p-8 bg-white rounded-lg shadow-md">
        <h2 className="text-xl font-semibold text-gray-700 mb-6">Informações Pessoais</h2>

        <div className="space-y-4 max-w-xl">
          {/* Nome */}
          <div className="relative">
            <label htmlFor="name" className="label">Nome:</label>
            <input
              id="name"
              name="name"
              value={profileData.name}
              onChange={handleProfileChange}
              className="w-full border rounded px-3 py-2 pr-8"
              required
            />
            <span className="absolute right-2 top-8 text-gray-400 pointer-events-none">
              <PencilIcon size={16} />
            </span>
          </div>

          {/* Email */}
          <div className="relative">
            <label htmlFor="email" className="label">Email:</label>
            <input
              id="email"
              name="email"
              type="email"
              value={profileData.email}
              onChange={handleProfileChange}
              className="w-full border rounded px-3 py-2 pr-8"
              required
            />
            <span className="absolute right-2 top-8 text-gray-400 pointer-events-none">
              <PencilIcon size={16} />
            </span>
          </div>

          {/* CRM */}
          <div className="relative">
            <label htmlFor="crm" className="label">CRM:</label>
            <input
              id="crm"
              name="crm"
              value={profileData.crm}
              onChange={handleProfileChange}
              className="w-full border rounded px-3 py-2 pr-8"
              placeholder="não informado"
            />
            <span className="absolute right-2 top-8 text-gray-400 pointer-events-none">
              <PencilIcon size={16} />
            </span>
          </div>
        </div>
      </div>

      {/* SEÇÃO 2: HORÁRIOS */}
      <div className="p-8 bg-white rounded-lg shadow-md">
        <h2 className="text-xl font-semibold text-gray-700 mb-6">Horários de Atendimento</h2>
        <div className="space-y-4">
          {diasDaSemana.map((dia, i) => {
            const h = horarios.find((x) => x.weekday === i);
            if (!h) return null;
            return (
              <div key={i} className="grid grid-cols-4 items-center gap-4 p-2 rounded-md hover:bg-gray-50">
                <span className="font-medium text-gray-600 col-span-1">{dia}</span>
                <div className="col-span-1 relative flex w-fit items-center gap-4">
                  <TimeInput value={h.startMin} onChange={(v) => handleHorarioChange(horarios.indexOf(h), "startMin", v)} />
                  <div className="absolute right-0 text-gray-400 pointer-events-none"><PencilIcon size={16} /></div>
                </div>
                <div className="col-span-1 relative w-fit flex items-center">
                  <TimeInput value={h.endMin} onChange={(v) => handleHorarioChange(horarios.indexOf(h), "endMin", v)} />
                  <div className="absolute right-0 text-gray-400 pointer-events-none"><PencilIcon size={16} /></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SEÇÃO 3: AUSÊNCIAS */}
      <div className="p-8 bg-white rounded-lg shadow-md">
        <h2 className="text-xl font-semibold text-gray-700 mb-6">Adicionar Nova Ausência</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end mb-8">
          <div>
            <label className="label font-bold">Início</label>
            <input type="datetime-local" name="inicio" className="w-full border rounded px-3 py-2"
              value={newAusenciaData.inicio} onChange={handleNewAusenciaChange} />
          </div>
          <div>
            <label className="label font-bold">Fim</label>
            <input type="datetime-local" name="fim" className="w-full border rounded px-3 py-2"
              value={newAusenciaData.fim} onChange={handleNewAusenciaChange} />
          </div>
          <div>
            <label className="label font-bold">Motivo (opcional)</label>
            <input type="text" name="motivo" className="w-full border rounded px-3 py-2"
              value={newAusenciaData.motivo} onChange={handleNewAusenciaChange} />
          </div>
        </div>

        <h3 className="text-lg font-semibold text-gray-700 mt-8 mb-4 border-t pt-6">Ausências Agendadas</h3>
        <ul className="space-y-2">
          {ausencias?.map((a) => (
            <li key={a.id.toString()} className="flex justify-between items-center p-3 bg-gray-100 rounded-md">
              <div>
                <p className="font-semibold">{a.motivo || "Ausência"}</p>
                <p className="text-sm text-gray-500">
                  {new Date(a.inicio).toLocaleString()} - {new Date(a.fim).toLocaleString()}
                </p>
              </div>
              <button type="button" onClick={() => handleDeleteAusenciaFromList(a.id.toString())}
                className="text-red-500 hover:text-red-700 font-semibold">Excluir</button>
            </li>
          ))}
          {ausencias.length === 0 && <p className="text-gray-500">Nenhuma ausência agendada.</p>}
        </ul>
      </div>

      {/* aviso */}
      <div className="p-4 bg-white rounded-lg shadow-md text-xs text-red-400">
        As alterações só terão efeito visual após atualizar a página.
      </div>

      {/* botão salvar flutuante */}
      {isDirty && (
        <div className="fixed bottom-12 right-12 z-10">
          <button type="submit" disabled={isSaving}
            className="bg-blue-primary text-white shadow-lg rounded-full px-6 py-3 text-lg font-bold transition-transform hover:scale-105 disabled:cursor-not-allowed disabled:bg-gray-400">
            {isSaving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      )}
    </form>
  );
}
