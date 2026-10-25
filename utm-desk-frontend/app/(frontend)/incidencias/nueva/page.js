'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Shell from '@/components/Shell';
import { api } from '@/lib/api';
import { can } from '@/lib/rbac';
import { CAT, DET, inp, btn, Err } from '@/components/ui';

const EDIF = ['Edificio A - Rectoría y Auditorios', 'Edificio C - División de Tecnologías', 'Edificio K - Tecnologías de la Información'];
const slug = s => s.trim().toLowerCase().replace(/\s+/g, '-');

export default function Nueva() {
  const r = useRouter();
  const [f, setF] = useState({ titulo: '', descripcion: '', categoria: 'computo_redes', prioridad: 'media', edificio: '', piso: '', aula_laboratorio: '', tags: '' });
  const [d, setD] = useState({}), [file, setFile] = useState(null), [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  const set = k => e => setF({ ...f, [k]: e.target.value });
  const campos = DET[f.categoria].filter(c => c[2] !== 'list' || d.requiere_insumos);

  function valida() { // mismas reglas que el $jsonSchema (RNF-02)
    if (f.titulo.length < 10 || f.titulo.length > 150) return 'El título debe tener entre 10 y 150 caracteres.';
    if (f.descripcion.length < 15) return 'La descripción debe tener al menos 15 caracteres.';
    if (!f.edificio || !f.piso || !f.aula_laboratorio) return 'Completa edificio, piso y aula o laboratorio.';
    for (const [k, l, t, ...x] of campos) {
      if (t === 'bool' || t === 'list') continue;
      const v = d[k]; if (v === undefined || v === '') return `Completa: ${l}.`;
      if (t === 'int' && (!Number.isInteger(+v) || +v < x[0] || (x[1] && +v > x[1]))) return `${l} no es válido.`;
    }
    if (file && !['image/png', 'image/jpeg', 'application/pdf'].includes(file.type)) return 'La evidencia debe ser PNG, JPG o PDF.';
    if (file && file.size > 5120 * 1024) return 'La evidencia no puede pesar más de 5 MB.';
  }
  async function enviar(e) {
    e.preventDefault(); const m = valida(); if (m) return setErr(m);
    setBusy(true); setErr('');
    const detalle = {};
    for (const [k, , t] of campos) detalle[k] = t === 'int' ? +d[k] : t === 'bool' ? !!d[k] : t === 'list' ? String(d[k] || '').split(',').map(s => s.trim()).filter(Boolean) : d[k];
    try {
      const { _id } = await api.crear({ titulo: f.titulo.trim(), descripcion: f.descripcion.trim(), categoria: f.categoria, prioridad: f.prioridad,
        ubicacion: { edificio: f.edificio, piso: f.piso, aula_laboratorio: f.aula_laboratorio }, detalle_especifico: detalle, tags: f.tags.split(',').filter(t => t.trim()).map(slug) });
      if (file) await api.evidencia(_id, file);
      r.push(`/incidencias/${_id}`);
    } catch (x) { setErr(x.message); setBusy(false); }
  }
  const campo = ([k, l, t, ...x]) => (
    <label key={k} className="block text-sm">
      {t === 'bool' ? <span className="flex items-center gap-2 pt-6"><input type="checkbox" checked={!!d[k]} onChange={e => setD({ ...d, [k]: e.target.checked })} />{l}</span> : <>{l}
        {t === 'sel' ? <select className={inp} value={d[k] || ''} onChange={e => setD({ ...d, [k]: e.target.value })}><option value="">Selecciona</option>{x[0].map(o => <option key={o}>{o}</option>)}</select>
          : <input className={inp} type={t === 'int' ? 'number' : 'text'} value={d[k] ?? ''} onChange={e => setD({ ...d, [k]: e.target.value })} />}</>}
    </label>);
  return (
    <Shell>{u => !can(u, 'crear') ? <p className="rounded bg-white p-6 text-sm">Tu rol no puede registrar incidencias.</p> : (
      <form onSubmit={enviar} className="mx-auto max-w-2xl space-y-5">
        <h1 className="text-2xl font-semibold">Reportar incidencia</h1>
        <Err m={err} />
        <label className="block text-sm">Título<input className={inp} value={f.titulo} onChange={set('titulo')} maxLength={150} /></label>
        <label className="block text-sm">Descripción<textarea className={inp} rows={4} value={f.descripcion} onChange={set('descripcion')} /></label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm">Área<select className={inp} value={f.categoria} onChange={e => { setF({ ...f, categoria: e.target.value }); setD({}); }}>{Object.entries(CAT).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          <label className="text-sm">Prioridad<select className={inp} value={f.prioridad} onChange={set('prioridad')}>{['baja', 'media', 'alta', 'critica'].map(p => <option key={p}>{p}</option>)}</select></label>
          <label className="text-sm">Edificio<input className={inp} list="edif" value={f.edificio} onChange={set('edificio')} /><datalist id="edif">{EDIF.map(e => <option key={e} value={e} />)}</datalist></label>
          <label className="text-sm">Piso<input className={inp} value={f.piso} onChange={set('piso')} /></label>
          <label className="text-sm sm:col-span-2">Aula o laboratorio<input className={inp} value={f.aula_laboratorio} onChange={set('aula_laboratorio')} /></label>
        </div>
        <fieldset className="rounded border border-slate-300 bg-white p-4"><legend className="px-1 text-sm font-medium">Datos de {CAT[f.categoria]}</legend>
          <div className="grid gap-4 sm:grid-cols-2">{campos.map(campo)}</div></fieldset>
        <label className="block text-sm">Etiquetas (separadas por coma)<input className={inp} value={f.tags} onChange={set('tags')} placeholder="sin-red, vlan-20" /></label>
        <label className="block text-sm">Evidencia (PNG, JPG o PDF, máx. 5 MB)<input className="mt-1 block text-sm" type="file" accept="image/png,image/jpeg,application/pdf" onChange={e => setFile(e.target.files[0] || null)} /></label>
        <button className={btn} disabled={busy}>{busy ? 'Registrando…' : 'Registrar incidencia'}</button>
      </form>)}</Shell>
  );
}
