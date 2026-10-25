"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { FrontendRole } from "@/lib/rbac";

type Session = {
  role: FrontendRole;
  name: string;
  department: string;
  email: string;
};

type SessionContextValue = {
  session: Session | null;
  hydrated: boolean;
  signIn: (email: string, password: string) => string | null;
  signOut: () => void;
};

const SESSION_KEY = "utm-desk-session";
const roleProfiles: Record<FrontendRole, Omit<Session, "role">> = {
  admin: { name: "Ing. Carlos Méndez", department: "Administración de Infraestructura", email: "admin@utm.edu.mx" },
  directiva: { name: "Dra. Beatriz Arizmendi", department: "Dirección General de Tecnología", email: "directiva@utm.edu.mx" },
  coordinador: { name: "Lic. Mariana Valenzuela", department: "Coordinación de Operaciones", email: "coordinador@utm.edu.mx" },
  tecnico: { name: "Ing. Carlos Morales", department: "Infraestructura y TI", email: "tecnico@utm.edu.mx" },
  reportante: { name: "Carlos Méndez", department: "Docencia · Campus Central", email: "reportante@utm.edu.mx" },
};
const DEMO_PASSWORD = "utm-demo";

const SessionContext = createContext<SessionContextValue | null>(null);

function canAccess(role: FrontendRole, pathname: string) {
  if (role === "admin") return true;
  if (pathname === "/") return false;
  if (pathname.startsWith("/usuarios")) return false;
  if (pathname.startsWith("/activos")) return role === "tecnico" || role === "coordinador";
  if (pathname.startsWith("/monitoreo")) return role === "tecnico" || role === "coordinador";
  if (pathname.startsWith("/ajustes")) return false;
  if (pathname.startsWith("/auditoria")) return false;
  if (pathname.startsWith("/notificaciones")) return true;
  if (role === "directiva") return pathname.startsWith("/analitica") || pathname.startsWith("/incidencias");
  if (role === "reportante") return pathname.startsWith("/mis-incidencias") || pathname.startsWith("/incidencias/nueva") || pathname.startsWith("/incidencias/");
  return pathname.startsWith("/incidencias") || pathname.startsWith("/analitica");
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [session, setSession] = useState<Session | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const stored = window.localStorage.getItem(SESSION_KEY);
      if (stored) {
        try {
          setSession(JSON.parse(stored) as Session);
        } catch {
          window.localStorage.removeItem(SESSION_KEY);
        }
      }
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(timer);
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

  const value = useMemo<SessionContextValue>(() => ({
    session,
    hydrated,
    signIn: (email, password) => {
      const normalizedEmail = email.trim().toLowerCase();
      const role = (Object.keys(roleProfiles) as FrontendRole[]).find(
        (candidate) => roleProfiles[candidate].email === normalizedEmail,
      );
      if (!role || password !== DEMO_PASSWORD) {
        return "Correo o contraseña incorrectos.";
      }
      const next = { role, ...roleProfiles[role] };
      window.localStorage.setItem(SESSION_KEY, JSON.stringify(next));
      setSession(next);
      router.replace("/portal");
      return null;
    },
    signOut: () => {
      window.localStorage.removeItem(SESSION_KEY);
      setSession(null);
      router.replace("/login");
    },
  }), [hydrated, router, session]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession debe usarse dentro de SessionProvider.");
  return value;
}
