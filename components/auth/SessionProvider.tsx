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
};

type SessionContextValue = {
  session: Session | null;
  hydrated: boolean;
  signIn: (email: string, password: string) => string | null;
  switchRole: (role: FrontendRole) => void;
  signOut: () => void;
};

const SESSION_KEY = "utm-desk-session";
const roleProfiles: Record<FrontendRole, Omit<Session, "role">> = {
  admin: {
    id_usuario: "ADM-0311",
    rol_institucional: "Administrativo",
    name: "Carlos Méndez Cetina",
    department: "Dirección de Tecnologías de la Información",
    email: "carlos.mendez@utm.edu.mx",
  },
  directiva: {
    id_usuario: "DIR-0014",
    rol_institucional: "Administrativo",
    name: "Dra. Carmen Solís Pech",
    department: "Rectoría UTM",
    email: "carmen.solis@utm.edu.mx",
  },
  coordinador: {
    id_usuario: "CRD-0105",
    rol_institucional: "Administrativo",
    name: "Ing. Luis Briceño Tun",
    department: "Coordinación de Operaciones de Campus",
    email: "luis.briceno@utm.edu.mx",
  },
  tecnico: {
    id_usuario: "TEC-0205",
    rol_institucional: "Administrativo",
    name: "Ing. Roberto Pech Moo",
    department: "Cómputo y Telecomunicaciones",
    email: "roberto.pech@utm.edu.mx",
  },
  reportante: {
    id_usuario: "DOC-1042",
    rol_institucional: "Docente",
    name: "Mtro. Carlos Méndez Cetina",
    department: "División de Tecnologías de la Información",
    email: "carlos.docente@utm.edu.mx",
  },
};

const additionalAccounts: Record<string, Session> = {
  "admin@utm.edu.mx": { role: "admin", ...roleProfiles.admin },
  "directiva@utm.edu.mx": { role: "directiva", ...roleProfiles.directiva },
  "coordinador@utm.edu.mx": { role: "coordinador", ...roleProfiles.coordinador },
  "tecnico@utm.edu.mx": { role: "tecnico", ...roleProfiles.tecnico },
  "reportante@utm.edu.mx": { role: "reportante", ...roleProfiles.reportante },
  "miguel.balam@utm.edu.mx": {
    id_usuario: "TEC-0412",
    role: "tecnico",
    rol_institucional: "Administrativo",
    name: "Téc. Miguel Balam Dzib",
    department: "Mantenimiento e Infraestructura Física",
    email: "miguel.balam@utm.edu.mx",
  },
  "sofia.ortiz@utm.edu.mx": {
    id_usuario: "TEC-0518",
    role: "tecnico",
    rol_institucional: "Administrativo",
    name: "Lic. Sofía Ortiz Lara",
    department: "Servicios Escolares y Plataformas Académicas",
    email: "sofia.ortiz@utm.edu.mx",
  },
  "laura.canto@utm.edu.mx": {
    id_usuario: "ADM-0422",
    role: "reportante",
    rol_institucional: "Administrativo",
    name: "Lic. Laura Canto Várguez",
    department: "Servicios Escolares",
    email: "laura.canto@utm.edu.mx",
  },
  "alejandro.perez@utm.edu.mx": {
    id_usuario: "EST-2024",
    role: "reportante",
    rol_institucional: "Estudiante",
    name: "Alejandro Pérez Noh",
    department: "Ingeniería en Desarrollo de Software",
    email: "alejandro.perez@utm.edu.mx",
  },
};

const DEMO_PASSWORD = "utm-demo";

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
          const parsed = JSON.parse(stored) as Partial<Session> & { role?: FrontendRole };
          if (parsed.role && roleProfiles[parsed.role]) {
            const legacyIds = new Set(["u-carlos-mendez", "u-tec-morales", "u-coord-valenzuela", "u-directiva-arizmendi", "u-admin-mendez"]);
            const useProfileDefault = !parsed.id_usuario || legacyIds.has(parsed.id_usuario);
            const normalized: Session = useProfileDefault
              ? { role: parsed.role, ...roleProfiles[parsed.role] }
              : {
                  role: parsed.role,
                  ...roleProfiles[parsed.role],
                  ...parsed,
                  id_usuario: parsed.id_usuario!,
                  rol_institucional: parsed.rol_institucional ?? roleProfiles[parsed.role].rol_institucional,
                };
            window.localStorage.setItem(SESSION_KEY, JSON.stringify(normalized));
            setSession(normalized);
          } else {
            window.localStorage.removeItem(SESSION_KEY);
          }
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
      if (password !== DEMO_PASSWORD) {
        return "Correo o contraseña incorrectos.";
      }
      if (additionalAccounts[normalizedEmail]) {
        const next = additionalAccounts[normalizedEmail];
        window.localStorage.setItem(SESSION_KEY, JSON.stringify(next));
        setSession(next);
        router.replace("/portal");
        return null;
      }
      const role = (Object.keys(roleProfiles) as FrontendRole[]).find(
        (candidate) => roleProfiles[candidate].email === normalizedEmail,
      );
      if (!role) {
        return "Correo o contraseña incorrectos.";
      }
      const next = { role, ...roleProfiles[role] };
      window.localStorage.setItem(SESSION_KEY, JSON.stringify(next));
      setSession(next);
      router.replace("/portal");
      return null;
    },
    switchRole: (role) => {
      const next = { role, ...roleProfiles[role] };
      window.localStorage.setItem(SESSION_KEY, JSON.stringify(next));
      setSession(next);
      router.replace("/portal");
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
