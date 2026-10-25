"use client";

import { createContext, useContext } from "react";
import { hasPermission, type FrontendRole, type Permission } from "@/lib/rbac";

const RoleContext = createContext<FrontendRole>("reportante");

export function RBACProvider({
  role,
  children,
}: {
  role: FrontendRole;
  children: React.ReactNode;
}) {
  return <RoleContext.Provider value={role}>{children}</RoleContext.Provider>;
}

export function useRBAC() {
  const role = useContext(RoleContext);
  return {
    role,
    can: (permission: Permission) => hasPermission(role, permission),
  };
}

export function Can({
  do: permission,
  children,
  fallback = null,
}: {
  do: Permission;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const { can } = useRBAC();
  return can(permission) ? children : fallback;
}
