import { PrismaClient } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import PerfilForm from "@/components/PerfilMedico";
import ChangePasswordForm from "@/components/ChangePasswordForm";

const prisma = new PrismaClient();

export default async function PerfilPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return (
      <main className="min-h-screen bg-[#F7F9FC] p-8 md:p-10">
        <h1 className="text-2xl md:text-3xl font-semibold text-[#1E63F3]">Meu Perfil</h1>
        <p className="text-gray-500 mt-1">Faça login para acessar o perfil.</p>
      </main>
    );
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
    return (
      <main className="min-h-screen bg-[#F7F9FC] p-8 md:p-10">
        <h1 className="text-2xl md:text-3xl font-semibold text-[#1E63F3]">Meu Perfil</h1>
        <p className="text-gray-500 mt-1">
          Seu usuário ainda não está vinculado a um médico.
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F7F9FC] p-8 md:p-10">
      <header className="mb-8">
        <h1 className="text-2xl md:text-3xl font-semibold text-[#1E63F3]">
          Meu Perfil
        </h1>
        <p className="text-gray-500 mt-1">
          Gerencie suas informações pessoais, horários e ausências.
        </p>
      </header>

      {/* Formulário de perfil */}
      <section className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden p-4 md:p-6">
        <PerfilForm medico={medico} />
      </section>

      {/* Trocar senha */}
      <section className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden p-4 md:p-6 mt-8">
        <h2 className="text-lg font-semibold text-[#1E63F3] mb-3">Alterar senha</h2>
        <ChangePasswordForm userId={medico.userId} />
      </section>
    </main>
  );
}
