import Topbar from "@/components/Topbar";
import PacienteForm from "@/components/PacienteForm";
import Link from "next/link";

export default function NovoPacientePage() {
  return (
    <>
      <Topbar />
      <main className="max-w-3xl mx-auto p-6 space-y-6">
        {/* VOLTAR para a lista de pacientes */}
        <div className="mb-2">
          <Link href="/medico/pacientes" className="underline">
            &larr; Voltar
          </Link>
        </div>

        <h1 className="text-xl font-semibold">Adicionar paciente</h1>
        <PacienteForm />
      </main>
    </>
  );
}
