import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import Profile from "@/components/Profile";
import {
  AnamnesisIcon,
  ArchiveIcon,
  MedicalAppointmentIcon,
  PatientIcon,
  PlusIcon,
} from "./Icons";

export default async function NavBar() {
  // Sessão no servidor
  const session = await getServerSession(authOptions);
  const medicoId = (session?.user as any)?.medicoId ?? null;

  return (
    <nav
      className={`w-56 py-16 px-8 fixed left-0 top-0 h-dvh border-r flex flex-col justify-between`}
    >
      <div>
        <Link href="/" className="font-bold text-4xl mb-16 flex gap-2">
          <h1 className="tracking-wide">
            <span className="text-blue-primary">M</span>
            <span className="text-blue-primary">C</span>
            <span className="text-blue-secondary">I</span>
          </h1>
        </Link>
        {!medicoId ? (
          <p className="">Este usuário não está vinculado a um médico.</p>
        ) : (
          <ul className="flex gap-6 flex-col">
            <li className="">
              <Link
                href="/medico/pacientes"
                className="flex items-center gap-2"
              >
                <PatientIcon />
                <span>Pacientes</span>
              </Link>
            </li>
            <li>
              <Link
                href="/medico/consultas"
                className="flex items-center gap-2"
              >
                <MedicalAppointmentIcon />
                <span>Consultas</span>
              </Link>
            </li>
            <li>
              <Link
                href="/medico/consultas/novo"
                className="flex items-center gap-2"
              >
                <PlusIcon />
                <span>Nova consulta</span>
              </Link>
            </li>
            <li>
              <Link href="/medico/arquivo" className="flex items-center gap-2">
                <ArchiveIcon />
                <span>Arquivos</span>
              </Link>
            </li>
            <li>
              <Link href="/medico/anamnese" className="flex items-center gap-2">
                <AnamnesisIcon />
                <span>Anamnese</span>
              </Link>
            </li>
          </ul>
        )}
      </div>
      <Profile />
    </nav>
  );
}
