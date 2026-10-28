'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Shell from '@/components/Shell';
import { api } from '@/lib/api';
import { can } from '@/lib/rbac';
import { Badge, Err, PRIO, CAT, ESTADOS, inp, btn, fecha, lbl } from '@/components/ui';

export default function Lista() {
  const [items, setItems] = useState(null), [q, setQ] = useState(''), [est, setEst] = useState(''), [cat, setCat] = useState(''), [err, setErr] = useState('');
  const cargar = t => { setItems(null); setErr(''); (t?.trim() ? api.buscar(t) : api.listar()).then(setItems).catch(e => { setErr(e.message); setItems([]); }); };
  useEffect(() => { cargar(); }, []);
  const vis = (items || []).filter(i => (!est || i.estado === est) && (!cat || i.categoria === cat));
  return (
    <Shell>{u => (
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div><p className="text-sm font-semibold uppercase tracking-wider text-teal">Centro de atención</p><h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">Incidencias</h1><p className="mt-1 text-sm text-slate-500">Consulta y da seguimiento a los reportes del campus.</p></div>
          {can(u, 'crear') && <Link href="/incidencias/nueva" className={`${btn} inline-flex items-center`}>+ Reportar incidencia</Link>}
        </div>
        <form onSubmit={e => { e.preventDefault(); cargar(q); }} className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
          <div className="grid gap-3 md:grid-cols-[1fr_auto_auto_auto] md:items-end">
            <label className="text-sm font-medium text-slate-700">Buscar por título o descripción<input className={inp} value={q} onChange={e => setQ(e.target.value)} placeholder="Ej. switch, filtración, calificaciones" /></label>
            <label className="text-sm font-medium text-slate-700">Estado<select className={inp} value={est} onChange={e => setEst(e.target.value)}><option value="">Todos</option>{ESTADOS.map(s => <option key={s} value={s}>{lbl(s)}</option>)}</select></label>
            <label className="text-sm font-medium text-slate-700">Área<select className={inp} value={cat} onChange={e => setCat(e.target.value)}><option value="">Todas</option>{Object.entries(CAT).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
            <button className={`${btn} w-full md:w-auto`}>Buscar</button>
          </div>
        </form>
        <Err m={err} />
        {items === null ? <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">Cargando incidencias…</div> : vis.length === 0 ? <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center"><p className="font-medium text-slate-800">No hay incidencias con estos filtros.</p><p className="mt-1 text-sm text-slate-500">Prueba con otros criterios de búsqueda.</p></div> : (
          <ul className="space-y-3">{vis.map(i => (
            <li key={i._id}><Link href={`/incidencias/${i._id}`} className="group flex overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-teal/30 hover:shadow-md">
              <span className={`w-1.5 ${PRIO[i.prioridad]}`} aria-label={`Prioridad ${i.prioridad}`} />
              <div className="flex-1 p-5">
                <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500"><span className="font-semibold tabular-nums text-slate-800">{i.folio}</span><Badge v={i.estado} /><span>{CAT[i.categoria]}</span><span className="hidden sm:inline">· prioridad {i.prioridad}</span></div>
                <p className="mt-2 font-semibold text-slate-900 group-hover:text-teal-dark">{i.titulo}</p>
                <p className="mt-1 text-sm text-slate-500">{i.ubicacion.edificio} · {fecha(i.fecha_creacion)}</p>
              </div></Link></li>))}</ul>)}
      </div>)}</Shell>
  );
}
