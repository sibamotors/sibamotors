/**
 * Serializes every write to the shared workspace JSON inside this Node process,
 * so two people saving at the same moment can never overwrite each other's
 * change (read → modify → save is done one request at a time).
 * Render runs ONE instance of this app, so a process-level lock is enough.
 */
const g = globalThis as typeof globalThis & { __workspaceLock__?: Promise<unknown> };

export function withWorkspaceLock<T>(fn: () => Promise<T>): Promise<T> {
  const previous = g.__workspaceLock__ ?? Promise.resolve();
  const run = previous.catch(() => undefined).then(fn);
  g.__workspaceLock__ = run.catch(() => undefined);
  return run;
}
