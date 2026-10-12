import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  getSessionUser,
  loginWithPassword,
  loginWithPin,
  logoutSession,
  type LocalUser,
  type LoginOutcome,
} from "./local-users";

/**
 * The browser no longer "owns" the login. The real session is an HttpOnly
 * cookie that only the server can read or create; this provider just asks the
 * server "who am I?" and keeps the answer in memory for the UI.
 */
type SessionCtx = {
  user: LocalUser | null;
  ready: boolean;
  isAdmin: boolean;
  login: (username: string, password: string) => Promise<LoginOutcome>;
  completePinLogin: (ticket: string, pin: string) => Promise<LoginOutcome>;
  updateUser: (patch: Partial<LocalUser>) => void;
  logout: () => Promise<void>;
};

const Ctx = createContext<SessionCtx | null>(null);

const NETWORK_ERROR = "خطا در ارتباط با سرور. دوباره تلاش کنید.";

export function LocalSessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<LocalUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    // Old versions stored the whole session in localStorage — remove that leftover.
    try {
      localStorage.removeItem("sibamotor-session");
    } catch {
      /* ignore */
    }
    getSessionUser()
      .then((u) => {
        if (alive) setUser(u);
      })
      .catch(() => undefined)
      .finally(() => {
        if (alive) setReady(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  const login = useCallback(async (username: string, password: string): Promise<LoginOutcome> => {
    try {
      const res = await loginWithPassword({ data: { username, password } });
      if (res.ok) setUser(res.user);
      return res;
    } catch {
      return { ok: false, error: NETWORK_ERROR };
    }
  }, []);

  const completePinLogin = useCallback(async (ticket: string, pin: string): Promise<LoginOutcome> => {
    try {
      const res = await loginWithPin({ data: { ticket, pin } });
      if (res.ok) setUser(res.user);
      return res;
    } catch {
      return { ok: false, error: NETWORK_ERROR };
    }
  }, []);

  const updateUser = useCallback((patch: Partial<LocalUser>) => {
    setUser((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutSession();
    } catch {
      /* the cookie expires by itself anyway */
    }
    setUser(null);
    // Full reload on purpose: wipes every cached query so the next person on
    // this browser can never see the previous user's data.
    window.location.assign("/login");
  }, []);

  const isAdmin = Boolean(user?.isAdmin);
  const value = useMemo(
    () => ({ user, ready, isAdmin, login, completePinLogin, updateUser, logout }),
    [user, ready, isAdmin, login, completePinLogin, updateUser, logout],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLocalSession() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useLocalSession outside provider");
  return ctx;
}
