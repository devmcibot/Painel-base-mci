"use client";

import { useState } from "react";
import type {
  User,
  Medico,
  MedicoHorario,
  MedicoAusencia,
} from "@prisma/client";

import {
  updateProfile,
  updateHorarios,
  addAusencia,
  deleteAusencia,
} from "@/src/app/medico/perfil/actions";

import { PencilIcon } from "./Icons";

// Tipagem para os dados completos do médico
type MedicoCompleto = Medico & {
  User: User;
  MedicoHorario: MedicoHorario[];
  MedicoAusencia: MedicoAusencia[];
};

// Componente auxiliar para os inputs de horário
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
  // --- ESTADOS CENTRALIZADOS ---
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [profileData, setProfileData] = useState({
    name: medico.User.name || "",
  });

  const [horarios, setHorarios] = useState(medico.MedicoHorario);

  // O tipo do ID agora é number | string para evitar erros no TypeScript
  const [ausencias, setAusencias] = useState<
    (Omit<MedicoAusencia, "id"> & { id: number | string })[]
  >(medico.MedicoAusencia);

  // Estado para o formulário de nova ausência
  const [newAusenciaData, setNewAusenciaData] = useState({
    inicio: "",
    fim: "",
    motivo: "",
  });

  // --- FUNÇÕES DE MANIPULAÇÃO DE DADOS ---
  const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setProfileData({ ...profileData, [e.target.name]: e.target.value });
    setIsDirty(true);
  };

  const handleHorarioChange = (
    index: number,
    field: "startMin" | "endMin",
    value: number
  ) => {
    const novosHorarios = [...horarios];
    novosHorarios[index] = { ...novosHorarios[index], [field]: value };
    setHorarios(novosHorarios);
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

  // --- FUNÇÃO MESTRA PARA SALVAR TUDO ---
  const handleSaveAll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isDirty) return;

    setIsSaving(true);
    try {
      const promises = [];

      // 1. Salvar Perfil
      if (profileData.name !== medico.User.name) {
        const profileFormData = new FormData();
        profileFormData.append("name", profileData.name);
        promises.push(updateProfile(medico.userId, profileFormData));
      }

      // 2. Salvar Horários
      if (JSON.stringify(horarios) !== JSON.stringify(medico.MedicoHorario)) {
        const horariosParaSalvar = horarios.map(({ weekday, startMin, endMin }) => ({
          weekday,
          startMin,
          endMin,
        }));
        promises.push(updateHorarios(medico.id, horariosParaSalvar));
      }

      // 3. Sincronizar Ausências
      const originalAusenciaIds = new Set(medico.MedicoAusencia.map((a) => a.id));
      const currentAusenciaIds = new Set(ausencias.map((a) => a.id));

      // Adicionar nova ausência
      if (newAusenciaData.inicio && newAusenciaData.fim) {
        promises.push(
          addAusencia(medico.id, {
            inicio: new Date(newAusenciaData.inicio),
            fim: new Date(newAusenciaData.fim),
            motivo: newAusenciaData.motivo || "",
          })
        );
      }

      // Deletar ausências removidas
      for (const originalId of originalAusenciaIds) {
        if (!currentAusenciaIds.has(originalId)) {
          promises.push(deleteAusencia(originalId));
        }
      }

      await Promise.all(promises);

      // Resetar formulário
      setNewAusenciaData({ inicio: "", fim: "", motivo: "" });
      alert("Alterações salvas com sucesso!");
      setIsDirty(false);

      // OBS: Ideal usar router.refresh() no Next.js aqui
    } catch (error) {
      console.error("Erro ao salvar alterações:", error);
      alert("Ocorreu um erro inesperado ao salvar.");
    } finally {
      setIsSaving(false);
    }
  };

  const diasDaSemana = [
    "Domingo",
    "Segunda",
    "Terça",
    "Quarta",
    "Quinta",
    "Sexta",
    "Sábado",
  ];

  return (
    <form onSubmit={handleSaveAll} className="space-y-12">
      {/* SEÇÃO 1: DADOS PESSOAIS */}
      <div className="p-8 bg-white rounded-lg shadow-md">
        <h2 className="text-xl font-semibold text-gray-700 mb-6">
          Informações Pessoais
        </h2>

        <div className="space-y-4">
          <div className="w-fit flex items-center gap-4 relative">
            <label htmlFor="name" className="label">
              Nome:
            </label>
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

          <div className="flex items-center gap-4">
            <label htmlFor="email" className="label">
              Email:
            </label>
            <input
              type="email"
              id="email"
              value={medico.User.email}
              className="input-disabled"
              disabled
            />
          </div>

          <div className="flex items-center gap-4">
            <label htmlFor="crm" className="label">
              CRM:
            </label>
            <input
              type="text"
              id="crm"
              value={medico.crm || "não informado"}
              className="input-disabled"
              disabled
            />
          </div>
        </div>
      </div>

      {/* SEÇÃO 2: HORÁRIOS DE ATENDIMENTO */}
      <div className="p-8 bg-white rounded-lg shadow-md">
        <h2 className="text-xl font-semibold text-gray-700 mb-6">
          Horários de Atendimento
        </h2>

        <div className="space-y-4">
          {diasDaSemana.map((dia, index) => {
            const horario = horarios.find((h) => h.weekday === index);
            if (!horario) return null;

            return (
              <div
                key={index}
                className="grid grid-cols-4 items-center gap-4 p-2 rounded-md hover:bg-gray-50"
              >
                <span className="font-medium text-gray-600 col-span-1">
                  {dia}
                </span>

                <div className="col-span-1 relative flex w-fit items-center gap-4">
                  <TimeInput
                    value={horario.startMin}
                    onChange={(val) =>
                      handleHorarioChange(horarios.indexOf(horario), "startMin", val)
                    }
                  />
                  <div className="pointer-events-none absolute right-0">
                    <PencilIcon size={16} />
                  </div>
                </div>

                <div className="col-span-1 relative w-fit flex items-center">
                  <TimeInput
                    value={horario.endMin}
                    onChange={(val) =>
                      handleHorarioChange(horarios.indexOf(horario), "endMin", val)
                    }
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

      {/* SEÇÃO 3: AUSÊNCIAS E FÉRIAS */}
      <div className="p-8 bg-white rounded-lg shadow-md">
        <h2 className="text-xl font-semibold text-gray-700 mb-6">
          Adicionar Nova Ausência
        </h2>

        {/* Formulário sem botão "Adicionar" */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end mb-8">
          <div className="md:col-span-1 w-fit flex flex-col gap-1.5">
            <label className="label font-bold">Início</label>
            <input
              type="datetime-local"
              name="inicio"
              className="input"
              value={newAusenciaData.inicio}
              onChange={handleNewAusenciaChange}
            />
          </div>

          <div className="md:col-span-1 w-fit flex flex-col gap-1.5">
            <label className="label font-bold">Fim</label>
            <input
              type="datetime-local"
              name="fim"
              className="input"
              value={newAusenciaData.fim}
              onChange={handleNewAusenciaChange}
            />
          </div>

          <div className="md:col-span-1 flex flex-col w-fit">
            <label className="label font-bold">Motivo (opcional)</label>
            <input
              type="text"
              name="motivo"
              className="input border py-2 px-4"
              value={newAusenciaData.motivo}
              onChange={handleNewAusenciaChange}
            />
          </div>
        </div>

        <h3 className="text-lg font-semibold text-gray-700 mt-8 mb-4 border-t pt-6">
          Ausências Agendadas
        </h3>

        <ul className="space-y-2">
          {ausencias?.map((ausencia) => (
            <li
              key={ausencia.id.toString()}
              className="flex justify-between items-center p-3 bg-gray-100 rounded-md"
            >
              <div>
                <p className="font-semibold">{ausencia.motivo || "Ausência"}</p>
                <p className="text-sm text-gray-500">
                  {new Date(ausencia.inicio).toLocaleString()} -{" "}
                  {new Date(ausencia.fim).toLocaleString()}
                </p>
              </div>

              <button
                type="button"
                onClick={() => handleDeleteAusenciaFromList(ausencia.id.toString())}
                className="text-red-500 hover:text-red-700 font-semibold"
              >
                Excluir
              </button>
            </li>
          ))}

          {ausencias.length === 0 && (
            <p className="text-gray-500">Nenhuma ausência agendada.</p>
          )}
        </ul>
      </div>

      <div className="p-4 bg-white rounded-lg shadow-md text-xs text-red-400">
        As alterações só terão efeito visual após atualizar a página.
      </div>

      {/* BOTÃO ÚNICO FLUTUANTE DE SALVAR TUDO */}
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
