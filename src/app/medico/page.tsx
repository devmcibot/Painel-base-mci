import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export const dynamic = "force-dynamic";

export default async function MedicoHome() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login?callbackUrl=/medico");

  return <div className="max-w-5xl mx-auto p-6">página inicial do médico</div>;
}
