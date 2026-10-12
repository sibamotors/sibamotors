import { createFileRoute } from "@tanstack/react-router";
import { DashboardView } from "@/components/dashboard-view";
import { useBoardCtx } from "@/lib/board-context";

export const Route = createFileRoute("/b/$boardId/report")({ component: ReportPage });

function ReportPage() {
  const { board, setOpenCardId } = useBoardCtx();
  return <DashboardView board={board} onOpenCard={(id) => setOpenCardId(id)} />;
}
