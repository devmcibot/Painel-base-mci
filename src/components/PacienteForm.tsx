"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function PacienteForm() {
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [cpf, setCpf] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [nascimento, setNascimento] = useState(""); // "YYYY-MM-DD"
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErro(null);

    try {
      const res = await fetch("/api/medico/pacientes/novo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome,
          cpf,
          email: email || null,
          telefone: telefone || null,
          nascimento: nascimento || null,
        }),
      });

      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setErro(j?.error || `Falha ao salvar (HTTP ${res.status}).`);
        setLoading(false);
        return;
      }

      // deu bom: volta para a lista
      router.push("/medico/pacientes");
      router.refresh();
    } catch (err: any) {
      setErro("Erro inesperado ao salvar.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 max-w-xl">
      {erro && <p className="text-red-600 text-sm">{erro}</p>}

      <div className="space-y-1">
        <label className="text-sm">Nome</label>
        <input
          className="w-full border px-3 py-2 rounded"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          required
        />
      </div>

      <div className="space-y-1">
        <label className="text-sm">CPF</label>
        <input
          className="w-full border px-3 py-2 rounded"
          value={cpf}
          onChange={(e) => setCpf(e.target.value)}
          required
        />
      </div>

      <div className="space-y-1">
        <label className="text-sm">Data de nascimento</label>
        <input
          type="date"
          className="w-full border px-3 py-2 rounded"
          value={nascimento}
          onChange={(e) => setNascimento(e.target.value)}
        />
      </div>

      <div className="space-y-1">
        <label className="text-sm">Telefone</label>
        <input
          className="w-full border px-3 py-2 rounded"
          value={telefone}
          onChange={(e) => setTelefone(e.target.value)}
          placeholder="(11) 90000-0000"
        />
      </div>

      <div className="space-y-1">
        <label className="text-sm">E-mail (opcional)</label>
        <input
          type="email"
          className="w-full border px-3 py-2 rounded"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="ex: paciente@exemplo.com"
        />
      </div>

      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          disabled={loading}
          className="rounded bg-black text-white px-4 py-2 text-sm disabled:opacity-50"
        >
          {loading ? "Salvando..." : "Salvar"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/medico/pacientes")}
          className="rounded border px-4 py-2 text-sm"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
