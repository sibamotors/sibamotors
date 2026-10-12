import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useLocalSession } from "@/lib/local-session";
import { listBoards } from "@/lib/local-db";
import { BootScreen } from "@/components/app-shell";
import { LoginScreen } from "@/components/login-screen";
import { WorkspaceLayout } from "@/components/workspace-layout";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const { user, ready } = useLocalSession();
  const boardsQ = useQuery({
    queryKey: ["boards"],
    queryFn: () => listBoards(),
    enabled: Boolean(user),
  });

  if (!ready) return <BootScreen />;
  if (!user) return <LoginScreen />;
  if (boardsQ.isLoading) return <BootScreen />;

  const first = boardsQ.data?.[0];
  if (first) return <Navigate to="/b/$boardId" params={{ boardId: first.id }} />;

  return (
    <WorkspaceLayout>
      <div className="grid min-h-[60vh] place-items-center px-6 text-center">
        <div className="max-w-sm space-y-2">
          <h1 className="text-lg font-semibold">هنوز تخته‌ای نیست</h1>
          <p className="text-sm text-muted">از منوی «تخته‌ها» یک تخته جدید بسازید تا کارها را روی کانبان بگذارید.</p>
        </div>
      </div>
    </WorkspaceLayout>
  );
}
