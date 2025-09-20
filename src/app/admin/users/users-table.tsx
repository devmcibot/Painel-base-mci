"use client";

import { useEffect, useState } from "react";

type User = {
  id: number;
  name: string;
  email: string;
  role: "ADMIN" | "MEDICO";
  status: "ACTIVE" | "BLOCKED";
  createdAt?: string;
};

export default function UsersTable() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    crm: "",
    role: "MEDICO" as "ADMIN" | "MEDICO",
  });
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/users", { cache: "no-store" });
    const data = await res.json();
    setUsers(data);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setErr(j.error || "Erro ao criar usuário");
      return;
    }
    setForm({ name: "", email: "", password: "", crm: "", role: "MEDICO" });
    await load();
  }

  async function toggleBlock(u: User) {
    const newStatus = u.status === "ACTIVE" ? "BLOCKED" : "ACTIVE";
    await fetch(`/api/admin/users/${u.id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    await load();
  }

  return (
    <div className="space-y-6">
      <form onSubmit={createUser} className="flex flex-wrap gap-2 items-end">
        <div className="flex flex-col">
          <label className="text-xs">Nome</label>
          <input
            className="border rounded px-3 py-2"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>

        <div className="flex flex-col">
          <label className="text-xs">E-mail</label>
          <input
            className="border rounded px-3 py-2"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </div>

        <div className="flex flex-col">
          <label className="text-xs">Senha</label>
          <input
            className="border rounded px-3 py-2"
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
        </div>

        <div className="flex flex-col">
          <label className="text-xs">Papel</label>
          <select
            className="border rounded px-3 py-2"
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value as "ADMIN" | "MEDICO" })}
          >
            <option value="MEDICO">MÉDICO</option>
            <option value="ADMIN">ADMIN</option>
          </select>
        </div>

        <div className="flex flex-col">
          <label className="text-xs">CRM (opcional)</label>
          <input
            className="border rounded px-3 py-2"
            value={form.crm}
            onChange={(e) => setForm({ ...form, crm: e.target.value })}
            disabled={form.role === "ADMIN"}
            placeholder={form.role === "ADMIN" ? "Não aplicável para ADMIN" : ""}
          />
        </div>

        <button className="px-4 py-2 rounded bg-black text-white">Adicionar usuário</button>
        {err && <span className="text-red-600 text-sm ml-2">{err}</span>}
      </form>

      {loading ? (
        <div>Carregando...</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm border">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-2 border">ID</th>
                <th className="text-left p-2 border">Nome</th>
                <th className="text-left p-2 border">E-mail</th>
                <th className="text-left p-2 border">Papel</th>
                <th className="text-left p-2 border">Status</th>
                <th className="text-left p-2 border">Ações</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="p-2 border">{u.id}</td>
                  <td className="p-2 border">{u.name}</td>
                  <td className="p-2 border">{u.email}</td>
                  <td className="p-2 border">{u.role}</td>
                  <td className="p-2 border">{u.status}</td>
                  <td className="p-2 border">
                    <button
                      onClick={() => toggleBlock(u)}
                      className="px-3 py-1 rounded border hover:bg-gray-50"
                    >
                      {u.status === "ACTIVE" ? "Bloquear" : "Desbloquear"}
                    </button>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-4 text-center">
                    Nenhum usuário
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
