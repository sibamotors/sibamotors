// @ts-check
/**
 * One-time account hardening, run by scripts/migrate.mjs after the migrations.
 * It is idempotent (safe to run on every deploy).
 *
 *  1. Old "A123456a" default passwords (plain or hashed) are LOCKED. Those
 *     accounts cannot log in until an admin sets a new password.
 *  2. Any other leftover plain-text password is converted to a scrypt hash.
 *  3. If ADMIN_BOOTSTRAP_USERNAME + ADMIN_BOOTSTRAP_PASSWORD are set, that admin
 *     is created — or unlocked if it exists but is locked. An admin who already
 *     has a working password is NEVER touched, so you can leave the variables set.
 *  4. One-time link of people → login usernames for old data (legacy-backfill).
 */
import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { backfillLegacyUsernames } from "./legacy-backfill.mjs";

const LOCKED = "disabled$";
const OLD_DEFAULT = "A123456a";

/** @param {string} plain @param {string} salt @returns {Promise<Buffer>} */
function derive(plain, salt) {
  return new Promise((resolve, reject) => {
    scryptCb(plain, salt, 32, (err, key) => (err ? reject(err) : resolve(key)));
  });
}

/** @param {string} plain */
async function hash(plain) {
  const salt = randomBytes(16).toString("hex");
  return `scrypt$${salt}$${(await derive(plain, salt)).toString("hex")}`;
}

/** @param {string} plain @param {string} stored */
async function matches(plain, stored) {
  if (!stored.startsWith("scrypt$")) return stored === plain;
  const parts = stored.split("$");
  if (parts.length !== 3) return false;
  const expected = Buffer.from(parts[2] ?? "", "hex");
  if (expected.length !== 32) return false;
  return timingSafeEqual(await derive(plain, parts[1] ?? ""), expected);
}

/**
 * @param {{ query: (text: string, params?: unknown[]) => Promise<{ rows: any[] }> }} db
 * @param {NodeJS.ProcessEnv} env
 */
export async function hardenAccounts(db, env = process.env) {
  const hasCols = await db.query(
    "select 1 from information_schema.columns where table_name = 'login_users' and column_name = 'is_admin'",
  );
  if (hasCols.rows.length === 0) return; // migrations not applied yet

  const users = (await db.query("select username, password from login_users")).rows;
  for (const u of users) {
    if (u.password === LOCKED) continue;
    if (await matches(OLD_DEFAULT, u.password)) {
      await db.query(
        "update login_users set password = $2, must_change_password = true, session_version = session_version + 1 where username = $1",
        [u.username, LOCKED],
      );
      console.log(`[bootstrap] LOCKED ${u.username}: still used the old default password. An admin must set a new one.`);
    } else if (!u.password.startsWith("scrypt$")) {
      await db.query("update login_users set password = $2 where username = $1", [u.username, await hash(u.password)]);
      console.log(`[bootstrap] hashed a plain-text password for ${u.username}`);
    }
  }

  const username = (env.ADMIN_BOOTSTRAP_USERNAME || "").trim().toLowerCase();
  const password = env.ADMIN_BOOTSTRAP_PASSWORD || "";
  if (username || password) {
    if (!/^[a-z0-9._-]{1,64}$/.test(username) || password.length < 10 || password.toLowerCase() === OLD_DEFAULT.toLowerCase()) {
      console.error(
        "[bootstrap] ADMIN_BOOTSTRAP_USERNAME / ADMIN_BOOTSTRAP_PASSWORD ignored: username must be a-z 0-9 . _ - and the password at least 10 characters.",
      );
    } else {
      const existing = (await db.query("select password from login_users where username = $1", [username])).rows[0];
      if (!existing || existing.password === LOCKED) {
        await db.query(
          `insert into login_users (username, password, display_name, role, must_change_password, is_admin)
           values ($1, $2, $1, 'مدیر سیستم', true, true)
           on conflict (username) do update set
             password = excluded.password, is_admin = true, must_change_password = true,
             session_version = login_users.session_version + 1`,
          [username, await hash(password)],
        );
        console.log(`[bootstrap] admin "${username}" is ready — log in and choose a new password.`);
      }
    }
  }

  const admins = (await db.query("select count(*)::int as n from login_users where is_admin and password <> $1", [LOCKED])).rows[0];
  if (!admins || admins.n === 0) {
    console.warn(
      "[bootstrap] WARNING: there is no admin who can log in. Set ADMIN_BOOTSTRAP_USERNAME and ADMIN_BOOTSTRAP_PASSWORD in Render → Environment and deploy again.",
    );
  }

  await backfillLegacyUsernames(db);
}
