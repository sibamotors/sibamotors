// @ts-check
/**
 * One place that decides HOW we connect to Postgres, shared by the app
 * (src/lib/db.ts) and the migrator (scripts/migrate.mjs).
 */

/** True when running on Render / in production. */
export function isProductionEnv() {
  return process.env.NODE_ENV === "production" || process.env.RENDER === "true";
}

/**
 * SSL rules:
 *  - DATABASE_SSL=disable            → never use SSL
 *  - DATABASE_SSL=require            → always use SSL
 *  - URL already contains sslmode=…  → let the pg driver handle it
 *  - host without a dot (Render's INTERNAL url, e.g. dpg-abc123-a) or localhost → no SSL
 *  - any other host (Render EXTERNAL url, Neon, …)                → SSL
 * @param {string} databaseUrl
 * @returns {false | { rejectUnauthorized: boolean } | undefined}
 */
export function sslFor(databaseUrl) {
  const mode = (process.env.DATABASE_SSL || "").trim().toLowerCase();
  if (mode === "disable") return false;
  if (mode === "require") return { rejectUnauthorized: false };
  if (/[?&]sslmode=/i.test(databaseUrl)) return undefined;
  let host = "";
  try {
    host = new URL(databaseUrl).hostname;
  } catch {
    return undefined;
  }
  if (!host || host === "localhost" || host === "127.0.0.1" || !host.includes(".")) return false;
  return { rejectUnauthorized: false };
}

/**
 * @param {string} databaseUrl
 * @param {{ max?: number }} [opts]
 */
export function poolConfig(databaseUrl, opts = {}) {
  const ssl = sslFor(databaseUrl);
  return {
    connectionString: databaseUrl,
    ...(ssl === undefined ? {} : { ssl }),
    max: opts.max ?? 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  };
}
