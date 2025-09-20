import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { headers } from "next/headers";

type PacienteItem = {
  id: number;
  nome: string;
  cpf: string;
  email: string | null;
  telefone: string | null;
  nascimento: string | null; // ISO
};

// aceita ISO completo ou "yyyy-mm-dd"
function fmtBrDate(val?: string | null) {
  if (!val) return "-";
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(val) ? `${val}T12:00:00` : val;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "-" : d.toLocaleDateString("pt-BR");
}

export default async function PacientesPage() {
  const session = await getServerSession(authOptions);
  const medicoId = (session?.user as any)?.medicoId as number | null;

  return (
    <>
      <div className="">
        {/* VOLTAR para a Home do médico */}
        <div className="mb-2">
          <Link href="/medico" className="underline">
            &larr; Voltar
          </Link>
        </div>

        <h1 className="text-xl font-semibold">Pacientes</h1>

        {!medicoId ? (
          <p className="">Este usuário não está vinculado a um médico.</p>
        ) : (
          <PacientesTable medicoId={medicoId} />
        )}
      </div>
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
            <th className="border px-2 py-1 text-left">Ações</th>
          </tr>
        </thead>

        {items.length === 0 ? (
          <tbody>
            <tr>
              <td className="border px-2 py-3 text-center" colSpan={7}>
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
                <td className="border px-2 py-1">
                  <Link
                    href={`/medico/pacientes/${p.id}`}
                    className="underline"
                  >
                    editar
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        )}
      </table>
    </>
  );
}
