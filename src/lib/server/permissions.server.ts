import { getSql } from "../db";
import type { LocalUser } from "../session-types";

/** The board actions an admin has locked for this user (admins are never locked). */
export async function deniedActionsFor(user: LocalUser): Promise<string[]> {
  if (user.isAdmin) return [];
  const sql = await getSql();
  const rows = await sql<{ denied: unknown }>`select denied from user_permissions where username = ${user.username}`;
  const raw = rows[0]?.denied;
  const arr = typeof raw === "string" ? (JSON.parse(raw) as unknown) : raw;
  return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string") : [];
}

export async function assertActionAllowed(user: LocalUser, action: string): Promise<void> {
  const denied = await deniedActionsFor(user);
  if (denied.includes(action)) throw new Error("ACTION_LOCKED");
}
