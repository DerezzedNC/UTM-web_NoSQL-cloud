// Capa única de acceso a datos. Con NEXT_PUBLIC_USE_MOCK=true no necesita backend.
// Los endpoints reales siguen la Tabla 3 del documento (+ GET /incidencias y GET /incidencias/[id], ver nota en README).
import { INCIDENCIAS as DB, USUARIOS } from './mock';
const MOCK = process.env.NEXT_PUBLIC_USE_MOCK !== 'false';
const me = () => {
  try {
    const value = JSON.parse(localStorage.getItem('usuario') || 'null');
    return value && typeof value === 'object' && typeof value.rol === 'string' ? value : null;
  } catch {
    return null;
  }
};
const wait = v => new Promise(r => setTimeout(() => r(structuredClone(v)), 250));
const fail = m => new Promise((_, r) => setTimeout(() => r(new Error(m)), 250));
const visible = (i, u) => {
  if (!u) throw new Error('Tu sesión no es válida. Inicia sesión nuevamente.');
  return u.rol === 'tecnico' ? i.categoria === u.area_asignada : u.rol === 'reportante' ? i.reportante.id_usuario === u.id_usuario : true;
};
const find = id => DB.find(i => i._id === id);

async function http(path, opts = {}) {
  const form = opts.body instanceof FormData;
  const r = await fetch(`/api${path}`, { ...opts, headers: { ...(form ? {} : { 'Content-Type': 'application/json' }), Authorization: `Bearer ${localStorage.getItem('token')}` } });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || d.message || `Error ${r.status}`);
  return d;
}
const patch = (p, b) => http(p, { method: 'PATCH', body: JSON.stringify(b) });

export const api = {
  login: (correo, password) => MOCK
    ? (USUARIOS.find(x => x.correo === correo) && password ? wait({ token: 'mock', usuario: USUARIOS.find(x => x.correo === correo) }) : fail('Correo o contraseña incorrectos.'))
    : http('/auth/login', { method: 'POST', body: JSON.stringify({ correo, password }) }),
  listar: () => MOCK ? wait(DB.filter(i => visible(i, me()))) : http('/incidencias'),
  buscar: q => MOCK ? wait(DB.filter(i => visible(i, me()) && `${i.titulo} ${i.descripcion}`.toLowerCase().includes(q.toLowerCase()))) : http(`/incidencias/buscar?q=${encodeURIComponent(q)}`),
  obtener: id => MOCK ? (find(id) ? wait(find(id)) : fail('Incidencia no encontrada.')) : http(`/incidencias/${id}`),
  crear: data => {
    if (!MOCK) return http('/incidencias', { method: 'POST', body: JSON.stringify(data) });
    const u = me(), n = DB.length + 1, now = new Date().toISOString();
    DB.push({ ...data, _id: String(n), folio: `INC-${new Date().getFullYear()}-${String(n).padStart(4, '0')}`, estado: 'abierta', horas_invertidas: 0, fecha_creacion: now,
      reportante: { id_usuario: u.id_usuario || 'USR-0001', nombre: u.nombre, rol_institucional: 'Docente', correo: u.correo },
      historial_seguimiento: [{ fecha: now, autor: u.nombre, estado_nuevo: 'abierta', horas_sumadas: 0, comentario: 'Incidencia registrada.' }], evidencias_adjuntas: [] });
    return wait({ folio: DB[n - 1].folio, _id: String(n) });
  },
  evidencia: (id, file) => {
    if (!MOCK) { const fd = new FormData(); fd.append('archivo', file); return http(`/incidencias/${id}/evidencias`, { method: 'POST', body: fd }); }
    const i = find(id);
    i.evidencias_adjuntas.push({ nombre_archivo: file.name, tipo_mime: file.type, peso_kb: +(file.size / 1024).toFixed(1), storage_key: `evidencias-utm/${new Date().getFullYear()}/${i.categoria}/${i.folio}/${file.name}`, fecha_carga: new Date().toISOString() });
    return wait({ evidencias_adjuntas: i.evidencias_adjuntas });
  },
  estado: (id, { estado, comentario, horas }) => {
    if (!MOCK) return patch(`/incidencias/${id}/estado`, { estado, comentario, horas_sumadas: horas });
    const i = find(id), now = new Date().toISOString();
    i.estado = estado; i.horas_invertidas += horas;
    i.historial_seguimiento.push({ fecha: now, autor: me().nombre, estado_nuevo: estado, horas_sumadas: horas, comentario });
    estado === 'resuelta' ? (i.fecha_resolucion = now) : delete i.fecha_resolucion; // reabrir = $unset (RF-07)
    return wait({ estado, fecha_resolucion: i.fecha_resolucion });
  },
  tags: (id, { agregar, quitar }) => {
    if (!MOCK) return patch(`/incidencias/${id}/tags`, { agregar, quitar });
    const i = find(id);
    if (agregar && !i.tags.includes(agregar)) i.tags.push(agregar);
    if (quitar) i.tags = i.tags.filter(t => t !== quitar);
    return wait({ tags: i.tags });
  },
  analitica: () => {
    if (!MOCK) return http('/analitica');
    const por = {}, tg = {};
    DB.forEach(i => { const e = (por[i.ubicacion.edificio] ||= { edificio: i.ubicacion.edificio, total: 0, resueltas: 0, horas: 0 });
      e.total++; e.horas += i.horas_invertidas; if (i.estado === 'resuelta') e.resueltas++; i.tags.forEach(t => tg[t] = (tg[t] || 0) + 1); });
    return wait({ por_edificio: Object.values(por), top_tags: Object.entries(tg).map(([tag, total]) => ({ tag, total })).sort((a, b) => b.total - a.total).slice(0, 10) });
  },
};
