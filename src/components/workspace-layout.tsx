import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSession } from "@/lib/local-session";
import { createBoard, listBoards } from "@/lib/local-db";
import { PermissionsProvider } from "@/lib/permissions-context";
import { usePermissions } from "@/lib/permissions-context";
import { useNavigate } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { AppShell, BootScreen } from "./app-shell";
import { LoginScreen } from "./login-screen";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogTitle } from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";

type Props = {
  boardId?: string;
  search?: string;
  onSearch?: (q: string) => void;
  children: ReactNode;
};

export function WorkspaceLayout({ boardId, search, onSearch, children }: Props) {
  const { user, ready } = useLocalSession();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");

  const boardsQ = useQuery({
    queryKey: ["boards"],
    queryFn: () => listBoards(),
    enabled: Boolean(user),
  });

  const createMut = useMutation({
    mutationFn: () => createBoard({ data: { title: title.trim(), description: desc.trim() } }),
    onSuccess: async (res) => {
      await qc.invalidateQueries({ queryKey: ["boards"] });
      setCreateOpen(false);
      setTitle("");
      setDesc("");
      void navigate({ to: "/b/$boardId", params: { boardId: res.id } });
    },
  });

  if (!ready) return <BootScreen />;
  if (!user) return <LoginScreen />;
  if (boardsQ.isLoading) return <BootScreen />;

  const activeBoardId = boardId ?? boardsQ.data?.[0]?.id;

  return (
    <PermissionsProvider>
      <Shell
        boards={boardsQ.data ?? []}
        activeBoardId={activeBoardId}
        search={search}
        onSearch={onSearch}
        onCreateBoard={() => setCreateOpen(true)}
        createOpen={createOpen}
        setCreateOpen={setCreateOpen}
        title={title}
        setTitle={setTitle}
        desc={desc}
        setDesc={setDesc}
        onSubmit={() => createMut.mutate()}
        pending={createMut.isPending}
      >
        {children}
      </Shell>
    </PermissionsProvider>
  );
}

function Shell({
  boards,
  activeBoardId,
  search,
  onSearch,
  onCreateBoard,
  createOpen,
  setCreateOpen,
  title,
  setTitle,
  desc,
  setDesc,
  onSubmit,
  pending,
  children,
}: {
  boards: { id: string; title: string; description: string; createdAt: string; cardCount: number }[];
  activeBoardId?: string;
  search?: string;
  onSearch?: (q: string) => void;
  onCreateBoard: () => void;
  createOpen: boolean;
  setCreateOpen: (v: boolean) => void;
  title: string;
  setTitle: (v: string) => void;
  desc: string;
  setDesc: (v: string) => void;
  onSubmit: () => void;
  pending: boolean;
  children: ReactNode;
}) {
  const { can } = usePermissions();
  return (
    <AppShell
      boards={boards}
      boardId={activeBoardId}
      search={search}
      onSearch={onSearch}
      onCreateBoard={can("create_board") ? onCreateBoard : undefined}
    >
      {children}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogTitle>تخته جدید</DialogTitle>
          <form
            className="mt-4 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!title.trim()) return;
              onSubmit();
            }}
          >
            <div>
              <Label>نام تخته</Label>
              <Input className="mt-1" value={title} onChange={(e) => setTitle(e.target.value)} required />
            </div>
            <div>
              <Label>توضیح</Label>
              <Textarea className="mt-1" value={desc} onChange={(e) => setDesc(e.target.value)} rows={3} />
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={pending}>
                ساخت تخته
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
