// @ts-check
/**
 * ONE-TIME helper. The old app code linked three people to login usernames by
 * their personnel code. That mapping was removed from the app; this copies it
 * once into the saved data (only where `username` is still empty), so existing
 * boards keep working. After your first successful deploy you may delete this
 * file and its import in scripts/bootstrap.mjs.
 */
const CODE_TO_USER = { "6122": "h.mojarad", "13177": "a.abbasi", "6276": "s.aghdasi" };

/** @param {{ query: (text: string, params?: unknown[]) => Promise<{ rows: any[] }> }} db */
export async function backfillLegacyUsernames(db) {
  const found = (await db.query("select id, data from workspace_state")).rows;
  for (const row of found) {
    const ws = typeof row.data === "string" ? JSON.parse(row.data) : row.data;
    if (!ws || !Array.isArray(ws.people)) continue;
    let changed = false;
    for (const p of ws.people) {
      const user = CODE_TO_USER[String(p.code)];
      if (user && !p.username) {
        p.username = user;
        changed = true;
      }
    }
    if (changed) {
      await db.query("update workspace_state set data = $2::jsonb, updated_at = now() where id = $1", [row.id, JSON.stringify(ws)]);
      console.log("[bootstrap] linked legacy people to usernames");
    }
  }
}
