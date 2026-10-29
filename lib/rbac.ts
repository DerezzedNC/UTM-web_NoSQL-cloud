export type FrontendRole =
  | "admin"
  | "directiva"
  | "coordinador"
  | "tecnico"
  | "reportante";

export type Permission =
  | "incidencia:create"
  | "evidencia:upload"
  | "incidencia:update"
  | "incidencia:tags"
  | "incidencia:read"
  | "analitica:read";

export const ROLE_LABELS: Record<FrontendRole, string> = {
  admin: "Administrador",
  directiva: "Directiva",
  coordinador: "Coordinador",
  tecnico: "Técnico",
  reportante: "Reportante",
};

const permissions: Record<FrontendRole, readonly Permission[]> = {
  admin: [
    "incidencia:create",
    "evidencia:upload",
    "incidencia:update",
    "incidencia:tags",
    "incidencia:read",
    "analitica:read",
  ],
  directiva: ["incidencia:read", "analitica:read"],
  coordinador: ["incidencia:read", "incidencia:update", "incidencia:tags"],
  tecnico: ["incidencia:read", "incidencia:update", "incidencia:tags", "evidencia:upload"],
  reportante: ["incidencia:create", "incidencia:read", "evidencia:upload"],
};

export function hasPermission(role: FrontendRole, permission: Permission) {
  return permissions[role]?.includes(permission) ?? false;
}

export function canCloseTicket(role: FrontendRole) {
  return role === "admin" || role === "coordinador";
}
