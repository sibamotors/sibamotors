import { KeyRound, Pencil, Plus, Shield, Trash2, Users } from "lucide-react";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { deleteLocalUser, listLocalUsers, upsertLocalUser, type LocalUser } from "@/lib/local-users";
import { useLocalSession } from "@/lib/local-session";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogTitle } from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { PermissionsPanel } from "./permissions-panel";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function AdminUsersView() {
  const [tab, setTab] = useState<"users" | "perms">("users");
  return (
    <div className="mx-auto max-w-3xl px-4 py-4">
      <div className="mb-4 flex gap-1 rounded-xl border border-border bg-surface-2 p-1">
        <button
          type="button"
          onClick={() => setTab("users")}
          className={cn(
            "flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg text-[13px] font-medium",
            tab === "users" ? "bg-bg-elevated text-fg shadow-sm" : "text-muted",
          )}
        >
          <Users className="size-4" />
          حساب‌های ورود
        </button>
        <button
          type="button"
          onClick={() => setTab("perms")}
          className={cn(
            "flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg text-[13px] font-medium",
            tab === "perms" ? "bg-bg-elevated text-fg shadow-sm" : "text-muted",
          )}
        >
          <Shield className="size-4" />
          دسترسی تخته
        </button>
      </div>
      {tab === "users" ? <UsersTab /> : <PermissionsPanel />}
    </div>
  );
}

function UsersTab() {
  const qc = useQueryClient();
  const { user: currentUser } = useLocalSession();
  const q = useQuery({ queryKey: ["local-users"], queryFn: () => listLocalUsers() });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<LocalUser | null>(null);

  const saveMut = useMutation({
    mutationFn: (data: { username: string; password: string; displayName: string; role: string }) =>
      upsertLocalUser({ data }),
    onSuccess: (res) => {
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      void qc.invalidateQueries({ queryKey: ["local-users"] });
      void qc.invalidateQueries({ queryKey: ["user-permissions"] });
      setOpen(false);
      toast.success("کاربر ذخیره شد.");
    },
  });

  const delMut = useMutation({
    mutationFn: (username: string) => deleteLocalUser({ data: { username } }),
    onSuccess: (res) => {
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      void qc.invalidateQueries({ queryKey: ["local-users"] });
      void qc.invalidateQueries({ queryKey: ["user-permissions"] });
    },
  });

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">مدیریت کاربران ورود</h1>
          <p className="text-[13px] text-muted">
            ساخت یوزر جدید، تغییر رمز عبور و حذف کاربران — فقط برای مدیران سیستم.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          <Plus className="size-4" />
          کاربر جدید
        </Button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border k-glass">
        {q.isLoading ? (
          <div className="p-4">
            <div className="h-2 w-40 overflow-hidden rounded-full bg-surface">
              <div className="k-skeleton h-full w-full" />
            </div>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-border text-[12px] text-subtle">
              <tr>
                <th className="px-3 py-2 text-start font-medium">نام</th>
                <th className="hidden px-3 py-2 text-start font-medium sm:table-cell">نقش</th>
                <th className="px-3 py-2 text-start font-medium" dir="ltr">
                  یوزرنیم
                </th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {(q.data ?? []).map((u) => (
                <tr key={u.username} className="border-b border-border/70 last:border-0">
                  <td className="px-3 py-2.5 font-medium">
                    {u.displayName}
                    {u.isAdmin && (
                      <span className="ms-2 rounded-sm bg-accent-soft px-1.5 py-0.5 text-[10px] font-medium text-accent">
                        مدیر سیستم
                      </span>
                    )}
                  </td>
                  <td className="hidden px-3 py-2.5 text-muted sm:table-cell">{u.role}</td>
                  <td className="px-3 py-2.5 tabular-nums text-subtle" dir="ltr">
                    {u.username}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="ویرایش / تغییر رمز"
                        onClick={() => {
                          setEditing(u);
                          setOpen(true);
                        }}
                      >
                        <Pencil />
                      </Button>
                      {!u.isAdmin && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="text-danger"
                          aria-label="حذف"
                          onClick={() => {
                            if (u.username === currentUser?.username) {
                              toast.error("نمی‌توانید حساب خودتان را حذف کنید.");
                              return;
                            }
                            if (confirm(`کاربر «${u.displayName}» (${u.username}) حذف شود؟`)) {
                              delMut.mutate(u.username);
                            }
                          }}
                        >
                          <Trash2 />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <UserDialog
        key={editing?.username ?? "new"}
        open={open}
        user={editing}
        onOpenChange={setOpen}
        onSave={(data) => saveMut.mutate(data)}
        busy={saveMut.isPending}
      />
    </>
  );
}

function UserDialog({
  open,
  user,
  onOpenChange,
  onSave,
  busy,
}: {
  open: boolean;
  user: LocalUser | null;
  onOpenChange: (v: boolean) => void;
  onSave: (data: { username: string; password: string; displayName: string; role: string }) => void;
  busy: boolean;
}) {
  const [username, setUsername] = useState(user?.username ?? "");
  const [displayName, setDisplayName] = useState(user?.displayName ?? "");
  const [role, setRole] = useState(user?.role ?? "");
  const [password, setPassword] = useState("");

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (v) {
          setUsername(user?.username ?? "");
          setDisplayName(user?.displayName ?? "");
          setRole(user?.role ?? "");
          setPassword("");
        }
      }}
    >
      <DialogContent>
        <DialogTitle>{user ? "ویرایش کاربر / تغییر رمز" : "افزودن کاربر جدید"}</DialogTitle>
        <form
          className="mt-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!username.trim() || !password.trim()) return;
            onSave({
              username: username.trim(),
              password: password.trim(),
              displayName: displayName.trim(),
              role: role.trim(),
            });
          }}
        >
          <div>
            <Label>یوزرنیم (برای ورود)</Label>
            <Input
              className="mt-1"
              dir="ltr"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={Boolean(user)}
              placeholder="مثال: r.karimi"
              required
            />
          </div>
          <div>
            <Label className="flex items-center gap-1.5">
              <KeyRound className="size-3.5" />
              {user ? "رمز عبور جدید" : "رمز عبور"}
            </Label>
            <Input
              className="mt-1"
              dir="ltr"
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={user ? "برای تغییر رمز وارد کنید" : "حداقل ۴ کاراکتر"}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>نام نمایشی</Label>
              <Input className="mt-1" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            </div>
            <div>
              <Label>نقش / سمت</Label>
              <Input className="mt-1" value={role} onChange={(e) => setRole(e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <Button type="submit" disabled={busy}>
              ذخیره
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
