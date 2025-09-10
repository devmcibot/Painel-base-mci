import Topbar from "@/components/Topbar";

export default function AdminHome() {
  return (
    <>
      <Topbar />
      <div className="max-w-5xl mx-auto p-6">
        <h1 className="text-xl font-semibold">Admin • MCI</h1>
        <p className="text-gray-600 mb-4">Área administrativa (apenas ADMIN).</p>

        <ul className="list-disc pl-5 text-sm">
          <li><a className="underline" href="/admin/users">Gerenciar usuários (próximo passo)</a></li>
        </ul>
      </div>
    </>
  );
}
