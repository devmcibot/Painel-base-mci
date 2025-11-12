import LogoutButton from "@/components/LogoutButton";

export const dynamic = "force-dynamic";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-5xl mx-auto p-6">
      <header className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-semibold">Painel Administrativo • MCI</h1>
        <LogoutButton />
      </header>

      <main>{children}</main>
    </div>
  );
}
