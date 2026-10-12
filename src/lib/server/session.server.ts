import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { getCookie, getRequest, setCookie } from "@tanstack/react-start/server";
import { getSql } from "../db";
import type { LocalUser } from "../session-types";

/**
 * Server-side sessions.
 *
 * The browser only holds ONE cookie (`sm_session`): HttpOnly (JavaScript can't
 * read it), Secure in production, SameSite=Lax. Its value is a signed token
 * (HMAC-SHA256 with SESSION_SECRET). On every request we re-load the user from
 * the database and compare `session_version`, so changing a password, resetting
 * it, or deleting the user instantly kills all old sessions.
 *
 * MUST stay `.server.ts` and be imported dynamically from server code only.
 */

export const SESSION_COOKIE = "sm_session";
const SESSION_TTL_S = 60 * 60 * 24 * 7; // 7 days
const PIN_TICKET_TTL_S = 5 * 60; // 5 minutes between password and PIN step

export function isProduction(): boolean {
  return process.env.NODE_ENV === "production" || process.env.RENDER === "true";
}

let cachedSecret: string | null = null;
function secret(): string {
  if (cachedSecret) return cachedSecret;
  const fromEnv = process.env.SESSION_SECRET?.trim();
  if (fromEnv && fromEnv.length >= 32) return (cachedSecret = fromEnv);
  if (isProduction()) {
    throw new Error("SESSION_SECRET is missing or shorter than 32 characters (set it in Render → Environment).");
  }
  console.warn("[session] SESSION_SECRET not set — using a temporary random secret (development only).");
  return (cachedSecret = randomBytes(32).toString("hex"));
}

type TokenKind = "session" | "pin";
type TokenPayload = { k: TokenKind; u: string; sv: number; exp: number };

const b64url = (input: Buffer | string) => Buffer.from(input).toString("base64url");
const mac = (data: string) => createHmac("sha256", secret()).update(data).digest();

function signToken(p: TokenPayload): string {
  const body = b64url(JSON.stringify(p));
  return `${body}.${b64url(mac(body))}`;
}

function verifyToken(token: string, kind: TokenKind): TokenPayload | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, sig] = parts as [string, string];
  const expected = mac(body);
  const given = Buffer.from(sig, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as TokenPayload;
    if (p.k !== kind) return null;
    if (typeof p.u !== "string" || typeof p.sv !== "number" || typeof p.exp !== "number") return null;
    if (p.exp * 1000 < Date.now()) return null;
    return p;
  } catch {
    return null;
  }
}

const nowS = () => Math.floor(Date.now() / 1000);

export function signPinTicket(username: string, sessionVersion: number): string {
  return signToken({ k: "pin", u: username, sv: sessionVersion, exp: nowS() + PIN_TICKET_TTL_S });
}

export function readPinTicket(ticket: string): { username: string; sessionVersion: number } | null {
  const p = verifyToken(ticket, "pin");
  return p ? { username: p.u, sessionVersion: p.sv } : null;
}

const cookieBase = () => ({
  httpOnly: true,
  secure: isProduction(),
  sameSite: "lax" as const,
  path: "/",
});

export function setSessionCookie(username: string, sessionVersion: number): void {
  const token = signToken({ k: "session", u: username, sv: sessionVersion, exp: nowS() + SESSION_TTL_S });
  setCookie(SESSION_COOKIE, token, { ...cookieBase(), maxAge: SESSION_TTL_S });
}

export function clearSessionCookie(): void {
  setCookie(SESSION_COOKIE, "", { ...cookieBase(), maxAge: 0 });
}

export type UserRow = {
  username: string;
  password: string;
  display_name: string;
  role: string;
  is_admin: boolean;
  must_change_password: boolean;
  pin_enabled: boolean;
  pin_hash: string | null;
  session_version: number;
};

const USER_COLUMNS =
  "username, password, display_name, role, is_admin, must_change_password, pin_enabled, pin_hash, session_version";

export async function findUser(username: string): Promise<UserRow | undefined> {
  const sql = await getSql();
  const rows = await sql.query<UserRow>(`select ${USER_COLUMNS} from login_users where username = $1`, [
    username,
  ]);
  return rows[0];
}

export function toLocalUser(r: UserRow): LocalUser {
  return {
    username: r.username,
    displayName: r.display_name,
    role: r.role,
    isAdmin: Boolean(r.is_admin),
    pinEnabled: Boolean(r.pin_enabled && r.pin_hash),
    mustChangePassword: Boolean(r.must_change_password),
  };
}

/** The logged-in user for this request, or null. Always re-checked against the DB. */
export async function readSessionUser(): Promise<LocalUser | null> {
  const raw = getCookie(SESSION_COOKIE);
  if (!raw) return null;
  const p = verifyToken(raw, "session");
  if (!p) return null;
  const row = await findUser(p.u);
  if (!row || row.session_version !== p.sv) return null;
  return toLocalUser(row);
}

/** Used by the auth middleware. Throws a short code the UI understands. */
export async function requireSessionUser(allowPasswordChangePending: boolean): Promise<LocalUser> {
  const user = await readSessionUser();
  if (!user) throw new Error("AUTH_REQUIRED");
  if (user.mustChangePassword && !allowPasswordChangePending) throw new Error("PASSWORD_CHANGE_REQUIRED");
  return user;
}

/**
 * Cross-site request guard (Fetch-Metadata). Browsers always send
 * `Sec-Fetch-Site`; scripted requests coming from another site are rejected.
 */
export function assertSameSite(): void {
  const request = getRequest();
  if (!request) return;
  const h = request.headers;
  const site = h.get("sec-fetch-site");
  if (!site || site === "same-origin" || site === "none") return;
  const isTopLevelGet = h.get("sec-fetch-mode") === "navigate" && request.method === "GET";
  if (isTopLevelGet) return;
  throw new Error("FORBIDDEN_CROSS_SITE");
}

export function clientIp(): string {
  const req = getRequest();
  const xff = req?.headers.get("x-forwarded-for");
  const first = xff?.split(",")[0]?.trim();
  return first || req?.headers.get("x-real-ip") || "unknown";
}

/* ───────────── brute-force protection (table: login_attempts) ───────────── */

const WINDOW_MS = 15 * 60 * 1000;
const LOCK_MS = 15 * 60 * 1000;

export const LOCKED_MESSAGE = "تعداد تلاش‌های ناموفق زیاد بود. ۱۵ دقیقه بعد دوباره تلاش کنید.";

export async function anyLocked(keys: string[]): Promise<boolean> {
  const sql = await getSql();
  const rows = await sql.query<{ key: string }>(
    "select key from login_attempts where key = any($1::text[]) and locked_until is not null and locked_until > now()",
    [keys],
  );
  return rows.length > 0;
}

export async function registerFailure(key: string, maxFailures: number): Promise<void> {
  const sql = await getSql();
  const rows = await sql<{ failures: number; first_failure_at: string }>`
    select failures, first_failure_at from login_attempts where key = ${key}
  `;
  const row = rows[0];
  const fresh = !row || Date.now() - new Date(row.first_failure_at).getTime() > WINDOW_MS;
  const failures = !row || fresh ? 1 : row.failures + 1;
  const firstAt = !row || fresh ? new Date().toISOString() : row.first_failure_at;
  const lockedUntil = failures >= maxFailures ? new Date(Date.now() + LOCK_MS).toISOString() : null;
  await sql`
    insert into login_attempts (key, failures, first_failure_at, locked_until)
    values (${key}, ${failures}, ${firstAt}::timestamptz, ${lockedUntil}::timestamptz)
    on conflict (key) do update set
      failures = excluded.failures,
      first_failure_at = excluded.first_failure_at,
      locked_until = excluded.locked_until
  `;
  // housekeeping: forget old rows
  await sql`delete from login_attempts where first_failure_at < now() - interval '1 day'`;
}

export async function clearFailures(key: string): Promise<void> {
  const sql = await getSql();
  await sql`delete from login_attempts where key = ${key}`;
}
