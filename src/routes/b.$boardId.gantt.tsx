import { createFileRoute } from "@tanstack/react-router";
import { GanttView } from "@/components/gantt-view";
import { useBoardCtx } from "@/lib/board-context";

export const Route = createFileRoute("/b/$boardId/gantt")({ component: GanttPage });

function GanttPage() {
  const { board, setOpenCardId } = useBoardCtx();
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <GanttView board={board} onOpenCard={(id) => setOpenCardId(id)} />
    </div>
  );
}
