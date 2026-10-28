'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useSession } from '@/lib/session';
import { can } from '@/lib/rbac';

// Uso: <Shell>{user => (...)}</Shell>  — protege la ruta y filtra el menú por rol.
export default function Shell({ children }) {
  const u = useSession(), path = usePathname(), r = useRouter();
  if (!u) return null;
  const nav = [['/incidencias', 'Incidencias', true], ['/incidencias/nueva', 'Reportar incidencia', can(u, 'crear')], ['/analitica', 'Analítica', can(u, 'analitica')]];
  return (
    <div className="min-h-screen bg-paper">
      <header className="bg-ink text-white">
        <div className="mx-auto flex min-h-16 max-w-6xl items-center gap-4 px-4">
          <Link href="/incidencias" className="flex shrink-0 items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal text-sm font-bold shadow-lg shadow-teal/20">U</span>
            <span><span className="block font-semibold leading-4 tracking-tight">UTM Desk</span><span className="hidden text-[10px] text-white/55 sm:block">Gestión de incidencias</span></span>
          </Link>
          <nav className="hidden flex-1 gap-1 text-sm md:flex">
            {nav.filter(n => n[2]).map(([h, t]) => <Link key={h} href={h} className={`rounded-lg px-3 py-2 transition ${path === h ? 'bg-white/15 font-medium' : 'text-white/75 hover:bg-white/10 hover:text-white'}`}>{t}</Link>)}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-right text-sm sm:block"><span className="block font-medium">{u.nombre}</span><span className="text-xs capitalize text-white/60">{u.rol}</span></span>
            <button onClick={() => { localStorage.clear(); r.replace('/login'); }} className="rounded-lg border border-white/15 px-3 py-2 text-sm text-white/80 transition hover:bg-white/10 hover:text-white">Salir</button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 pb-3 text-sm md:hidden">
          {nav.filter(n => n[2]).map(([h, t]) => <Link key={h} href={h} className={`whitespace-nowrap rounded-lg px-3 py-1.5 ${path === h ? 'bg-white/15 font-medium' : 'text-white/75'}`}>{t}</Link>)}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children(u)}</main>
    </div>
  );
}
