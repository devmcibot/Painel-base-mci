import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import PerfilForm from "@/components/PerfilMedico";

export default async function PerfilPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return <div>Faça login para acessar o perfil.</div>;
  }

  const userId = Number((session.user as any).id);

  const medico = await prisma.medico.findUnique({
    where: { userId },
    include: {
      User: true,
      MedicoHorario: { orderBy: { weekday: "asc" } },
      MedicoAusencia: { orderBy: { inicio: "desc" } },
    },
  });

  if (!medico) {
    return <div>Seu usuário ainda não está vinculado a um médico.</div>;
  }

  return (
    <div className="">
      <h1 className="text-3xl font-bold text-black mb-2">Meu Perfil</h1>
      <p className="text-gray-500 mb-8">Gerencie suas informações pessoais, horários e ausências.</p>
      <PerfilForm medico={medico} />
    </div>
  );
}
