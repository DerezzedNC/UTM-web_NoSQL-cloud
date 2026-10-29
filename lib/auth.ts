import { SignJWT, jwtVerify } from "jose";
import type { FrontendRole } from "@/lib/rbac";

export const SESSION_COOKIE_NAME = "utm_session";

export type AuthUser = {
  id_usuario: string;
  nombre: string;
  correo: string;
  rol: FrontendRole;
  rol_institucional?: "Docente" | "Estudiante" | "Administrativo";
  area_asignada?: "computo_redes" | "infraestructura" | "academico";
  departamento: string;
};

export type SessionPayload = AuthUser & {
  exp?: number;
  iat?: number;
};

function getAuthSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.trim().length < 16) {
    throw new Error("AUTH_SECRET no está configurado o es demasiado corto (mínimo 16 caracteres).");
  }
  return new TextEncoder().encode(secret);
}

export function parseCookies(cookieHeader: string | null): Record<string, string> {
  if (!cookieHeader) return {};
  const map: Record<string, string> = {};
  const parts = cookieHeader.split(";");
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = decodeURIComponent(trimmed.slice(0, eqIdx).trim());
    const val = decodeURIComponent(trimmed.slice(eqIdx + 1).trim());
    if (key) {
      map[key] = val;
    }
  }
  return map;
}

/**
 * Emite un JWT HS256 firmado con AUTH_SECRET en el servidor.
 */
export async function createSessionToken(
  user: AuthUser,
  expiresIn: string = "8h"
): Promise<string> {
  const secret = getAuthSecret();
  return await new SignJWT({ ...user })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(secret);
}

/**
 * Verifica un JWT HS256 en el servidor. Devuelve la identidad verificada o null si falla.
 */
export async function verifySessionToken(token: string): Promise<AuthUser | null> {
  if (!token || typeof token !== "string") {
    return null;
  }
  try {
    const secret = getAuthSecret();
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ["HS256"],
    });

    if (!payload || typeof payload !== "object") {
      return null;
    }

    if (!payload.id_usuario || !payload.correo || !payload.rol) {
      return null;
    }

    return {
      id_usuario: String(payload.id_usuario),
      nombre: String(payload.nombre ?? ""),
      correo: String(payload.correo),
      rol: payload.rol as FrontendRole,
      rol_institucional: payload.rol_institucional as AuthUser["rol_institucional"],
      area_asignada: payload.area_asignada as AuthUser["area_asignada"],
      departamento: String(payload.departamento ?? ""),
    };
  } catch {
    return null;
  }
}

/**
 * Extrae y valida la identidad del usuario autenticado en el servidor.
 * Soporta cabecera Authorization: Bearer <token> (Postman, scripts) y cookie HttpOnly utm_session (navegadores).
 * NO confía en x-user-role ni en datos directos del cliente.
 */
export async function getSessionUser(request: Request): Promise<AuthUser | null> {
  // 1. Authorization: Bearer <token>
  const authHeader = request.headers.get("authorization");
  if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
    const token = authHeader.substring(7).trim();
    if (token) {
      const user = await verifySessionToken(token);
      if (user) return user;
    }
  }

  // 2. Cookie utm_session
  const cookieHeader = request.headers.get("cookie");
  if (cookieHeader) {
    const cookies = parseCookies(cookieHeader);
    const token = cookies[SESSION_COOKIE_NAME];
    if (token) {
      const user = await verifySessionToken(token);
      if (user) return user;
    }
  }

  return null;
}

export function buildSessionCookie(token: string, maxAgeSeconds: number = 8 * 60 * 60): string {
  const isProd = process.env.NODE_ENV === "production";
  return `${SESSION_COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${isProd ? "; Secure" : ""}`;
}

export function buildClearSessionCookie(): string {
  const isProd = process.env.NODE_ENV === "production";
  return `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT${isProd ? "; Secure" : ""}`;
}
