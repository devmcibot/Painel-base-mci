// src/app/medico/teleconsulta/page.tsx
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import TeleForm from "./tele-form";

export const dynamic = "force-dynamic";

export default async function TeleConsultaPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login?callbackUrl=/medico/teleconsulta");

  // Aqui você pode buscar pacientes/consultas do médico (Prisma) e passar via props.
  // Para MVP, deixo o form que recebe manualmente (id numérico) só para validar o fluxo.
  return (
    <main className="max-w-4xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Tele-Consulta (MVP)</h1>
      <TeleForm />
    </main>
  );
}
