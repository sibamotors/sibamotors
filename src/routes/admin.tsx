import { createFileRoute, Navigate } from "@tanstack/react-router";
import { AdminUsersView } from "@/components/admin-users-view";
import { BootScreen } from "@/components/app-shell";
import { WorkspaceLayout } from "@/components/workspace-layout";
import { useLocalSession } from "@/lib/local-session";

export const Route = createFileRoute("/admin")({ component: AdminPage });

function AdminPage() {
  const { user, ready, isAdmin } = useLocalSession();
  if (!ready) return <BootScreen />;
  if (!user) return <Navigate to="/login" />;
  if (!isAdmin) return <Navigate to="/" />;
  return (
    <WorkspaceLayout>
      <AdminUsersView />
    </WorkspaceLayout>
  );
}
