import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { MessageSquare, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { formatRelativeFa } from "@/lib/jalali";
import { useLocalSession } from "@/lib/local-session";
import { playReceiveSound } from "@/lib/message-sounds";
import { listUnread, markMessageRead, type ChatMessage } from "@/lib/messages";
import { initials } from "@/lib/utils";
import { Button } from "./ui/button";

const SEEN_KEY = "sibamotor-seen-msgs";

function readSeen(): Set<string> {
  try {
    const raw = sessionStorage.getItem(SEEN_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as string[];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function writeSeen(ids: Set<string>) {
  try {
    sessionStorage.setItem(SEEN_KEY, JSON.stringify([...ids]));
  } catch {
    /* ignore */
  }
}

export function MessagePopup() {
  const { user } = useLocalSession();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [seen, setSeen] = useState<Set<string>>(new Set());
  const [current, setCurrent] = useState<ChatMessage | null>(null);

  useEffect(() => {
    setSeen(readSeen());
  }, []);

  const q = useQuery({
    queryKey: ["messages-unread-list", user?.username],
    queryFn: () => listUnread({ data: { username: user!.username } }),
    enabled: Boolean(user),
    refetchInterval: 15000,
  });

  const fresh = useMemo(
    () => (q.data ?? []).filter((m) => !seen.has(m.id)),
    [q.data, seen],
  );

  useEffect(() => {
    if (pathname.startsWith("/messages")) return;
    if (!current && fresh[0]) {
      setCurrent(fresh[0]!);
      playReceiveSound();
    }
  }, [fresh, current, pathname]);

  const markMut = useMutation({
    mutationFn: (id: string) => markMessageRead({ data: { username: user!.username, id } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["messages"] });
      void qc.invalidateQueries({ queryKey: ["messages-unread"] });
      void qc.invalidateQueries({ queryKey: ["messages-unread-list"] });
    },
  });

  function dismiss(id: string, markRead = false) {
    const next = new Set(seen);
    next.add(id);
    setSeen(next);
    writeSeen(next);
    if (markRead) markMut.mutate(id);
    const rest = fresh.filter((m) => m.id !== id);
    setCurrent(rest[0] ?? null);
  }

  if (!user || pathname.startsWith("/messages") || pathname.startsWith("/login") || !current) {
    return null;
  }

  const more = Math.max(fresh.length - 1, 0);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-40 flex justify-center px-3 lg:bottom-6 lg:end-6 lg:justify-end">
      <aside className="pointer-events-auto k-enter w-full max-w-sm rounded-2xl border border-border k-elevated p-4 shadow-[var(--shadow-flyout)]">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent text-[13px] font-semibold text-accent-fg">
            {initials(current.fromDisplayName)}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <MessageSquare className="size-4 text-accent" />
              <p className="text-[13px] font-semibold">پیام جدید</p>
              {more > 0 && (
                <span className="rounded-full bg-accent-soft px-1.5 text-[11px] text-fg">+{more}</span>
              )}
              <button
                type="button"
                className="ms-auto text-subtle hover:text-fg"
                aria-label="بستن"
                onClick={() => dismiss(current.id)}
              >
                <X className="size-4" />
              </button>
            </div>
            <p className="mt-1 text-sm font-medium">{current.fromDisplayName}</p>
            {current.replyBody && (
              <p className="mt-1 line-clamp-1 rounded-md bg-surface-2 px-2 py-1 text-[12px] text-muted">
                در پاسخ: {current.replyBody}
              </p>
            )}
            <p className="mt-1 line-clamp-4 text-[13px] leading-relaxed text-fg">{current.body}</p>
            <p className="mt-1 text-[11px] text-subtle">{formatRelativeFa(current.createdAt)}</p>
            <div className="mt-3 flex justify-end gap-1">
              <Button variant="ghost" size="sm" onClick={() => dismiss(current.id, true)}>
                خواندم
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  dismiss(current.id, true);
                  void navigate({ to: "/messages", search: { to: current.fromUsername } });
                }}
              >
                پاسخ
              </Button>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
