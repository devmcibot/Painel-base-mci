// src/app/medico/pacientes/page.tsx
import Link from "next/link";
import Topbar from "@/components/Topbar";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { headers } from "next/headers";

type PacienteItem = {
  id: number;
  nome: string;
  cpf: string;
  email: string | null;
  telefone: string | null;
  nascimento: string | null; // virá ISO da API
};

function fmtBrDate(iso?: string | null) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("pt-BR");
}

export default async function PacientesPage() {
  const session = await getServerSession(authOptions);
  const medicoId = (session?.user as any)?.medicoId as number | null;

  return (
    <>
      <Topbar />
      <main className="max-w-5xl mx-auto p-6 space-y-6">
        <h1 className="text-xl font-semibold">Pacientes</h1>

        {!medicoId ? (
          <p className="text-gray-600">Este usuário não está vinculado a um médico.</p>
        ) : (
          <PacientesTable medicoId={medicoId} />
        )}
      </main>
    </>
  );
}

async function PacientesTable({ medicoId }: { medicoId: number }) {
  const base = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

  // encaminha cookies para a rota /api
  const hdrs = await headers();
  const cookie = hdrs.get("cookie") ?? "";

  const res = await fetch(`${base}/api/medico/pacientes?medicoId=${medicoId}`, {
    cache: "no-store",
    headers: { cookie },
  });

  if (!res.ok) {
    return (
      <p className="text-red-600">
        Erro ao carregar pacientes (HTTP {res.status}).
      </p>
    );
  }

  const items = (await res.json()) as PacienteItem[];

  return (
    <>
      <div>
        <Link
          href="/medico/pacientes/novo"
          className="inline-block px-4 py-2 rounded bg-black text-white hover:opacity-90"
        >
          Adicionar paciente
        </Link>
      </div>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-gray-50">
            <th className="border px-2 py-1 text-left">ID</th>
            <th className="border px-2 py-1 text-left">Nome</th>
            <th className="border px-2 py-1 text-left">CPF</th>
            <th className="border px-2 py-1 text-left">Nascimento</th>
            <th className="border px-2 py-1 text-left">Telefone</th>
            <th className="border px-2 py-1 text-left">E-mail</th>
          </tr>
        </thead>

        {items.length === 0 ? (
          <tbody>
            <tr>
              <td className="border px-2 py-3 text-center" colSpan={6}>
                Nenhum paciente cadastrado para este médico.
              </td>
            </tr>
          </tbody>
        ) : (
          <tbody>
            {items.map((p) => (
              <tr key={p.id}>
                <td className="border px-2 py-1">{p.id}</td>
                <td className="border px-2 py-1">{p.nome}</td>
                <td className="border px-2 py-1">{p.cpf}</td>
                <td className="border px-2 py-1">{fmtBrDate(p.nascimento)}</td>
                <td className="border px-2 py-1">{p.telefone ?? "-"}</td>
                <td className="border px-2 py-1">{p.email ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        )}
      </table>
    </>
  );
}
