import UsersTable from "./users-table";
import LogoutButton from "@/components/LogoutButton";

// sem cache, sempre renderiza de novo
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function AdminUsersPage() {
  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <h1 className="text-xl font-semibold">Usuários</h1>
      <UsersTable />
    </div>
  );
}
