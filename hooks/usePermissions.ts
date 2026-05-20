"use client";

import { useCallback, useEffect, useState } from "react";
import type { ModuleSlug, PermissionAction, PermissionMap } from "@/lib/modules";

type PermissionsState = {
  permissions: PermissionMap | null;
  role: string | null;
  loading: boolean;
};

export function usePermissions() {
  const [state, setState] = useState<PermissionsState>({
    permissions: null,
    role: null,
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;
    fetch("/api/me/permissions")
      .then((r) => {
        if (!r.ok) throw new Error("unauthorized");
        return r.json();
      })
      .then(({ permissions, role }: { permissions: PermissionMap; role: string }) => {
        if (!cancelled) setState({ permissions, role, loading: false });
      })
      .catch(() => {
        if (!cancelled) setState({ permissions: null, role: null, loading: false });
      });
    return () => { cancelled = true; };
  }, []);

  const can = useCallback(
    (module: ModuleSlug, action: PermissionAction): boolean => {
      if (state.role === "ADMIN") return true;
      return state.permissions?.[module]?.[action] ?? false;
    },
    [state.permissions, state.role],
  );

  return {
    can,
    permissions: state.permissions,
    role: state.role,
    loading: state.loading,
    isAdmin: state.role === "ADMIN",
  };
}
