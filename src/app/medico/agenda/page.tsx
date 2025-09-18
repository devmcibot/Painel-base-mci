import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import AgendaTester from "./tester"; // <- IMPORTA O CLIENT COMPONENT

export const dynamic = "force-dynamic";

export default async function MedicoAgendaPage() {
  const session = await getServerSession(authOptions);
  const medicoId = (session?.user as any)?.medicoId as number | null;

  if (!medicoId) {
    return (
      <main className="max-w-3xl mx-auto p-6">
        <h1 className="text-xl font-semibold">Agenda</h1>
        <p>Não foi possível identificar o médico da sessão.</p>
      </main>
    );
  }

  return (
    <main className="max-w-3xl mx-auto p-6 space-y-6">
      <h1 className="text-xl font-semibold">Agenda — teste de disponibilidade</h1>
      <AgendaTester medicoId={medicoId} />
    </main>
  );
}
