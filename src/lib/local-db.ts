// Shared workspace data layer.
//
// This used to read/write the browser's localStorage, so every user had a
// private, never-synced copy of the boards/tasks/people. Every export below
// now runs on the SERVER (via TanStack Start's `createServerFn`) against the
// `workspace_state` table in Postgres (see migrations/0002_workspace.sql), so
// every user — any device, any browser — sees the exact same data.
//
// The exported function names, input shapes (`{ data: {...} }`) and return
// types are unchanged from before on purpose, so every component that already
// calls these (board-context.tsx, workspace-layout.tsx, routes/*, ...) keeps
// working without modification.
import { createServerFn } from "@tanstack/react-start";
import { getSql } from "./db";
import type { LocalUser } from "./session-types";
import {
  adminMiddleware,
  authMiddleware,
  requireBoardAction,
  workspaceWriteLock,
} from "./session-middleware";
import { addDaysIso, isoToday } from "./jalali";
import type { Board, BoardSummary, Card, ChecklistItem, Label, List, Person, Priority } from "./types";
import { mid, nid } from "./utils";

const WORKSPACE_ID = "main";

function clampProgress(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

type Workspace = {
  people: Person[];
  boards: Board[];
  archivedBoards?: Board[];
};

function isWorkspace(v: unknown): v is Workspace {
  return Boolean(v) && Array.isArray((v as Workspace).boards) && Array.isArray((v as Workspace).people);
}

function normalizeWorkspace(ws: Workspace): Workspace {
  if (!Array.isArray(ws.archivedBoards)) ws.archivedBoards = [];
  for (const b of ws.boards) {
    b.people = ws.people;
    if (!Array.isArray(b.labels)) b.labels = [];
    if (!Array.isArray(b.lists)) b.lists = [];
    for (const l of b.lists) {
      if (!Array.isArray(l.cards)) l.cards = [];
      for (const c of l.cards) {
        if (!Array.isArray(c.checklists)) c.checklists = [];
        if (!Array.isArray(c.comments)) c.comments = [];
        if (!Array.isArray(c.activities)) c.activities = [];
        if (!Array.isArray(c.dependsOnIds)) c.dependsOnIds = [];
        if (c.enteredListAt === undefined) c.enteredListAt = c.createdAt || null;
        if (!Array.isArray(c.memberIds)) c.memberIds = [];
        if (!Array.isArray(c.labelIds)) c.labelIds = [];
        for (const ch of c.checklists) {
          if (!Array.isArray(ch.items)) ch.items = [];
        }
      }
    }
  }
  return ws;
}


/** Load the single shared workspace row from Postgres, seeding it on first use. */
async function loadWorkspace(): Promise<Workspace> {
  const sql = await getSql();
  const rows = await sql<{ data: unknown }>`select data from workspace_state where id = ${WORKSPACE_ID}`;
  const raw = rows[0]?.data;
  const parsed = typeof raw === "string" ? (JSON.parse(raw) as unknown) : raw;
  if (isWorkspace(parsed)) return normalizeWorkspace(parsed);
  const seeded = createSeedWorkspace();
  await saveWorkspace(seeded);
  return seeded;
}

async function saveWorkspace(ws: Workspace): Promise<void> {
  const sql = await getSql();
  await sql`
    insert into workspace_state (id, data, updated_at)
    values (${WORKSPACE_ID}, ${JSON.stringify(ws)}::jsonb, now())
    on conflict (id) do update set data = excluded.data, updated_at = now()
  `;
}

function findBoard(ws: Workspace, id: string): Board | undefined {
  return ws.boards.find((b) => b.id === id);
}

function allCards(board: Board): Card[] {
  return board.lists.flatMap((l) => l.cards);
}

/** Serializes the whole workspace (boards + people) for manual backup. Runs server-side. */
export const exportWorkspaceJson = createServerFn({ method: "GET" }).middleware([adminMiddleware]).handler(async (): Promise<string> => {
  const ws = await loadWorkspace();
  return JSON.stringify(ws, null, 2);
});

/** Restores a workspace previously produced by exportWorkspaceJson. Replaces the SHARED workspace for everyone. */
export const importWorkspaceJson = createServerFn({ method: "POST" }).middleware([adminMiddleware, workspaceWriteLock])
  .validator((raw: string) => raw)
  .handler(async ({ data: raw }): Promise<{ ok: true } | { ok: false; error: string }> => {
    if (typeof raw !== "string" || raw.length > 20_000_000) {
      return { ok: false, error: "فایل پشتیبان خیلی بزرگ است." };
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return { ok: false, error: "فایل پشتیبان معتبر نیست (JSON خراب است)." };
    }
    if (!isWorkspace(parsed)) {
      return { ok: false, error: "ساختار فایل پشتیبان با این برنامه سازگار نیست." };
    }
    await saveWorkspace(parsed);
    return { ok: true };
  });

export const listBoards = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(async (): Promise<BoardSummary[]> => {
  const ws = await loadWorkspace();
  return ws.boards.map((b) => ({
    id: b.id,
    title: b.title,
    description: b.description,
    createdAt: b.lists[0]?.cards[0]?.createdAt ?? isoToday(),
    cardCount: allCards(b).filter((c) => !c.archived).length,
  }));
});

export const getBoard = createServerFn({ method: "GET" }).middleware([authMiddleware])
  .validator((data: { boardId: string }) => data)
  .handler(async ({ data }): Promise<Board | null> => {
    const ws = await loadWorkspace();
    const b = findBoard(ws, data.boardId);
    if (!b) return null;
    return { ...b, people: ws.people };
  });

export const createBoard = createServerFn({ method: "POST" }).middleware([requireBoardAction("create_board"), workspaceWriteLock])
  .validator((data: { title: string; description?: string }) => data)
  .handler(async ({ data }) => {
    const ws = await loadWorkspace();
    const board = newEmptyBoard(ws, data.title, data.description ?? "");
    ws.boards.unshift(board);
    await saveWorkspace(ws);
    return { id: board.id };
  });

export const renameBoard = createServerFn({ method: "POST" }).middleware([requireBoardAction("rename_board"), workspaceWriteLock])
  .validator((data: { boardId: string; title: string }) => data)
  .handler(async ({ data }) => {
    const ws = await loadWorkspace();
    const b = findBoard(ws, data.boardId);
    if (b) b.title = data.title;
    await saveWorkspace(ws);
    return { ok: true as const };
  });

export const archiveBoard = createServerFn({ method: "POST" }).middleware([requireBoardAction("archive_board"), workspaceWriteLock])
  .validator((data: { boardId: string }) => data)
  .handler(async ({ data }) => {
    const ws = await loadWorkspace();
    if (!ws.archivedBoards) ws.archivedBoards = [];
    const idx = ws.boards.findIndex((b) => b.id === data.boardId);
    if (idx < 0) return { ok: true as const };
    const [board] = ws.boards.splice(idx, 1);
    if (board) ws.archivedBoards.unshift(board);
    await saveWorkspace(ws);
    return { ok: true as const };
  });

export const listArchivedBoards = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(async (): Promise<BoardSummary[]> => {
  const ws = await loadWorkspace();
  return (ws.archivedBoards ?? []).map((b) => ({
    id: b.id,
    title: b.title,
    description: b.description,
    createdAt: b.lists[0]?.cards[0]?.createdAt ?? isoToday(),
    cardCount: allCards(b).filter((c) => !c.archived).length,
  }));
});

export const restoreBoard = createServerFn({ method: "POST" }).middleware([requireBoardAction("archive_board"), workspaceWriteLock])
  .validator((data: { boardId: string }) => data)
  .handler(async ({ data }) => {
    const ws = await loadWorkspace();
    if (!ws.archivedBoards) ws.archivedBoards = [];
    const idx = ws.archivedBoards.findIndex((b) => b.id === data.boardId);
    if (idx < 0) throw new Error("تخته بایگانی‌شده پیدا نشد");
    const [board] = ws.archivedBoards.splice(idx, 1);
    if (board) ws.boards.unshift(board);
    await saveWorkspace(ws);
    return { ok: true as const };
  });

/** Permanent delete — only from archived list. */
export const deleteBoardPermanently = createServerFn({ method: "POST" }).middleware([requireBoardAction("archive_board"), workspaceWriteLock])
  .validator((data: { boardId: string }) => data)
  .handler(async ({ data }) => {
    const ws = await loadWorkspace();
    if (!ws.archivedBoards) ws.archivedBoards = [];
    ws.archivedBoards = ws.archivedBoards.filter((b) => b.id !== data.boardId);
    // also allow delete from active if forced
    ws.boards = ws.boards.filter((b) => b.id !== data.boardId);
    await saveWorkspace(ws);
    return { ok: true as const };
  });

export const createList = createServerFn({ method: "POST" }).middleware([requireBoardAction("create_list"), workspaceWriteLock])
  .validator((data: { boardId: string; title: string; position: number }) => data)
  .handler(async ({ data }) => {
    const ws = await loadWorkspace();
    const b = findBoard(ws, data.boardId);
    if (!b) throw new Error("تخته پیدا نشد");
    const id = nid();
    b.lists.push({ id, boardId: b.id, title: data.title, position: data.position, cards: [] });
    b.lists.sort((a, c) => a.position - c.position);
    await saveWorkspace(ws);
    return { id };
  });

export const renameList = createServerFn({ method: "POST" }).middleware([requireBoardAction("rename_list"), workspaceWriteLock])
  .validator((data: { id: string; title: string }) => data)
  .handler(async ({ data }) => {
    const ws = await loadWorkspace();
    for (const b of ws.boards) {
      const l = b.lists.find((x) => x.id === data.id);
      if (l) {
        l.title = data.title;
        await saveWorkspace(ws);
        return { ok: true as const };
      }
    }
    return { ok: true as const };
  });

export const deleteList = createServerFn({ method: "POST" }).middleware([requireBoardAction("delete_list"), workspaceWriteLock])
  .validator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const ws = await loadWorkspace();
    for (const b of ws.boards) {
      b.lists = b.lists.filter((l) => l.id !== data.id);
    }
    await saveWorkspace(ws);
    return { ok: true as const };
  });

export const moveList = createServerFn({ method: "POST" }).middleware([requireBoardAction("move_list"), workspaceWriteLock])
  .validator((data: { id: string; position: number }) => data)
  .handler(async ({ data }) => {
    const ws = await loadWorkspace();
    for (const b of ws.boards) {
      const l = b.lists.find((x) => x.id === data.id);
      if (l) {
        l.position = data.position;
        b.lists.sort((a, c) => a.position - c.position);
        await saveWorkspace(ws);
        return { ok: true as const };
      }
    }
    return { ok: true as const };
  });

type CardPatch = Partial<Card> & { id?: string; boardId?: string; listId?: string; title?: string };

export const createCard = createServerFn({ method: "POST" }).middleware([requireBoardAction("create_card"), workspaceWriteLock])
  .validator((data: CardPatch & { boardId: string; listId: string; title: string }) => data)
  .handler(async ({ data: d }) => {
    const ws = await loadWorkspace();
    const b = findBoard(ws, d.boardId);
    if (!b) throw new Error("تخته پیدا نشد");
    const list = b.lists.find((l) => l.id === d.listId);
    if (!list) throw new Error("ستون پیدا نشد");
    const id = nid();
    const card: Card = {
      id,
      listId: d.listId,
      boardId: d.boardId,
      title: d.title,
      notes: d.notes ?? "",
      priority: (d.priority as Priority) ?? "med",
      dueDate: d.dueDate ?? null,
      startDate: d.startDate ?? null,
      coverColor: d.coverColor ?? null,
      position: d.position ?? mid(list.cards[list.cards.length - 1]?.position, undefined),
      archived: false,
      followerId: d.followerId ?? null,
      memberIds: d.memberIds ?? [],
      labelIds: d.labelIds ?? [],
      progress: typeof d.progress === "number" ? clampProgress(d.progress) : 0,
      createdAt: isoToday(),
      checklists: Array.isArray(d.checklists) ? d.checklists : [],
      comments: [],
      activities: [{ id: nid(), at: new Date().toISOString(), by: "سیستم", text: "کارت ایجاد شد" }],
      dependsOnIds: Array.isArray(d.dependsOnIds) ? d.dependsOnIds : [],
      enteredListAt: new Date().toISOString(),
    };
    list.cards.push(card);
    await saveWorkspace(ws);
    return { id };
  });

/**
 * The card editor always sends the WHOLE card, so we only look at the fields that
 * really CHANGED and require the matching permission for each of them.
 */
function assertPatchAllowed(card: Card, d: Partial<Card>, denied: Set<string>): void {
  const norm = (v: unknown) => JSON.stringify(v ?? null);
  const changed = (k: keyof Card) => d[k] !== undefined && norm(d[k]) !== norm(card[k]);
  const need = new Set<string>();
  if (changed("title") || changed("notes") || changed("coverColor") || changed("labelIds") || changed("dependsOnIds")) {
    need.add("edit_card");
  }
  if (changed("memberIds") || changed("followerId")) need.add("assign_people");
  if (changed("dueDate") || changed("startDate")) need.add("change_dates");
  if (changed("priority")) need.add("change_priority");
  if (changed("progress")) need.add("change_progress");
  if (changed("listId") || changed("position")) need.add("move_card");
  for (const action of need) if (denied.has(action)) throw new Error("ACTION_LOCKED");
}

async function applyCardPatch(d: Partial<Card> & { id: string }, user: LocalUser): Promise<{ ok: true }> {
  const { deniedActionsFor } = await import("./server/permissions.server");
  const denied = new Set(await deniedActionsFor(user));
  const ws = await loadWorkspace();
  for (const b of ws.boards) {
    for (const l of b.lists) {
      const idx = l.cards.findIndex((c) => c.id === d.id);
      if (idx < 0) continue;
      let card = l.cards[idx]!;
      assertPatchAllowed(card, d, denied);
      if (d.listId && d.listId !== l.id) {
        const dest = b.lists.find((x) => x.id === d.listId);
        if (dest) {
          l.cards.splice(idx, 1);
          card = { ...card, listId: dest.id, enteredListAt: new Date().toISOString() };
          dest.cards.push(card);
        }
      }
      Object.assign(card, {
        ...(d.title != null ? { title: d.title } : {}),
        ...(d.notes != null ? { notes: d.notes } : {}),
        ...(d.priority != null ? { priority: d.priority } : {}),
        ...(d.dueDate !== undefined ? { dueDate: d.dueDate } : {}),
        ...(d.startDate !== undefined ? { startDate: d.startDate } : {}),
        ...(d.coverColor !== undefined ? { coverColor: d.coverColor } : {}),
        ...(d.followerId !== undefined ? { followerId: d.followerId } : {}),
        ...(d.memberIds ? { memberIds: d.memberIds } : {}),
        ...(d.labelIds ? { labelIds: d.labelIds } : {}),
        ...(d.dependsOnIds ? { dependsOnIds: d.dependsOnIds } : {}),
        ...(d.progress != null ? { progress: clampProgress(d.progress) } : {}),
        ...(d.position != null ? { position: d.position } : {}),
      });
      await saveWorkspace(ws);
      return { ok: true as const };
    }
  }
  return { ok: true as const };
}

export const updateCard = createServerFn({ method: "POST" }).middleware([authMiddleware, workspaceWriteLock])
  .validator((data: Partial<Card> & { id: string }) => data)
  .handler(async ({ data, context }) => applyCardPatch(data, context.user));

export const moveCard = createServerFn({ method: "POST" }).middleware([authMiddleware, workspaceWriteLock])
  .validator((data: { id: string; listId: string; position: number }) => data)
  .handler(async ({ data, context }) => applyCardPatch(data, context.user));


export const moveCardToBoard = createServerFn({ method: "POST" }).middleware([requireBoardAction("move_card"), workspaceWriteLock])
  .validator((data: { cardId: string; targetBoardId: string; targetListId: string }) => data)
  .handler(async ({ data }) => {
    const ws = await loadWorkspace();
    let card: Card | null = null;
    let sourceBoardId = "";
    for (const b of ws.boards) {
      for (const l of b.lists) {
        const idx = l.cards.findIndex((c) => c.id === data.cardId);
        if (idx < 0) continue;
        card = l.cards[idx]!;
        sourceBoardId = b.id;
        l.cards.splice(idx, 1);
        break;
      }
      if (card) break;
    }
    if (!card) throw new Error("کارت پیدا نشد");
    const destBoard = findBoard(ws, data.targetBoardId);
    if (!destBoard) throw new Error("تخته مقصد پیدا نشد");
    const destList = destBoard.lists.find((l) => l.id === data.targetListId);
    if (!destList) throw new Error("ستون مقصد پیدا نشد");
    const moved: Card = {
      ...card,
      boardId: data.targetBoardId,
      listId: data.targetListId,
      position: mid(destList.cards[destList.cards.length - 1]?.position, undefined),
      enteredListAt: new Date().toISOString(),
      activities: [
        {
          id: nid(),
          at: new Date().toISOString(),
          by: "سیستم",
          text: sourceBoardId === data.targetBoardId ? "جابه‌جایی ستون" : "انتقال به تخته دیگر",
        },
        ...(card.activities || []),
      ].slice(0, 50),
    };
    destList.cards.push(moved);
    await saveWorkspace(ws);
    return { ok: true as const, id: moved.id };
  });

export const deleteCard = createServerFn({ method: "POST" }).middleware([requireBoardAction("delete_card"), workspaceWriteLock])
  .validator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const ws = await loadWorkspace();
    for (const b of ws.boards) {
      for (const l of b.lists) {
        l.cards = l.cards.filter((c) => c.id !== data.id);
      }
    }
    await saveWorkspace(ws);
    return { ok: true as const };
  });

export const addComment = createServerFn({ method: "POST" }).middleware([requireBoardAction("comment"), workspaceWriteLock])
  .validator((data: { cardId: string; body: string; author?: string }) => data)
  .handler(async ({ data, context }) => {
    const ws = await loadWorkspace();
    const id = nid();
    for (const b of ws.boards) {
      for (const l of b.lists) {
        const c = l.cards.find((x) => x.id === data.cardId);
        if (c) {
          c.comments.push({
            id,
            body: String(data.body).slice(0, 5000),
            createdAt: new Date().toISOString(),
            author: context.user.displayName, // always the real logged-in user
          });
          pushActivity(c, context.user.displayName, "نظر ثبت کرد");
          await saveWorkspace(ws);
          const mentions = Array.from(
            new Set(
              (data.body.match(/@([a-z0-9._-]+)/gi) || []).map((m) => m.slice(1).toLowerCase()),
            ),
          );
          return { id, mentions, cardTitle: c.title, boardId: c.boardId };
        }
      }
    }
    throw new Error("کارت پیدا نشد");
  });

export const saveChecklist = createServerFn({ method: "POST" }).middleware([requireBoardAction("manage_checklists"), workspaceWriteLock])
  .validator((data: { cardId: string; id?: string; title: string; items: ChecklistItem[]; position?: number }) => data)
  .handler(async ({ data: d }) => {
    const ws = await loadWorkspace();
    for (const b of ws.boards) {
      for (const l of b.lists) {
        const c = l.cards.find((x) => x.id === d.cardId);
        if (!c) continue;
        if (d.id) {
          const ch = c.checklists.find((x) => x.id === d.id);
          if (ch) {
            ch.title = d.title;
            ch.items = d.items;
          }
        } else {
          c.checklists.push({
            id: nid(),
            title: d.title,
            items: d.items,
            position: d.position ?? (c.checklists.length + 1) * 1000,
          });
        }
        await saveWorkspace(ws);
        return { id: d.id ?? c.checklists[c.checklists.length - 1]!.id };
      }
    }
    throw new Error("کارت پیدا نشد");
  });

export const deleteChecklist = createServerFn({ method: "POST" }).middleware([requireBoardAction("manage_checklists"), workspaceWriteLock])
  .validator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const ws = await loadWorkspace();
    for (const b of ws.boards) {
      for (const l of b.lists) {
        for (const c of l.cards) {
          c.checklists = c.checklists.filter((ch) => ch.id !== data.id);
        }
      }
    }
    await saveWorkspace(ws);
    return { ok: true as const };
  });

function findChecklist(ws: Workspace, checklistId: string) {
  for (const b of ws.boards) {
    for (const l of b.lists) {
      for (const c of l.cards) {
        const ch = c.checklists.find((x) => x.id === checklistId);
        if (ch) return ch;
      }
    }
  }
  return undefined;
}

export const addChecklistItem = createServerFn({ method: "POST" }).middleware([requireBoardAction("manage_checklists"), workspaceWriteLock])
  .validator((data: { checklistId: string; title: string }) => data)
  .handler(async ({ data }) => {
    const title = data.title.trim();
    if (!title) throw new Error("عنوان آیتم خالی است");
    const ws = await loadWorkspace();
    const ch = findChecklist(ws, data.checklistId);
    if (!ch) throw new Error("چک‌لیست پیدا نشد");
    if (!Array.isArray(ch.items)) ch.items = [];
    const id = nid();
    ch.items.push({ id, title, done: false });
    await saveWorkspace(ws);
    return { id };
  });

export const toggleChecklistItem = createServerFn({ method: "POST" }).middleware([requireBoardAction("manage_checklists"), workspaceWriteLock])
  .validator((data: { checklistId: string; itemId: string }) => data)
  .handler(async ({ data }) => {
    const ws = await loadWorkspace();
    const ch = findChecklist(ws, data.checklistId);
    if (!ch) throw new Error("چک‌لیست پیدا نشد");
    const item = ch.items.find((x) => x.id === data.itemId);
    if (!item) throw new Error("آیتم پیدا نشد");
    item.done = !item.done;
    await saveWorkspace(ws);
    return { ok: true as const, done: item.done };
  });

export const deleteChecklistItem = createServerFn({ method: "POST" }).middleware([requireBoardAction("manage_checklists"), workspaceWriteLock])
  .validator((data: { checklistId: string; itemId: string }) => data)
  .handler(async ({ data }) => {
    const ws = await loadWorkspace();
    const ch = findChecklist(ws, data.checklistId);
    if (!ch) throw new Error("چک‌لیست پیدا نشد");
    ch.items = ch.items.filter((x) => x.id !== data.itemId);
    await saveWorkspace(ws);
    return { ok: true as const };
  });


function pushActivity(card: Card, by: string, text: string) {
  if (!Array.isArray(card.activities)) card.activities = [];
  card.activities.unshift({ id: nid(), at: new Date().toISOString(), by: by || "سیستم", text });
  if (card.activities.length > 50) card.activities.length = 50;
}

export const duplicateCard = createServerFn({ method: "POST" }).middleware([requireBoardAction("create_card"), workspaceWriteLock])
  .validator(
    (data: {
      cardId: string;
      by?: string;
      targetBoardId?: string;
      targetListId?: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    const ws = await loadWorkspace();
    let src: Card | null = null;
    let sourceBoard: Board | null = null;
    for (const b of ws.boards) {
      for (const l of b.lists) {
        const found = l.cards.find((c) => c.id === data.cardId);
        if (found) {
          src = found;
          sourceBoard = b;
          break;
        }
      }
      if (src) break;
    }
    if (!src || !sourceBoard) throw new Error("کارت پیدا نشد");

    let destBoard = sourceBoard;
    if (data.targetBoardId) {
      const b = findBoard(ws, data.targetBoardId);
      if (!b) throw new Error("تخته مقصد پیدا نشد");
      destBoard = b;
    }
    let destList = destBoard.lists.find((l) => l.id === (data.targetListId || src.listId));
    if (!destList) destList = destBoard.lists[0];
    if (!destList) throw new Error("ستون مقصد پیدا نشد");

    const id = nid();
    const copy: Card = {
      ...structuredClone(src),
      id,
      boardId: destBoard.id,
      listId: destList.id,
      title: src.title + " (کپی)",
      position: mid(destList.cards[destList.cards.length - 1]?.position, undefined),
      createdAt: isoToday(),
      enteredListAt: new Date().toISOString(),
      comments: [],
      dependsOnIds: [],
      activities: [
        {
          id: nid(),
          at: new Date().toISOString(),
          by: data.by || "سیستم",
          text: "کپی از کارت «" + src.title + "»",
        },
      ],
    };
    copy.checklists = (src.checklists || []).map((ch) => ({
      ...ch,
      id: nid(),
      items: (ch.items || []).map((it) => ({ ...it, id: nid() })),
    }));
    destList.cards.push(copy);
    await saveWorkspace(ws);
    return { id, boardId: destBoard.id, listId: destList.id };
  });

export const setCardArchived = createServerFn({ method: "POST" }).middleware([requireBoardAction("edit_card"), workspaceWriteLock])
  .validator((data: { cardId: string; archived: boolean; by?: string }) => data)
  .handler(async ({ data }) => {
    const ws = await loadWorkspace();
    for (const b of ws.boards) {
      for (const l of b.lists) {
        const card = l.cards.find((c) => c.id === data.cardId);
        if (!card) continue;
        card.archived = data.archived;
        pushActivity(card, data.by || "سیستم", data.archived ? "کارت بایگانی شد" : "کارت از بایگانی خارج شد");
        await saveWorkspace(ws);
        return { ok: true as const };
      }
    }
    throw new Error("کارت پیدا نشد");
  });

export const listPeople = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(async (): Promise<Person[]> => {
  const ws = await loadWorkspace();
  return ws.people;
});

export const upsertPerson = createServerFn({ method: "POST" }).middleware([adminMiddleware, workspaceWriteLock])
  .validator((data: { id?: string; code: string; firstName: string; lastName: string; role: string; username?: string }) => data)
  .handler(async ({ data: d }) => {
    const ws = await loadWorkspace();
    const username = d.username?.trim() || undefined;
    if (d.id) {
      const p = ws.people.find((x) => x.id === d.id);
      if (p) {
        p.code = d.code;
        p.firstName = d.firstName;
        p.lastName = d.lastName;
        p.role = d.role;
        p.username = username;
      }
      await saveWorkspace(ws);
      return { id: d.id };
    }
    const id = nid();
    ws.people.push({
      id,
      code: d.code,
      firstName: d.firstName,
      lastName: d.lastName,
      role: d.role,
      username,
    });
    await saveWorkspace(ws);
    return { id };
  });

export const deletePerson = createServerFn({ method: "POST" }).middleware([adminMiddleware, workspaceWriteLock])
  .validator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const ws = await loadWorkspace();
    ws.people = ws.people.filter((p) => p.id !== data.id);
    for (const b of ws.boards) {
      for (const l of b.lists) {
        for (const c of l.cards) {
          c.memberIds = c.memberIds.filter((id) => id !== data.id);
          if (c.followerId === data.id) c.followerId = null;
        }
      }
    }
    await saveWorkspace(ws);
    return { ok: true as const };
  });

export const createLabel = createServerFn({ method: "POST" }).middleware([requireBoardAction("manage_labels"), workspaceWriteLock])
  .validator((data: { boardId: string; name: string; color: string }) => data)
  .handler(async ({ data }) => {
    const ws = await loadWorkspace();
    const b = findBoard(ws, data.boardId);
    if (!b) throw new Error("تخته پیدا نشد");
    const id = nid();
    b.labels.push({ id, name: data.name, color: data.color });
    await saveWorkspace(ws);
    return { id };
  });

export const deleteLabel = createServerFn({ method: "POST" }).middleware([requireBoardAction("manage_labels"), workspaceWriteLock])
  .validator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const ws = await loadWorkspace();
    for (const b of ws.boards) {
      b.labels = b.labels.filter((l) => l.id !== data.id);
      for (const l of b.lists) {
        for (const c of l.cards) {
          c.labelIds = c.labelIds.filter((id) => id !== data.id);
        }
      }
    }
    await saveWorkspace(ws);
    return { ok: true as const };
  });

function newEmptyBoard(ws: Workspace, title: string, description: string): Board {
  const boardId = nid();
  const labels: Label[] = [
    { id: nid(), name: "برنامه‌ریزی تولید", color: "#4C8DBE" },
    { id: nid(), name: "انبار / موجودی", color: "#4E9490" },
    { id: nid(), name: "تدارکات", color: "#D9724F" },
    { id: nid(), name: "گزارش / هماهنگی", color: "#C9A24B" },
  ];
  const lists: List[] = [
    { id: nid(), boardId, title: "در صف", position: 1000, cards: [] },
    { id: nid(), boardId, title: "در حال اجرا", position: 2000, cards: [] },
    { id: nid(), boardId, title: "تمام‌شده", position: 3000, cards: [] },
  ];
  return { id: boardId, title, description, lists, people: ws.people, labels };
}

/** First start with an empty database: one empty board, nobody assigned yet. */
function createSeedWorkspace(): Workspace {
  const boardId = nid();
  const board: Board = {
    id: boardId,
    title: "تخته اصلی",
    description: "",
    lists: [
      { id: nid(), boardId, title: "در صف", position: 1000, cards: [] },
      { id: nid(), boardId, title: "در حال اجرا", position: 2000, cards: [] },
      { id: nid(), boardId, title: "تمام‌شده", position: 3000, cards: [] },
    ],
    people: [],
    labels: [
      { id: nid(), name: "برنامه‌ریزی تولید", color: "#4C8DBE" },
      { id: nid(), name: "انبار / موجودی", color: "#4E9490" },
      { id: nid(), name: "تدارکات", color: "#D9724F" },
      { id: nid(), name: "گزارش / هماهنگی", color: "#C9A24B" },
    ],
  };
  return { people: [], boards: [board], archivedBoards: [] };
}
