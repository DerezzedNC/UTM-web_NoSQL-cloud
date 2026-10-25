'use client';
import { useEffect, useState } from 'react';
import Shell from '@/components/Shell';
import { api } from '@/lib/api';
import { can } from '@/lib/rbac';
import { Err } from '@/components/ui';

export default function Analitica() {
  const [d, setD] = useState(null), [err, setErr] = useState('');
  useEffect(() => { api.analitica().then(setD).catch(e => setErr(e.message)); }, []);
  const mx = d ? Math.max(1, ...d.por_edificio.map(x => x.total)) : 1, mt = d ? Math.max(1, ...d.top_tags.map(x => x.total)) : 1;
  return (
    <Shell>{u => !can(u, 'analitica') ? <p className="rounded bg-white p-6 text-sm">Tu rol no tiene acceso a la analítica.</p> : (
      <div className="space-y-6"><h1 className="text-2xl font-semibold">Analítica de incidencias</h1><Err m={err} />
        {d && <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded bg-white p-4"><h2 className="font-medium">Incidencias por edificio</h2>
            <ul className="mt-3 space-y-3 text-sm">{d.por_edificio.map(e => (
              <li key={e.edificio}><div className="flex justify-between gap-2"><span>{e.edificio}</span><span className="tabular-nums text-slate-500">{e.resueltas}/{e.total} resueltas · {e.horas} h</span></div>
                <div className="mt-1 h-3 rounded bg-slate-100"><div className="h-3 rounded bg-teal" style={{ width: `${(e.total / mx) * 100}%` }} /></div></li>))}</ul></section>
          <section className="rounded bg-white p-4"><h2 className="font-medium">10 etiquetas más frecuentes (ventana de 60 días)</h2>
            <ol className="mt-3 space-y-2 text-sm">{d.top_tags.map(t => (
              <li key={t.tag} className="flex items-center gap-3"><span className="w-40 truncate">{t.tag}</span><div className="h-3 flex-1 rounded bg-slate-100"><div className="h-3 rounded bg-ink" style={{ width: `${(t.total / mt) * 100}%` }} /></div><span className="w-6 text-right tabular-nums">{t.total}</span></li>))}</ol></section>
        </div>}</div>)}</Shell>
  );
}
