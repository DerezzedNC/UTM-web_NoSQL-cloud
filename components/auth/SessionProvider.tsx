"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { FrontendRole } from "@/lib/rbac";
import type { RolReportante } from "@/lib/incidencias/types";

type Session = {
  id_usuario: string;
  role: FrontendRole;
  rol_institucional: RolReportante;
  name: string;
  department: string;
  email: string;
  area_asignada?: string;
};

type SessionContextValue = {
  session: Session | null;
  hydrated: boolean;
  signIn: (email: string, password: string) => Promise<string | null>;
  switchRole: (role: FrontendRole) => void;
  signOut: () => Promise<void>;
};

const SESSION_KEY = "utm-desk-session";

const SessionContext = createContext<SessionContextValue | null>(null);

function canAccess(role: FrontendRole, pathname: string) {
  if (role === "admin") return true;
  if (pathname === "/") return false;
  if (pathname.startsWith("/mis-incidencias")) return true;
  if (pathname.startsWith("/incidencias/nueva")) return role === "reportante";
  if (pathname.startsWith("/analitica")) return role === "directiva";
  if (role === "directiva") return pathname.startsWith("/analitica") || pathname.startsWith("/incidencias");
  if (role === "reportante") return pathname.startsWith("/incidencias");
  return pathname.startsWith("/incidencias");
}

function userToSession(user: {
  id_usuario: string;
  rol: FrontendRole;
  nombre: string;
  correo: string;
  departamento?: string;
  rol_institucional?: string;
  area_asignada?: string;
}): Session {
  return {
    id_usuario: user.id_usuario,
    role: user.rol,
    rol_institucional: (user.rol_institucional ?? "Administrativo") as RolReportante,
    name: user.nombre,
    department: user.departamento || "UTM Campus",
    email: user.correo,
    ...(user.area_asignada ? { area_asignada: user.area_asignada } : {}),
  };
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [session, setSession] = useState<Session | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function hydrate() {
      try {
        const res = await fetch("/api/auth/me");
        if (res.ok) {
          const body = (await res.json()) as { data?: { user: Parameters<typeof userToSession>[0] } };
          if (body.data?.user && isMounted) {
            const serverSession = userToSession(body.data.user);
            setSession(serverSession);
            window.localStorage.setItem(SESSION_KEY, JSON.stringify(serverSession));
            setHydrated(true);
            return;
          }
        }
      } catch {
        // Fallback local ante fallos transitorios de red
      }

      if (!isMounted) return;

      const stored = window.localStorage.getItem(SESSION_KEY);
      if (stored) {
        try {
          const parsed = JSON.parse(stored) as Session;
          if (parsed.role && parsed.id_usuario) {
            setSession(parsed);
          } else {
            window.localStorage.removeItem(SESSION_KEY);
          }
        } catch {
          window.localStorage.removeItem(SESSION_KEY);
        }
      }
      setHydrated(true);
    }

    hydrate();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (pathname === "/login") {
      if (session) router.replace("/portal");
      return;
    }
    if (!session) {
      router.replace("/login");
      return;
    }
    if (pathname === "/portal" || !canAccess(session.role, pathname)) {
      router.replace("/portal");
    }
  }, [hydrated, pathname, router, session]);

  const value = useMemo<SessionContextValue>(
    () => ({
      session,
      hydrated,
      signIn: async (email, password) => {
        try {
          const res = await fetch("/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ correo: email.trim(), password }),
          });
          const body = (await res.json()) as {
            data?: { user: Parameters<typeof userToSession>[0] };
            error?: string;
          };
          if (!res.ok || !body.data?.user) {
            return body.error ?? "Correo o contraseña incorrectos.";
          }
          const next = userToSession(body.data.user);
          window.localStorage.setItem(SESSION_KEY, JSON.stringify(next));
          setSession(next);
          router.replace("/portal");
          return null;
        } catch {
          return "No se pudo conectar con el servicio de autenticación.";
        }
      },
      switchRole: (role) => {
        if (session) {
          const updated: Session = { ...session, role };
          window.localStorage.setItem(SESSION_KEY, JSON.stringify(updated));
          setSession(updated);
          router.replace("/portal");
        }
      },
      signOut: async () => {
        try {
          await fetch("/api/auth/logout", { method: "POST" });
        } catch {
          // Continuar con limpieza local incluso si la red falla
        }
        window.localStorage.removeItem(SESSION_KEY);
        setSession(null);
        router.replace("/login");
      },
    }),
    [hydrated, router, session]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession debe usarse dentro de SessionProvider.");
  return value;
}
