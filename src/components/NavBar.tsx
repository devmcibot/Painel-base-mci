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

type Role = "ADMIN" | "MEDICO" | "MÉDICO";
type SessionUser = {
  medicoId?: number | null;
  role?: Role | null;
  name?: string | null;
  email?: string | null;
};

export default async function NavBar() {
  const session = await getServerSession(authOptions);
  const user = (session?.user as SessionUser | undefined) ?? undefined;
  const medicoId = user?.medicoId ?? null;

  return (
    <nav className="w-56 py-16 px-8 fixed left-0 top-0 h-dvh border-r flex flex-col justify-between">
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

            <li>
              <Link
                href="/medico/teleconsulta"
                className="flex items-center gap-3"
              >
                {/* ícone Vídeo (camera) */}
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="m22 8-6 4 6 4V8Z" />
                  <rect x="2" y="6" width="14" height="12" rx="2" />
                </svg>
                <span>Tele-Consulta</span>
              </Link>
            </li>
          </ul>
        )}
      </div>
      <Profile />
    </nav>
  );
}
