"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function PacienteForm() {
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [cpf, setCpf] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [nascimento, setNascimento] = useState(""); // "yyyy-mm-dd" (type="date")
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErro(null);

    try {
      // 🔧 POST na rota correta: /api/medico/pacientes (conforme a route que você atualizou)
      const res = await fetch("/api/medico/pacientes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: nome.trim(),
          cpf: cpf.trim(),
          email: email.trim() || undefined,      // opcional
          telefone: telefone.trim() || undefined, // opcional
          nascimento: nascimento || undefined,    // "yyyy-mm-dd" (a API converte p/ Date)
        }),
      });

      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setErro(j?.error || `Falha ao salvar (HTTP ${res.status}).`);
        setLoading(false);
        return;
      }

      router.push("/medico/pacientes");
      router.refresh();
    } catch {
      setErro("Erro inesperado ao salvar.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 max-w-xl">
      {erro && <p className="text-red-600 text-sm">{erro}</p>}

      <div className="space-y-1">
        <label className="text-sm" htmlFor="nome">Nome</label>
        <input
          id="nome"
          name="nome"
          className="w-full border px-3 py-2 rounded"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          required
        />
      </div>

      <div className="space-y-1">
        <label className="text-sm" htmlFor="cpf">CPF</label>
        <input
          id="cpf"
          name="cpf"
          className="w-full border px-3 py-2 rounded"
          value={cpf}
          onChange={(e) => setCpf(e.target.value)}
          required
        />
      </div>

      <div className="space-y-1">
        <label className="text-sm" htmlFor="nascimento">Data de nascimento</label>
        <input
          id="nascimento"
          name="nascimento"
          type="date"
          className="w-full border px-3 py-2 rounded"
          value={nascimento}
          onChange={(e) => setNascimento(e.target.value)} // "yyyy-mm-dd"
        />
      </div>

      <div className="space-y-1">
        <label className="text-sm" htmlFor="telefone">Telefone</label>
        <input
          id="telefone"
          name="telefone"
          className="w-full border px-3 py-2 rounded"
          value={telefone}
          onChange={(e) => setTelefone(e.target.value)}
          placeholder="(11) 90000-0000"
        />
      </div>

      <div className="space-y-1">
        <label className="text-sm" htmlFor="email">E-mail (opcional)</label>
        <input
          id="email"
          name="email"
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
