"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "@/components/auth/SessionProvider";
import { hasPermission, ROLE_LABELS } from "@/lib/rbac";

export function AppHeader() {
  const { session, hydrated, signOut } = useSession();
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-slate-800 bg-[#0f172a] text-white">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-5">
        <Link href="/incidencias" className="flex shrink-0 items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#11695c] font-bold text-white">U</span>
          <span>
            <span className="block text-sm font-bold text-white">UTM Desk</span>
            <span className="block text-xs text-slate-400">Gestión de incidencias</span>
          </span>
        </Link>
        {hydrated && session ? (
          <div className="flex min-w-0 items-center gap-3 sm:gap-5">
            <nav className="hidden items-center gap-1 md:flex">
              <Link href="/incidencias" className={`rounded-lg px-3.5 py-2 text-sm ${pathname === "/incidencias" ? "bg-slate-800 text-white" : "text-slate-300 hover:text-white"}`}>Incidencias</Link>
              {hasPermission(session.role, "incidencia:create") ? <Link href="/incidencias/nueva" className={`rounded-lg px-3.5 py-2 text-sm ${pathname === "/incidencias/nueva" ? "bg-slate-800 text-white" : "text-slate-300 hover:text-white"}`}>Reportar</Link> : null}
              {hasPermission(session.role, "analitica:read") ? <Link href="/analitica" className={`rounded-lg px-3.5 py-2 text-sm ${pathname === "/analitica" ? "bg-slate-800 text-white" : "text-slate-300 hover:text-white"}`}>Analítica</Link> : null}
            </nav>
            <div className="hidden text-right lg:block">
              <p className="text-xs font-bold text-white">{session.name}</p>
              <p className="text-[10px] text-slate-400">{ROLE_LABELS[session.role]}</p>
            </div>
            <button
              type="button"
              onClick={signOut}
              className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800 hover:text-white"
            >
              Salir
            </button>
          </div>
        ) : null}
      </div>
      </div>
    </header>
  );
}
