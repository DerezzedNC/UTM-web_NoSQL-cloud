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
      <div className="space-y-6"><div><p className="text-sm font-semibold uppercase tracking-wider text-teal">Vista general</p><h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">Analítica de incidencias</h1><p className="mt-1 text-sm text-slate-500">Observa el comportamiento de los reportes del campus.</p></div><Err m={err} />
        {d && <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm"><h2 className="font-semibold text-slate-900">Incidencias por edificio</h2><p className="mt-1 text-sm text-slate-500">Volumen total y casos resueltos.</p>
            <ul className="mt-3 space-y-3 text-sm">{d.por_edificio.map(e => (
              <li key={e.edificio}><div className="flex justify-between gap-2"><span>{e.edificio}</span><span className="tabular-nums text-slate-500">{e.resueltas}/{e.total} resueltas · {e.horas} h</span></div>
                <div className="mt-1 h-3 rounded bg-slate-100"><div className="h-3 rounded bg-teal" style={{ width: `${(e.total / mx) * 100}%` }} /></div></li>))}</ul></section>
          <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm"><h2 className="font-semibold text-slate-900">Etiquetas más frecuentes</h2><p className="mt-1 text-sm text-slate-500">Principales temas identificados en los últimos 60 días.</p>
            <ol className="mt-3 space-y-2 text-sm">{d.top_tags.map(t => (
              <li key={t.tag} className="flex items-center gap-3"><span className="w-40 truncate">{t.tag}</span><div className="h-3 flex-1 rounded bg-slate-100"><div className="h-3 rounded bg-ink" style={{ width: `${(t.total / mt) * 100}%` }} /></div><span className="w-6 text-right tabular-nums">{t.total}</span></li>))}</ol></section>
        </div>}</div>)}</Shell>
  );
}
