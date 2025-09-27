// src/app/medico/consultas/novo/page.tsx
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import AgendaPageClient from "./AgendaPageClient";


export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await getServerSession(authOptions);
  const medicoId = (session?.user as any)?.medicoId as number | undefined;

  return (
    <div className="">
      <div>
        <Link href="/medico/consultas" className="underline">&larr; Início</Link>
      </div>
      <h1 className="text-2xl font-semibold">Nova consulta — Agenda</h1>
      {medicoId ? (
        <AgendaPageClient medicoId={medicoId} />
      ) : (
        <div className="p-3 border rounded bg-red-50">
          Não foi possível identificar o médico autenticado.
        </div>
      )}
    </div>
  );
}
