'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Shell from '@/components/Shell';
import { api } from '@/lib/api';
import { can } from '@/lib/rbac';
import { Badge, Err, CAT, DET, ESTADOS, inp, btn, fecha, lbl } from '@/components/ui';

export default function Detalle() {
  const { id } = useParams();
  const [i, setI] = useState(null), [err, setErr] = useState(''), [tag, setTag] = useState(''), [es, setEs] = useState({ estado: '', comentario: '', horas: '' });
  useEffect(() => { api.obtener(id).then(setI).catch(e => setErr(e.message)); }, [id]);
  const run = fn => async (...a) => { setErr(''); try { await fn(...a); setI(await api.obtener(id)); } catch (e) { setErr(e.message); } };
  const cambiar = run(async () => {
    if (!es.estado || !es.comentario.trim()) throw new Error('Elige un estado y escribe un comentario.');
    await api.estado(id, { estado: es.estado, comentario: es.comentario.trim(), horas: +es.horas || 0 }); setEs({ estado: '', comentario: '', horas: '' });
  });
  const agregar = run(async () => { const t = tag.trim().toLowerCase().replace(/\s+/g, '-'); if (t) { await api.tags(id, { agregar: t }); setTag(''); } });
  const quitar = run(t => api.tags(id, { quitar: t }));
  const subir = run(async e => {
    const f = e.target.files[0]; if (!f) return;
    if (!['image/png', 'image/jpeg', 'application/pdf'].includes(f.type) || f.size > 5120 * 1024) throw new Error('Solo PNG, JPG o PDF de hasta 5 MB.');
    await api.evidencia(id, f);
  });
  const dias = i?.fecha_resolucion && Math.max(0, 60 - Math.floor((Date.now() - new Date(i.fecha_resolucion)) / 864e5));
  const val = v => Array.isArray(v) ? v.join(', ') : typeof v === 'boolean' ? (v ? 'Sí' : 'No') : v;
  return (
    <Shell>{u => !i ? (err ? <Err m={err} /> : <p className="text-sm text-slate-500">Cargando…</p>) : (
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-6">
          <Err m={err} />
          <header><div className="flex flex-wrap items-center gap-2 text-sm text-slate-500"><span className="font-medium tabular-nums text-slate-800">{i.folio}</span><Badge v={i.estado} /><span>{CAT[i.categoria]}</span><span>· prioridad {i.prioridad}</span></div>
            <h1 className="mt-1 text-2xl font-semibold">{i.titulo}</h1><p className="mt-2 text-slate-600">{i.descripcion}</p></header>
          {i.estado === 'resuelta' && i.fecha_resolucion && <p className="rounded bg-emerald-50 px-3 py-2 text-sm text-emerald-800">Resuelta el {fecha(i.fecha_resolucion)}. Se eliminará automáticamente en {dias} días; si se reabre, se cancela la depuración.</p>}
          <section className="rounded bg-white p-4"><h2 className="font-medium">Detalle de {CAT[i.categoria]}</h2>
            <dl className="mt-2 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">{DET[i.categoria].filter(c => i.detalle_especifico[c[0]] !== undefined).map(([k, l]) => <div key={k}><dt className="text-slate-500">{l}</dt><dd>{val(i.detalle_especifico[k])}</dd></div>)}</dl></section>
          <section className="rounded bg-white p-4"><h2 className="font-medium">Historial de seguimiento</h2>
            <ol className="mt-3 space-y-4 border-l-2 border-slate-200 pl-4">{i.historial_seguimiento.map((h, n) => (
              <li key={n} className="text-sm"><div className="flex flex-wrap items-center gap-2"><Badge v={h.estado_nuevo} /><span className="text-slate-500">{fecha(h.fecha)} · {h.autor}{h.horas_sumadas > 0 && ` · +${h.horas_sumadas} h`}</span></div><p className="mt-1">{h.comentario}</p></li>))}</ol></section>
        </div>
        <aside className="space-y-4 text-sm">
          <section className="rounded bg-white p-4"><h2 className="font-medium">Datos generales</h2>
            <p className="mt-2"><span className="text-slate-500">Reporta:</span> {i.reportante.nombre} ({i.reportante.rol_institucional})</p>
            <p><span className="text-slate-500">Técnico:</span> {i.tecnico_asignado?.nombre || 'Sin asignar'}</p>
            <p><span className="text-slate-500">Ubicación:</span> {i.ubicacion.edificio}, {i.ubicacion.piso}, {i.ubicacion.aula_laboratorio}</p>
            <p><span className="text-slate-500">Horas invertidas:</span> {i.horas_invertidas}</p></section>
          {can(u, 'estado') && <section className="space-y-2 rounded bg-white p-4"><h2 className="font-medium">Actualizar estado</h2>
            <select className={inp} value={es.estado} onChange={e => setEs({ ...es, estado: e.target.value })}><option value="">Nuevo estado</option>{ESTADOS.map(s => <option key={s} value={s}>{lbl(s)}</option>)}</select>
            <textarea className={inp} rows={2} placeholder="Comentario para la bitácora" value={es.comentario} onChange={e => setEs({ ...es, comentario: e.target.value })} />
            <input className={inp} type="number" min="0" step="0.5" placeholder="Horas trabajadas" value={es.horas} onChange={e => setEs({ ...es, horas: e.target.value })} />
            <button onClick={cambiar} className={btn}>Guardar cambio</button></section>}
          <section className="rounded bg-white p-4"><h2 className="font-medium">Etiquetas</h2>
            <div className="mt-2 flex flex-wrap gap-1.5">{i.tags.map(t => <span key={t} className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5">{t}{can(u, 'tags') && <button onClick={() => quitar(t)} aria-label={`Quitar ${t}`}>×</button>}</span>)}</div>
            {can(u, 'tags') && <div className="mt-2 flex gap-2"><input className={inp + ' mt-0'} value={tag} onChange={e => setTag(e.target.value)} placeholder="Nueva etiqueta" /><button onClick={agregar} className={btn}>Agregar</button></div>}</section>
          <section className="rounded bg-white p-4"><h2 className="font-medium">Evidencias</h2>
            {i.evidencias_adjuntas.length === 0 ? <p className="mt-2 text-slate-500">Aún no hay archivos adjuntos.</p> : <ul className="mt-2 space-y-1">{i.evidencias_adjuntas.map(e => <li key={e.storage_key}>{e.nombre_archivo} <span className="text-slate-500">({e.peso_kb} KB)</span></li>)}</ul>}
            {can(u, 'evidencia') && <input className="mt-3 block text-xs" type="file" accept="image/png,image/jpeg,application/pdf" onChange={subir} />}</section>
        </aside>
      </div>)}</Shell>
  );
}
