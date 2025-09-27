"use client";

import { useState } from "react";
import { changePassword } from "@/app/medico/perfil/actions";

export default function ChangePasswordForm({ userId }: { userId: number }) {
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);

    const fd = new FormData();
    fd.set("oldPassword", oldPassword);
    fd.set("newPassword", newPassword);
    const res = await changePassword(userId, fd);

    if (res?.error) setMsg(res.error);
    else {
      setMsg("Senha alterada com sucesso!");
      setOldPassword("");
      setNewPassword("");
    }
    setLoading(false);
  }

  return (
    <form onSubmit={onSubmit} className="p-8 bg-white rounded-lg shadow-md space-y-4">
      <h2 className="text-xl font-semibold text-gray-700">Trocar senha</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="label">Senha atual</label>
          <input
            type="password"
            className="w-full border rounded px-3 py-2"
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="label">Nova senha</label>
          <input
            type="password"
            className="w-full border rounded px-3 py-2"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            minLength={6}
            required
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="bg-black text-white rounded px-4 py-2"
      >
        {loading ? "Salvando..." : "Alterar senha"}
      </button>

      {msg && <p className="text-sm mt-2">{msg}</p>}
    </form>
  );
}
