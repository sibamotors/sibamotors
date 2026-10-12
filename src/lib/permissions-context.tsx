import { useQuery } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import { useLocalSession } from "./local-session";
import { getMyPermissions, type BoardAction } from "./permissions";

type PermCtx = {
  can: (action: BoardAction) => boolean;
  denied: BoardAction[];
  ready: boolean;
};

const Ctx = createContext<PermCtx | null>(null);

export function PermissionsProvider({ children }: { children: ReactNode }) {
  const { user, isAdmin } = useLocalSession();
  const q = useQuery({
    queryKey: ["my-permissions", user?.username],
    queryFn: () => getMyPermissions({ data: { username: user!.username } }),
    enabled: Boolean(user),
    staleTime: 10_000,
  });

  const denied = useMemo<BoardAction[]>(() => (isAdmin ? [] : (q.data?.denied ?? [])), [isAdmin, q.data]);

  const can = useCallback(
    (action: BoardAction) => {
      if (isAdmin) return true;
      return !denied.includes(action);
    },
    [isAdmin, denied],
  );

  const value = useMemo(
    () => ({ can, denied, ready: isAdmin || q.isSuccess || q.isError }),
    [can, denied, isAdmin, q.isSuccess, q.isError],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePermissions() {
  const ctx = useContext(Ctx);
  if (!ctx) {
    return {
      can: () => true,
      denied: [] as BoardAction[],
      ready: true,
    };
  }
  return ctx;
}
