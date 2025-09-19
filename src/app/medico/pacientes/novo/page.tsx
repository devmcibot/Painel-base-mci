"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

function maskCPF(v: string) {
  const only = v.replace(/\D/g, "").slice(0, 11);
  const p = only.padEnd(11, " ");
  return `${p.slice(0, 3)}.${p.slice(3, 6)}.${p.slice(6, 9)}-${p.slice(9, 11)}`.trim();
}

function maskDateBR(v: string) {
  const only = v.replace(/\D/g, "").slice(0, 8);
  const p = only.padEnd(8, " ");
  return `${p.slice(0, 2)}/${p.slice(2, 4)}/${p.slice(4, 8)}`.trim();
}

export default function NovoPacientePage() {
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [cpf, setCpf] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [nascimento, setNascimento] = useState("");
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim() || !cpf.trim()) {
      alert("Preencha Nome e CPF.");
      return;
    }
    setSaving(true);
    try {
      const body = {
        nome: nome.trim(),
        cpf: cpf.replace(/\D/g, ""),
        telefone: telefone.trim() || null,
        email: email.trim() || null,
        nascimento: nascimento.trim() || null, // "dd/mm/aaaa"
      };
      const r = await fetch("/api/medico/pacientes/novo", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await r.json().catch(() => ({}));
      if (r.status === 201) {
        router.push("/medico/pacientes");
      } else {
        alert(j?.error ?? r.statusText);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="p-6 space-y-4">
      <div>
        <a href="/medico/pacientes" className="underline">
          &larr; Voltar
        </a>
      </div>

      <h1 className="text-2xl font-semibold">Novo paciente</h1>

      <form onSubmit={onSubmit} className="max-w-3xl border rounded p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-sm">Nome *</label>
            <input
              className="border rounded px-3 py-2"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Nome completo"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm">CPF *</label>
            <input
              className="border rounded px-3 py-2"
              value={cpf}
              onChange={(e) => setCpf(maskCPF(e.target.value))}
              placeholder="000.000.000-00"
              inputMode="numeric"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm">Telefone</label>
            <input
              className="border rounded px-3 py-2"
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              placeholder="(00) 00000-0000"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm">E-mail</label>
            <input
              className="border rounded px-3 py-2"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@exemplo.com"
              type="email"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm">Nascimento (dd/mm/aaaa)</label>
          <input
            className="border rounded px-3 py-2"
            value={nascimento}
            onChange={(e) => setNascimento(maskDateBR(e.target.value))}
            placeholder="dd/mm/aaaa"
            inputMode="numeric"
          />
        </div>

        <button
          disabled={saving}
          className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-50"
        >
          {saving ? "Salvando..." : "Salvar"}
        </button>
      </form>
    </main>
  );
}
