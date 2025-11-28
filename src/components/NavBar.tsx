import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import Profile from "@/components/Profile";
import Image from "next/image";
import logomci from "../assets/logo-mci.png";
import {
  AnamnesisIcon,
  ArchiveIcon,
  CameraIcon,
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
        <Link href="/medico" className="font-bold text-4xl mb-16 flex gap-2">
          <Image src={logomci} alt="logo" width={120} />
        </Link>

        {!medicoId ? (
          <p className="">Este usuário não está vinculado a um médico.</p>
        ) : (
          <ul className="flex gap-6 flex-col">
            <li className="group">
              <Link
                href="/medico/pacientes"
                className="flex items-center gap-2"
              >
                <PatientIcon />
                <div className="relative">
                  {" "}
                  <span>Pacientes</span>
                  <div className="group-hover:w-20 h-0 w-0 group-hover:h-[1px] absolute left-0 botom-0 bg-blue-primary transtion duration-300"></div>{" "}
                </div>
              </Link>
            </li>

            <li className="group">
              <Link
                href="/medico/consultas"
                className="flex items-center gap-2"
              >
                <MedicalAppointmentIcon />
                <div className="relative">
                  {" "}
                  <span>Consultas</span>
                  <div className="group-hover:w-20 h-0 w-0 group-hover:h-[1px] absolute left-0 botom-0 bg-blue-primary transtion duration-300"></div>{" "}
                </div>
              </Link>
            </li>

            <li className="group">
              <Link
                href="/medico/consultas/novo"
                className="flex items-center gap-2"
              >
                <PlusIcon />
                <div className="relative">
                  {" "}
                  <span>Nova consulta</span>
                  <div className="group-hover:w-20 h-0 w-0 group-hover:h-[1px] absolute left-0 botom-0 bg-blue-primary transtion duration-300"></div>{" "}
                </div>
              </Link>
            </li>

            <li className="group">
              <Link href="/medico/arquivo" className="flex items-center gap-2">
                <ArchiveIcon />
                <div className="relative">
                  {" "}
                  <span>Arquivos</span>
                  <div className="group-hover:w-20 h-0 w-0 group-hover:h-[1px] absolute left-0 botom-0 bg-blue-primary transtion duration-300"></div>{" "}
                </div>
              </Link>
            </li>

            <li className="group">
              <Link href="/medico/anamnese" className="flex items-center gap-2">
                <AnamnesisIcon />
                <div className="relative">
                  {" "}
                  <span>Anamnese</span>
                  <div className="group-hover:w-20 h-0 w-0 group-hover:h-[1px] absolute left-0 botom-0 bg-blue-primary transtion duration-300"></div>{" "}
                </div>
              </Link>
            </li>

            <li className="group">
              <Link
                href="/medico/teleconsulta"
                className="flex items-center gap-3"
              >
                <CameraIcon />
                <div className="relative">
                  {" "}
                  <span>Tele consulta</span>
                  <div className="group-hover:w-20 h-0 w-0 group-hover:h-[1px] absolute left-0 botom-0 bg-blue-primary transtion duration-300"></div>{" "}
                </div>
              </Link>
            </li>
          </ul>
        )}
      </div>
      <Profile />
    </nav>
  );
}
