export type FrontendRole =
  | "admin"
  | "directiva"
  | "coordinador"
  | "tecnico"
  | "reportante";

export type Permission =
  | "ticket:create"
  | "dispatch:assign"
  | "network:poe_reboot"
  | "ticket:update"
  | "ticket:tag"
  | "evidence:upload"
  | "ticket:close";

const permissions: Record<FrontendRole, readonly Permission[]> = {
  admin: [
    "ticket:create",
    "dispatch:assign",
    "network:poe_reboot",
    "ticket:update",
    "ticket:tag",
    "evidence:upload",
    "ticket:close",
  ],
  directiva: [],
  coordinador: ["dispatch:assign", "ticket:tag", "ticket:close"],
  tecnico: ["network:poe_reboot", "ticket:update", "ticket:tag", "evidence:upload"],
  reportante: ["ticket:create", "evidence:upload"],
};

export function hasPermission(role: FrontendRole, permission: Permission) {
  return permissions[role].includes(permission);
}
