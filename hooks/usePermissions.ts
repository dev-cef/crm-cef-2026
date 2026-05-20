"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import type { ModuleSlug, PermissionAction, PermissionMap } from "@/lib/modules";

type PermissionsState = {
  permissions: PermissionMap | null;
  role: string | null;
  loading: boolean;
};

export function usePermissions() {
  const { data: session, status } = useSession();
  const [state, setState] = useState<PermissionsState>({
    permissions: null,
    role: null,
    loading: true,
  });

  useEffect(() => {
    if (status === "loading") return;
    if (status === "unauthenticated") {
      setState({ permissions: null, role: null, loading: false });
      return;
    }

    fetch("/api/me/permissions")
      .then((r) => r.json())
      .then(({ permissions, role }) => {
        setState({ permissions, role, loading: false });
      })
      .catch(() => setState({ permissions: null, role: null, loading: false }));
  }, [status, session?.user?.id]);

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
