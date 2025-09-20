"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

export default function DeleteConsultaButton({ id }: { id: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <button
      onClick={() =>
        start(async () => {
          if (!confirm(`Excluir consulta #${id}?`)) return;
          const r = await fetch(`/api/medico/consultas/${id}`, {
            method: "DELETE",
          });
          if (r.ok) router.refresh();
          else {
            const j = await r.json().catch(() => ({}));
            alert(`Falha ao excluir: ${j?.error ?? r.statusText}`);
          }
        })
      }
      className="text-red-600 underline disabled:opacity-50"
      disabled={pending}
    >
      {pending ? "Excluindo..." : "excluir"}
    </button>
  );
}
