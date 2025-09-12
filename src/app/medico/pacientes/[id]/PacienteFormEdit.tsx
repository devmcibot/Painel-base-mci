"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  id: number;
  initial: {
    nome: string;
    cpf: string;
    email: string;
    telefone: string;
    nascimento: string; // "yyyy-mm-dd" ou ""
  };
};

export default function PacienteFormEdit({ id, initial }: Props) {
  const router = useRouter();

  const [nome, setNome] = useState(initial.nome);
  const [cpf, setCpf] = useState(initial.cpf);
  const [email, setEmail] = useState(initial.email);
  const [telefone, setTelefone] = useState(initial.telefone);
  const [nascimento, setNascimento] = useState(initial.nascimento);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErro(null);

    const payload = {
      nome: nome.trim(),
      cpf: cpf.trim(),
      email: email.trim() || null,
      telefone: telefone.trim() || null,
      nascimento: nascimento || null, // "" -> null
    };

    const r = await fetch(`/api/medico/pacientes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setSaving(false);

    if (r.ok) {
      alert("Paciente atualizado!");
      router.push("/medico/pacientes");
      router.refresh();
      return;
    }

    const j = await r.json().catch(() => ({}));
    setErro(j?.error || `Erro (HTTP ${r.status}).`);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {erro && <p className="text-red-600 text-sm">{erro}</p>}

      <div>
        <label className="block text-sm font-medium mb-1">Nome</label>
        <input
          className="border rounded w-full p-2"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">CPF</label>
        <input
          className="border rounded w-full p-2"
          value={cpf}
          onChange={(e) => setCpf(e.target.value)}
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Data de nascimento</label>
        <input
          type="date"
          className="border rounded w-full p-2"
          value={nascimento}
          onChange={(e) => setNascimento(e.target.value)}
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Telefone</label>
        <input
          className="border rounded w-full p-2"
          value={telefone}
          onChange={(e) => setTelefone(e.target.value)}
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">E-mail</label>
        <input
          type="email"
          className="border rounded w-full p-2"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 rounded bg-black text-white disabled:opacity-60"
        >
          {saving ? "Salvando..." : "Salvar"}
        </button>
        <a href="/medico/pacientes" className="px-4 py-2 rounded border">
          Cancelar
        </a>
      </div>
    </form>
  );
}
