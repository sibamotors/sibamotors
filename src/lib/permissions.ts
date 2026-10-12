import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "./db";
import { adminMiddleware, authMiddleware } from "./session-middleware";
import { parse } from "./validate";

export const BOARD_ACTIONS = [
  { id: "create_card", label: "ایجاد کارت", group: "کارت" },
  { id: "edit_card", label: "ویرایش کارت", group: "کارت" },
  { id: "delete_card", label: "حذف کارت", group: "کارت" },
  { id: "move_card", label: "جابه‌جایی کارت", group: "کارت" },
  { id: "create_list", label: "ایجاد ستون", group: "ستون" },
  { id: "rename_list", label: "تغییر نام ستون", group: "ستون" },
  { id: "delete_list", label: "حذف ستون", group: "ستون" },
  { id: "move_list", label: "جابه‌جایی ستون", group: "ستون" },
  { id: "manage_labels", label: "مدیریت برچسب‌ها", group: "تخته" },
  { id: "manage_checklists", label: "چک‌لیست", group: "کارت" },
  { id: "comment", label: "ثبت نظر", group: "کارت" },
  { id: "assign_people", label: "تخصیص افراد", group: "کارت" },
  { id: "change_dates", label: "تغییر تاریخ", group: "کارت" },
  { id: "change_priority", label: "تغییر اولویت", group: "کارت" },
  { id: "change_progress", label: "تغییر پیشرفت", group: "کارت" },
  { id: "rename_board", label: "تغییر نام تخته", group: "تخته" },
  { id: "archive_board", label: "بایگانی تخته", group: "تخته" },
  { id: "create_board", label: "ایجاد تخته", group: "تخته" },
  { id: "sort_board", label: "مرتب‌سازی تخته", group: "تخته" },
] as const;

export type BoardAction = (typeof BOARD_ACTIONS)[number]["id"];

export const BOARD_ACTION_IDS: BoardAction[] = BOARD_ACTIONS.map((a) => a.id);

function parseDenied(raw: unknown): BoardAction[] {
  if (!Array.isArray(raw)) return [];
  const allowed = new Set<string>(BOARD_ACTION_IDS);
  return raw.filter((x): x is BoardAction => typeof x === "string" && allowed.has(x));
}

export type UserPermissionRow = {
  username: string;
  displayName: string;
  role: string;
  isAdmin: boolean;
  denied: BoardAction[];
};

/** Which actions are locked for ME (the server reads my identity from the session). */
export const getMyPermissions = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator(parse(z.object({ username: z.string().optional() }))) // username is ignored
  .handler(async ({ context }): Promise<{ denied: BoardAction[] }> => {
    const { deniedActionsFor } = await import("./server/permissions.server");
    return { denied: parseDenied(await deniedActionsFor(context.user)) };
  });

/** Admin only: everyone's locks. */
export const listUserPermissions = createServerFn({ method: "GET" })
  .middleware([adminMiddleware])
  .handler(async (): Promise<UserPermissionRow[]> => {
    const sql = await getSql();
    const users = await sql<{ username: string; display_name: string; role: string; is_admin: boolean }>`
      select username, display_name, role, is_admin from login_users order by username
    `;
    const perms = await sql<{ username: string; denied: unknown }>`
      select username, denied from user_permissions
    `;
    const map = new Map(perms.map((p) => [p.username, parseDenied(p.denied)]));
    return users.map((u) => ({
      username: u.username,
      displayName: u.display_name,
      role: u.role,
      isAdmin: Boolean(u.is_admin),
      denied: u.is_admin ? [] : (map.get(u.username) ?? []),
    }));
  });

/** Admin only: lock/unlock actions for a (non-admin) user. */
export const saveUserPermissions = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator(parse(z.object({ username: z.string().max(64), denied: z.array(z.string().max(64)).max(100) })))
  .handler(async ({ data }): Promise<{ ok: true } | { ok: false; error: string }> => {
    const username = data.username.trim().toLowerCase();
    if (!username) return { ok: false, error: "کاربر نامعتبر است." };
    const sql = await getSql();
    const target = await sql<{ is_admin: boolean }>`select is_admin from login_users where username = ${username}`;
    if (target.length === 0) return { ok: false, error: "کاربر پیدا نشد." };
    if (target[0]!.is_admin) return { ok: false, error: "دسترسی مدیر سیستم قابل قفل شدن نیست." };
    const denied = parseDenied(data.denied);
    await sql`
      insert into user_permissions (username, denied, updated_at)
      values (${username}, ${JSON.stringify(denied)}::jsonb, ${new Date().toISOString()}::timestamptz)
      on conflict (username) do update set
        denied = excluded.denied,
        updated_at = excluded.updated_at
    `;
    return { ok: true };
  });
