"use client";

import { useState } from "react";
import type { User, Medico, MedicoHorario, MedicoAusencia } from "@prisma/client";
import {
  updateProfile,
  changePassword,
  updateHorarios,
  addAusencia,
  deleteAusencia,
} from "@/src/app/medico/perfil/actions";
import { PencilIcon } from "./Icons";

type MedicoCompleto = Medico & {
  User: User; // agora terá .cpf e .endereco também
  MedicoHorario: MedicoHorario[];
  MedicoAusencia: MedicoAusencia[];
};

// Input time reaproveitado
const TimeInput = ({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) => {
  const hours = String(Math.floor(value / 60)).padStart(2, "0");
  const minutes = String(value % 60).padStart(2, "0");
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const [h, m] = e.target.value.split(":").map(Number);
    onChange(h * 60 + m);
  };
  return (
    <input
      type="time"
      value={`${hours}:${minutes}`}
      onChange={handleChange}
      className="input w-16 cursor-pointer"
    />
  );
};

export default function PerfilForm({ medico }: { medico: MedicoCompleto }) {
  // ---------------- DADOS DO USER ----------------
  const [profileData, setProfileData] = useState({
    name: medico.User.name || "",
    cpf: (medico.User as any).cpf || "",
    endereco: (medico.User as any).endereco || "",
  });

  const [oldPwd, setOldPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");

  // ---------------- HORÁRIOS / AUSÊNCIAS (como já tinha) ----------------
  const [horarios, setHorarios] = useState(medico.MedicoHorario);
  const [ausencias, setAusencias] = useState<
    (Omit<MedicoAusencia, "id"> & { id: number | string })[]
  >(medico.MedicoAusencia);
  const [newAusenciaData, setNewAusenciaData] = useState({
    inicio: "",
    fim: "",
    motivo: "",
  });

  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // --------------- handlers ---------------
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

  const handleDeleteAusenciaFromList = (ausenciaId: string) => {
    setAusencias(ausencias.filter((a) => a.id.toString() !== ausenciaId));
    setIsDirty(true);
  };

  // --------------- SALVAR TUDO ---------------
  const handleSaveAll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isDirty) return;
    setIsSaving(true);

    try {
      const promises: Promise<any>[] = [];

      // 1) Perfil do usuário (nome/cpf/endereco)
      const changedProfile =
        profileData.name !== medico.User.name ||
        (profileData.cpf || "") !== ((medico.User as any).cpf || "") ||
        (profileData.endereco || "") !== ((medico.User as any).endereco || "");

      if (changedProfile) {
        const fd = new FormData();
        fd.set("name", profileData.name);
        fd.set("cpf", profileData.cpf);
        fd.set("endereco", profileData.endereco);
        promises.push(updateProfile(medico.userId, fd));
      }

      // 2) Troca de senha (opcional)
      if (oldPwd && newPwd) {
        const fd = new FormData();
        fd.set("oldPassword", oldPwd);
        fd.set("newPassword", newPwd);
        promises.push(changePassword(medico.userId, fd));
      }

      // 3) Horários
      if (JSON.stringify(horarios) !== JSON.stringify(medico.MedicoHorario)) {
        const horariosParaSalvar = horarios.map(({ weekday, startMin, endMin }) => ({
          weekday,
          startMin,
          endMin,
        }));
        promises.push(updateHorarios(medico.id, horariosParaSalvar));
      }

      // 4) Nova ausência (form “Início / Fim / Motivo”)
      if (newAusenciaData.inicio && newAusenciaData.fim) {
        promises.push(
          addAusencia(medico.id, {
            inicio: new Date(newAusenciaData.inicio),
            fim: new Date(newAusenciaData.fim),
            motivo: newAusenciaData.motivo || "",
          })
        );
      }

      // 5) Remoções de ausências
      const originalIds = new Set(medico.MedicoAusencia.map((a) => a.id));
      const currentIds = new Set(ausencias.map((a) => a.id));
      for (const id of originalIds) {
        if (!currentIds.has(id)) promises.push(deleteAusencia(id));
      }

      const results = await Promise.all(promises);
      const err = results.find((r) => r?.error);
      if (err?.error) {
        alert(err.error);
      } else {
        alert("Alterações salvas com sucesso!");
        setOldPwd("");
        setNewPwd("");
        setNewAusenciaData({ inicio: "", fim: "", motivo: "" });
        setIsDirty(false);
      }
    } catch (error) {
      console.error("Erro ao salvar alterações:", error);
      alert("Ocorreu um erro inesperado ao salvar.");
    } finally {
      setIsSaving(false);
    }
  };

  const diasDaSemana = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

  return (
    <form onSubmit={handleSaveAll} className="space-y-12">
      {/* SEÇÃO 1: DADOS PESSOAIS (agora com CPF e Endereço + Senha) */}
      <div className="p-8 bg-white rounded-lg shadow-md">
        <h2 className="text-xl font-semibold text-gray-700 mb-6">Informações Pessoais</h2>

        <div className="space-y-4">
          {/* Nome */}
          <div className="w-fit flex items-center gap-4 relative">
            <label htmlFor="name" className="label">Nome:</label>
            <input
              type="text"
              name="name"
              id="name"
              value={profileData.name}
              onChange={handleProfileChange}
              className="input cursor-pointer"
              required
            />
            <div className="absolute right-0 pointer-events-none">
              <PencilIcon size={16} />
            </div>
          </div>

          {/* Email (readonly) */}
          <div className="flex items-center gap-4">
            <label htmlFor="email" className="label">Email:</label>
            <input type="email" id="email" value={medico.User.email} className="input-disabled" disabled />
          </div>

          {/* CPF */}
          <div className="flex items-center gap-4">
            <label htmlFor="cpf" className="label">CPF:</label>
            <input
              type="text"
              name="cpf"
              id="cpf"
              value={profileData.cpf}
              onChange={handleProfileChange}
              className="input cursor-pointer"
              placeholder="000.000.000-00"
            />
          </div>

          {/* Endereço */}
          <div className="flex items-center gap-4">
            <label htmlFor="endereco" className="label">Endereço:</label>
            <input
              type="text"
              name="endereco"
              id="endereco"
              value={profileData.endereco}
              onChange={handleProfileChange}
              className="input cursor-pointer"
              placeholder="Rua, nº - Bairro - Cidade/UF"
            />
          </div>

          {/* CRM (readonly) */}
          <div className="flex items-center gap-4">
            <label htmlFor="crm" className="label">CRM:</label>
            <input type="text" id="crm" value={medico.crm || "não informado"} className="input-disabled" disabled />
          </div>

          {/* Trocar senha */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="label">Senha atual</label>
              <input
                type="password"
                className="input"
                value={oldPwd}
                onChange={(e) => { setOldPwd(e.target.value); setIsDirty(true); }}
              />
            </div>
            <div>
              <label className="label">Nova senha</label>
              <input
                type="password"
                className="input"
                value={newPwd}
                onChange={(e) => { setNewPwd(e.target.value); setIsDirty(true); }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* SEÇÃO 2: HORÁRIOS (igual) */}
      <div className="p-8 bg-white rounded-lg shadow-md">
        <h2 className="text-xl font-semibold text-gray-700 mb-6">Horários de Atendimento</h2>
        <div className="space-y-4">
          {diasDaSemana.map((dia, index) => {
            const horario = horarios.find((h) => h.weekday === index);
            if (!horario) return null;
            return (
              <div key={index} className="grid grid-cols-4 items-center gap-4 p-2 rounded-md hover:bg-gray-50">
                <span className="font-medium text-gray-600 col-span-1">{dia}</span>
                <div className="col-span-1 relative flex w-fit items-center gap-4">
                  <TimeInput
                    value={horario.startMin}
                    onChange={(val) => handleHorarioChange(horarios.indexOf(horario), "startMin", val)}
                  />
                  <div className="pointer-events-none absolute right-0">
                    <PencilIcon size={16} />
                  </div>
                </div>
                <div className="col-span-1 relative w-fit flex items-center">
                  <TimeInput
                    value={horario.endMin}
                    onChange={(val) => handleHorarioChange(horarios.indexOf(horario), "endMin", val)}
                  />
                  <div className="pointer-events-none absolute right-0 cursor-pointer">
                    <PencilIcon size={16} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SEÇÃO 3: AUSÊNCIAS (como você já tinha) */}
      <div className="p-8 bg-white rounded-lg shadow-md">
        <h2 className="text-xl font-semibold text-gray-700 mb-6">Adicionar Nova Ausência</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end mb-8">
          <div className="md:col-span-1 w-fit flex flex-col gap-1.5">
            <label className="label font-bold">Início</label>
            <input type="datetime-local" name="inicio" className="input" value={newAusenciaData.inicio} onChange={handleNewAusenciaChange} />
          </div>
          <div className="md:col-span-1 w-fit flex flex-col gap-1.5">
            <label className="label font-bold">Fim</label>
            <input type="datetime-local" name="fim" className="input" value={newAusenciaData.fim} onChange={handleNewAusenciaChange} />
          </div>
          <div className="md:col-span-1 flex flex-col w-fit">
            <label className="label font-bold">Motivo (opcional)</label>
            <input type="text" name="motivo" className="input border py-2 px-4" value={newAusenciaData.motivo} onChange={handleNewAusenciaChange} />
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
              <button type="button" onClick={() => handleDeleteAusenciaFromList(a.id.toString())} className="text-red-500 hover:text-red-700 font-semibold">
                Excluir
              </button>
            </li>
          ))}
          {ausencias.length === 0 && <p className="text-gray-500">Nenhuma ausência agendada.</p>}
        </ul>
      </div>

      <div className="p-4 bg-white rounded-lg shadow-md text-xs text-red-400">
        As alterações só terão efeito visual após atualizar a página.
      </div>

      {isDirty && (
        <div className="fixed bottom-12 right-12 z-10">
          <button
            type="submit"
            disabled={isSaving}
            className="bg-blue-primary text-white shadow-lg rounded-full px-6 py-3 text-lg font-bold transition-transform transform hover:scale-105 disabled:cursor-not-allowed disabled:bg-gray-400"
          >
            {isSaving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      )}
    </form>
  );
}
