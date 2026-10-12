import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Lock, Unlock } from "lucide-react";
import { toast } from "sonner";
import {
  BOARD_ACTIONS,
  listUserPermissions,
  saveUserPermissions,
  type BoardAction,
} from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";

const GROUPS = ["کارت", "ستون", "تخته"] as const;

export function PermissionsPanel() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["user-permissions"], queryFn: () => listUserPermissions() });

  const saveMut = useMutation({
    mutationFn: (data: { username: string; denied: BoardAction[] }) =>
      saveUserPermissions({ data: { username: data.username, denied: data.denied } }),
    onSuccess: (res, vars) => {
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      void qc.invalidateQueries({ queryKey: ["user-permissions"] });
      void qc.invalidateQueries({ queryKey: ["my-permissions", vars.username] });
      toast.success("دسترسی ذخیره شد.");
    },
  });

  function toggle(username: string, denied: BoardAction[], action: BoardAction) {
    const next = denied.includes(action) ? denied.filter((a) => a !== action) : [...denied, action];
    saveMut.mutate({ username, denied: next });
  }

  function setAll(username: string, lock: boolean) {
    saveMut.mutate({ username, denied: lock ? [...BOARD_ACTIONS.map((a) => a.id)] : [] });
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">دسترسی قابلیت‌های تخته</h2>
        <p className="mt-1 text-[13px] text-muted">
          تیک خورده = قفل است و آن کاربر نمی‌تواند آن کار را انجام دهد. مدیر سیستم همیشه همه دسترسی‌ها را دارد.
        </p>
      </div>

      {q.isLoading ? (
        <div className="h-2 w-40 overflow-hidden rounded-full bg-surface">
          <div className="k-skeleton h-full w-full" />
        </div>
      ) : (
        <div className="space-y-3">
          {(q.data ?? []).map((row) => {
            const isSys = row.isAdmin;
            return (
              <section key={row.username} className="rounded-2xl border border-border k-glass p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">
                      {row.displayName}
                      {isSys && (
                        <span className="ms-2 rounded-sm bg-accent-soft px-1.5 py-0.5 text-[10px] font-medium text-accent">
                          مدیر سیستم
                        </span>
                      )}
                    </p>
                    <p className="text-[12px] text-muted">
                      {row.role} · <span dir="ltr">{row.username}</span>
                    </p>
                  </div>
                  {!isSys && (
                    <div className="flex gap-1">
                      <Button variant="secondary" size="sm" onClick={() => setAll(row.username, true)}>
                        <Lock className="size-3.5" />
                        قفل همه
                      </Button>
                      <Button variant="secondary" size="sm" onClick={() => setAll(row.username, false)}>
                        <Unlock className="size-3.5" />
                        باز کردن همه
                      </Button>
                    </div>
                  )}
                </div>
                {isSys ? (
                  <p className="text-[13px] text-subtle">دسترسی مدیر سیستم قابل محدود کردن نیست.</p>
                ) : (
                  GROUPS.map((g) => (
                    <div key={g} className="mt-3">
                      <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-subtle">{g}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {BOARD_ACTIONS.filter((a) => a.group === g).map((a) => {
                          const locked = row.denied.includes(a.id);
                          return (
                            <button
                              key={a.id}
                              type="button"
                              onClick={() => toggle(row.username, row.denied, a.id)}
                              className={cn(
                                "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[12px] font-medium",
                                locked
                                  ? "border-danger/40 bg-danger/10 text-danger"
                                  : "border-border bg-surface-2 text-muted hover:text-fg",
                              )}
                            >
                              {locked ? <Lock className="size-3" /> : <Unlock className="size-3" />}
                              {a.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
