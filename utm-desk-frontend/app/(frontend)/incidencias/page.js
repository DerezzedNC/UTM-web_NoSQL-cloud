'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Shell from '@/components/Shell';
import { api } from '@/lib/api';
import { Badge, Err, PRIO, CAT, ESTADOS, inp, btn, fecha, lbl } from '@/components/ui';

export default function Lista() {
  const [items, setItems] = useState(null), [q, setQ] = useState(''), [est, setEst] = useState(''), [cat, setCat] = useState(''), [err, setErr] = useState('');
  const cargar = t => { setItems(null); setErr(''); (t?.trim() ? api.buscar(t) : api.listar()).then(setItems).catch(e => { setErr(e.message); setItems([]); }); };
  useEffect(() => { cargar(); }, []);
  const vis = (items || []).filter(i => (!est || i.estado === est) && (!cat || i.categoria === cat));
  return (
    <Shell>{() => (
      <div className="space-y-4">
        <form onSubmit={e => { e.preventDefault(); cargar(q); }} className="flex flex-wrap items-end gap-3">
          <label className="min-w-[14rem] flex-1 text-sm">Buscar por título o descripción<input className={inp} value={q} onChange={e => setQ(e.target.value)} placeholder="Ej. switch, filtración, calificaciones" /></label>
          <label className="text-sm">Estado<select className={inp} value={est} onChange={e => setEst(e.target.value)}><option value="">Todos</option>{ESTADOS.map(s => <option key={s} value={s}>{lbl(s)}</option>)}</select></label>
          <label className="text-sm">Área<select className={inp} value={cat} onChange={e => setCat(e.target.value)}><option value="">Todas</option>{Object.entries(CAT).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          <button className={btn}>Buscar</button>
        </form>
        <Err m={err} />
        {items === null ? <p className="text-sm text-slate-500">Cargando incidencias…</p> : vis.length === 0 ? <p className="rounded bg-white p-6 text-sm text-slate-500">No hay incidencias con estos filtros.</p> : (
          <ul className="space-y-2">{vis.map(i => (
            <li key={i._id}><Link href={`/incidencias/${i._id}`} className="flex overflow-hidden rounded bg-white shadow-sm hover:shadow">
              <span className={`w-1.5 ${PRIO[i.prioridad]}`} aria-label={`Prioridad ${i.prioridad}`} />
              <div className="flex-1 p-4">
                <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500"><span className="font-medium tabular-nums text-slate-800">{i.folio}</span><Badge v={i.estado} /><span>{CAT[i.categoria]}</span><span>· prioridad {i.prioridad}</span></div>
                <p className="mt-1 font-medium">{i.titulo}</p>
                <p className="text-sm text-slate-500">{i.ubicacion.edificio} · {fecha(i.fecha_creacion)}</p>
              </div></Link></li>))}</ul>)}
      </div>)}</Shell>
  );
}
