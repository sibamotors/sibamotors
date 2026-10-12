import { createFileRoute } from "@tanstack/react-router";
import { Kanban } from "@/components/board/kanban";
import { useBoardCtx } from "@/lib/board-context";

export const Route = createFileRoute("/b/$boardId/")({ component: BoardPage });

function BoardPage() {
  const ctx = useBoardCtx();
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Kanban
        board={ctx.board}
        query={ctx.search}
        onOpenCard={(c) => ctx.setOpenCardId(c.id)}
        onAddCard={ctx.addCard}
        onRenameList={ctx.rename}
        onDeleteList={ctx.removeList}
        onAddList={ctx.addList}
        onMoveCard={ctx.shiftCard}
        onMoveList={ctx.shiftList}
        onCreateLabel={ctx.addLabel}
        onDeleteLabel={ctx.removeLabel}
      />
    </div>
  );
}
