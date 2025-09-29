// src/app/tele/[consultaId]/page.tsx
import { verifyJoin } from "@/lib/tele";
import PatientCall from "./patient-call";

type PageProps = { params: { consultaId: string }, searchParams: { ts?: string; sig?: string } };
export const dynamic = "force-dynamic";

export default function TeleJoinPage({ params, searchParams }: PageProps) {
  const consultaId = Number(params.consultaId || 0);
  const ts = Number(searchParams.ts || 0);
  const sig = String(searchParams.sig || "");

  const check = verifyJoin({ consultaId, ts, sig });
  if (!check.ok) {
    return (
      <main className="max-w-3xl mx-auto p-6">
        <h1 className="text-xl font-semibold">Link inválido</h1>
        <p className="mt-2 text-sm text-red-600">
          O link está expirado ou incorreto. Peça um novo link ao médico.
        </p>
      </main>
    );
  }

  return (
    <main className="max-w-4xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Tele-Consulta</h1>
      <p className="text-sm text-slate-600">Você está entrando como <b>paciente</b>.</p>
      <PatientCall consultaId={consultaId} />
    </main>
  );
}
