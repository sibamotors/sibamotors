import { createServerFn } from "@tanstack/react-start";
import { getSql } from "./db";
import { authMiddleware } from "./session-middleware";
import { nid } from "./utils";

export type AppNotification = {
  id: string;
  username: string;
  kind: string;
  title: string;
  body: string;
  href: string | null;
  readAt: string | null;
  createdAt: string;
};

/** Only same-site paths are allowed as links (blocks javascript: / external links). */
function safeHref(href: string | undefined | null): string | null {
  if (!href) return null;
  return href.startsWith("/") && !href.startsWith("//") ? href.slice(0, 300) : null;
}

export const pushNotification = createServerFn({ method: "POST" }).middleware([authMiddleware])
  .validator(
    (data: {
      username: string;
      kind: string;
      title: string;
      body?: string;
      href?: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    const username = data.username.trim().toLowerCase();
    if (!username) return { ok: false as const };
    const sql = await getSql();
    // only real accounts can receive notifications
    const exists = await sql<{ username: string }>`select username from login_users where username = ${username}`;
    if (exists.length === 0) return { ok: false as const };
    const id = nid();
    const now = new Date().toISOString();
    await sql`
      insert into app_notifications (id, username, kind, title, body, href, read_at, created_at)
      values (
        ${id},
        ${username},
        ${String(data.kind).slice(0, 40)},
        ${String(data.title).slice(0, 200)},
        ${String(data.body ?? "").slice(0, 500)},
        ${safeHref(data.href)},
        null,
        ${now}
      )
    `;
    return { ok: true as const, id };
  });

export const listNotifications = createServerFn({ method: "GET" }).middleware([authMiddleware])
  .validator((data: { username: string }) => data)
  .handler(async ({ context }): Promise<AppNotification[]> => {
    const u = context.user.username;
    const sql = await getSql();
    const rows = await sql<{
      id: string;
      username: string;
      kind: string;
      title: string;
      body: string;
      href: string | null;
      read_at: string | null;
      created_at: string;
    }>`
      select id, username, kind, title, body, href, read_at, created_at
      from app_notifications
      where username = ${u}
      order by created_at desc
      limit 50
    `;
    return rows.map((r) => ({
      id: r.id,
      username: r.username,
      kind: r.kind,
      title: r.title,
      body: r.body,
      href: r.href,
      readAt: r.read_at,
      createdAt: r.created_at,
    }));
  });

export const unreadNotificationCount = createServerFn({ method: "GET" }).middleware([authMiddleware])
  .validator((data: { username: string }) => data)
  .handler(async ({ context }): Promise<number> => {
    const u = context.user.username;
    const sql = await getSql();
    const rows = await sql<{ n: number }>`
      select count(*)::int as n from app_notifications
      where username = ${u} and read_at is null
    `;
    return rows[0]?.n ?? 0;
  });

export const markNotificationsRead = createServerFn({ method: "POST" }).middleware([authMiddleware])
  .validator((data: { username: string; ids?: string[] }) => data)
  .handler(async ({ data, context }) => {
    const u = context.user.username;
    const sql = await getSql();
    const now = new Date().toISOString();
    if (data.ids?.length) {
      await sql`
        update app_notifications set read_at = ${now}
        where id = any(${data.ids.slice(0, 200)}::text[]) and username = ${u} and read_at is null
      `;
    } else {
      await sql`
        update app_notifications set read_at = ${now}
        where username = ${u} and read_at is null
      `;
    }
    return { ok: true as const };
  });
