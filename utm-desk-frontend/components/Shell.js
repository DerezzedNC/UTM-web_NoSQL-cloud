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
    <div className="min-h-screen">
      <header className="bg-ink text-white">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4">
          <Link href="/incidencias" className="font-semibold">UTM Desk</Link>
          <nav className="flex flex-1 gap-1 text-sm">
            {nav.filter(n => n[2]).map(([h, t]) => <Link key={h} href={h} className={`rounded px-3 py-1.5 ${path === h ? 'bg-white/15' : 'hover:bg-white/10'}`}>{t}</Link>)}
          </nav>
          <span className="hidden text-sm text-white/70 sm:block">{u.nombre} · {u.rol}</span>
          <button onClick={() => { localStorage.clear(); r.replace('/login'); }} className="text-sm underline">Salir</button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children(u)}</main>
    </div>
  );
}
