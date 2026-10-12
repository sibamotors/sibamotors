import { createMiddleware } from "@tanstack/react-start";

/**
 * Server-function middlewares. EVERY server function must use one of them, so
 * the identity of the caller always comes from the signed session cookie —
 * never from anything the browser sends in the request body.
 *
 *   authMiddleware        → any logged-in user (blocked while a forced password change is pending)
 *   authAllowPwChange     → same, but allowed during the forced password change screen
 *   adminMiddleware       → admins only
 *   requireBoardAction(x) → logged in AND not locked out of action x by an admin
 *   workspaceWriteLock    → serializes workspace writes (see server/lock.server.ts)
 *
 * Inside a handler: `context.user.username` is the verified caller.
 * Heavy server-only code is imported dynamically so it never reaches the browser.
 */
export const authMiddleware = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const s = await import("./server/session.server");
  s.assertSameSite();
  const user = await s.requireSessionUser(false);
  return next({ context: { user } });
});

export const authAllowPwChangeMiddleware = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const s = await import("./server/session.server");
  s.assertSameSite();
  const user = await s.requireSessionUser(true);
  return next({ context: { user } });
});

export const adminMiddleware = createMiddleware({ type: "function" })
  .middleware([authMiddleware])
  .server(async ({ next, context }) => {
    if (!context.user.isAdmin) throw new Error("FORBIDDEN_ADMIN_ONLY");
    return next();
  });

export function requireBoardAction(action: string) {
  return createMiddleware({ type: "function" })
    .middleware([authMiddleware])
    .server(async ({ next, context }) => {
      const p = await import("./server/permissions.server");
      await p.assertActionAllowed(context.user, action);
      return next();
    });
}

export const workspaceWriteLock = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const { withWorkspaceLock } = await import("./server/lock.server");
  return withWorkspaceLock(() => next());
});
