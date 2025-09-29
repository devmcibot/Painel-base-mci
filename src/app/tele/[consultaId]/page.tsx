// src/app/tele/[consultaId]/page.tsx
import PatientCall from "./patient-call";

export const dynamic = "force-dynamic";

export default function TelePublicPage({
  params,
}: {
  params: { consultaId: string };
}) {
  const id = Number(params.consultaId) || 0;

  return (
    <main className="max-w-3xl mx-auto p-6 space-y-4">
      <h1 className="text-xl font-semibold">Teleconsulta</h1>
      {id ? (
        <PatientCall consultaId={id} />
      ) : (
        <p className="text-red-600">Link inválido.</p>
      )}
    </main>
  );
}
