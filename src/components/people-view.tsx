import { MessageSquare, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import type { Person } from "@/lib/types";
import type { LocalUser } from "@/lib/local-users";
import { personName } from "@/lib/names";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogTitle } from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

type Props = {
  people: Person[];
  canEdit: boolean;
  directory?: LocalUser[];
  onSave: (p: { id?: string; code: string; firstName: string; lastName: string; role: string; username?: string }) => void;
  onDelete: (id: string) => void;
};

export function PeopleView({ people, canEdit, directory = [], onSave, onDelete }: Props) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Person | null>(null);
  const navigate = useNavigate();

  function messagePerson(p: Person) {
    const to =
      p.username ||
      directory.find(
        (u) =>
          u.displayName.includes(p.lastName) ||
          `${p.firstName} ${p.lastName}`.includes(u.displayName),
      )?.username;
    void navigate({ to: "/messages", search: to ? { to } : {} });
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">مسئولین اجرا و پیگیری</h1>
          <p className="text-[13px] text-muted">
            {canEdit
              ? "افراد را اضافه یا حذف کنید؛ روی کارت‌ها قابل انتخاب می‌شوند."
              : "فهرست افراد واحد — برای پیام، دکمه ارسال پیام را بزنید."}
          </p>
        </div>
        {canEdit && (
          <Button
            size="sm"
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            <Plus className="size-4" />
            نفر جدید
          </Button>
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border border-border k-glass">
        {people.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted">هنوز فردی ثبت نشده.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-border text-[12px] text-subtle">
              <tr>
                <th className="px-3 py-2 text-start font-medium">نام</th>
                <th className="hidden px-3 py-2 text-start font-medium sm:table-cell">نقش</th>
                <th className="hidden px-3 py-2 text-start font-medium md:table-cell">کد</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {people.map((p) => (
                <tr key={p.id} className="border-b border-border/70 last:border-0">
                  <td className="px-3 py-2.5 font-medium">{personName(p)}</td>
                  <td className="hidden px-3 py-2.5 text-muted sm:table-cell">{p.role}</td>
                  <td className="hidden px-3 py-2.5 tabular-nums text-subtle md:table-cell">{p.code}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="ارسال پیام"
                        onClick={() => messagePerson(p)}
                      >
                        <MessageSquare />
                      </Button>
                      {canEdit && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label="ویرایش"
                            onClick={() => {
                              setEditing(p);
                              setOpen(true);
                            }}
                          >
                            <Pencil />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="text-danger"
                            aria-label="حذف"
                            onClick={() => {
                              if (confirm(`«${personName(p)}» حذف شود؟`)) onDelete(p.id);
                            }}
                          >
                            <Trash2 />
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {canEdit && (
        <PersonDialog
          key={editing?.id ?? "new"}
          open={open}
          person={editing}
          directory={directory}
          onOpenChange={setOpen}
          onSave={(data) => {
            onSave(data);
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}

function PersonDialog({
  open,
  person,
  directory,
  onOpenChange,
  onSave,
}: {
  open: boolean;
  person: Person | null;
  directory: LocalUser[];
  onOpenChange: (v: boolean) => void;
  onSave: (p: { id?: string; code: string; firstName: string; lastName: string; role: string; username?: string }) => void;
}) {
  const [firstName, setFirstName] = useState(person?.firstName ?? "");
  const [lastName, setLastName] = useState(person?.lastName ?? "");
  const [role, setRole] = useState(person?.role ?? "");
  const [code, setCode] = useState(person?.code ?? "");
  const [username, setUsername] = useState(person?.username ?? "");

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (v) {
          setFirstName(person?.firstName ?? "");
          setLastName(person?.lastName ?? "");
          setRole(person?.role ?? "");
          setCode(person?.code ?? "");
          setUsername(person?.username ?? "");
        }
      }}
    >
      <DialogContent>
        <DialogTitle>{person ? "ویرایش فرد" : "افزودن فرد"}</DialogTitle>
        <form
          className="mt-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!firstName.trim() || !lastName.trim()) return;
            onSave({
              id: person?.id,
              firstName: firstName.trim(),
              lastName: lastName.trim(),
              role: role.trim(),
              code: code.trim(),
              username: username.trim() || undefined,
            });
          }}
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>نام</Label>
              <Input className="mt-1" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
            </div>
            <div>
              <Label>نام خانوادگی</Label>
              <Input className="mt-1" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
            </div>
          </div>
          <div>
            <Label>نقش / سمت</Label>
            <Input className="mt-1" value={role} onChange={(e) => setRole(e.target.value)} />
          </div>
          <div>
            <Label>کد پرسنلی</Label>
            <Input className="mt-1" value={code} onChange={(e) => setCode(e.target.value)} />
          </div>
          <div>
            <Label>حساب ورود (برای پیام)</Label>
            <select
              className="mt-1 h-10 w-full rounded-md border border-border bg-bg-elevated px-3 text-sm"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            >
              <option value="">بدون حساب</option>
              {directory.map((u) => (
                <option key={u.username} value={u.username}>
                  {u.displayName} ({u.username})
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end pt-2">
            <Button type="submit">ذخیره</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
