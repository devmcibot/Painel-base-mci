import { PrismaClient } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import PerfilForm from "@/components/PerfilMedico";
import ChangePasswordForm from "@/components/ChangePasswordForm";

const prisma = new PrismaClient();

export default async function PerfilPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return <div>Faça login para acessar o perfil.</div>;

  const userId = Number((session.user as any).id);

  const medico = await prisma.medico.findUnique({
    where: { userId },
    include: {
      User: true,
      MedicoHorario: { orderBy: { weekday: "asc" } },
      MedicoAusencia: { orderBy: { inicio: "desc" } },
    },
  });

  if (!medico) return <div>Seu usuário ainda não está vinculado a um médico.</div>;

  return (
    <div>
      <h1 className="text-3xl font-bold text-black mb-2">Meu Perfil</h1>
      <p className="text-gray-500 mb-8">
        Gerencie suas informações pessoais, horários e ausências.
      </p>

      {/* sua tela atual de perfil (nome/email/crm/horários/ausências etc) */}
      <PerfilForm medico={medico} />

      {/* nova seção: trocar senha */}
      <div className="mt-10">
        <ChangePasswordForm userId={medico.userId} />
      </div>
    </div>
  );
}
