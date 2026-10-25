"use client";

import Link from "next/link";
import { useSession } from "@/components/auth/SessionProvider";

export function AppHeader() {
  const { session, hydrated, signOut } = useSession();

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/60 bg-white/75 text-slate-900 backdrop-blur-md">
      <div className="mx-auto flex w-full items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-3">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 text-[10px] font-bold text-white shadow-lg shadow-emerald-500/20">
            U
          </span>
          <span>
            <span className="block text-[11px] font-bold uppercase tracking-[0.2em] text-slate-900">UTM Desk</span>
            <span className="block font-mono text-[9px] tracking-wider text-slate-400">NOSQL CLOUD OPS</span>
          </span>
        </Link>
        {hydrated && session ? (
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-xs font-bold text-slate-800">{session.name}</p>
              <p className="text-[10px] uppercase tracking-wide text-slate-400">{session.role}</p>
            </div>
            <Link
              href="/incidencias/nueva"
              className="rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-emerald-500/20 hover:from-emerald-500 hover:to-teal-500"
            >
              <span aria-hidden="true">+</span> Nueva incidencia
            </Link>
            <button
              type="button"
              onClick={signOut}
              className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 hover:border-slate-400 hover:bg-slate-50"
            >
              Cerrar sesión
            </button>
          </div>
        ) : null}
      </div>
    </header>
  );
}
