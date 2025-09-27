import { PrismaClient } from '@prisma/client';
import PerfilForm from '@/components/PerfilMedico'; // Ajuste o caminho se necessário

const prisma = new PrismaClient();

// Função para buscar os dados completos do médico
async function getMedicoData(medicoId: number) {
  const medico = await prisma.medico.findUnique({
    where: { id: medicoId },
    include: {
      User: true, // Inclui dados do usuário (nome, email)
      MedicoHorario: { // Inclui os horários de atendimento
        orderBy: { weekday: 'asc' },
      },
      MedicoAusencia: { // Inclui as ausências
        orderBy: { inicio: 'desc' },
      },
    },
  });
  return medico;
}

// A página em si
export default async function PerfilPage() {
  // Em uma aplicação real, você pegaria o ID do médico logado de uma sessão
  const MEDICO_ID = 1; 
  const medicoData = await getMedicoData(MEDICO_ID);

  if (!medicoData || !medicoData.User) {
    return <div>Médico não encontrado.</div>;
  }

  return (
    <div className="">
      <h1 className="text-3xl font-bold text-black mb-2">Meu Perfil</h1>
      <p className="text-gray-500 mb-8">Gerencie suas informações pessoais, horários e ausências.</p>
      
      {/* O formulário interativo recebe os dados como props */}
      <PerfilForm medico={medicoData} />
    </div>
  );
}
