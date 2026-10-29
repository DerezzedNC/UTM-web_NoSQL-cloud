import type { RegistroIncidenciaPayload } from "./registro-schema";
import {
  INCIDENCIAS_INICIALES,
  type EstadoIncidencia,
  type EvidenciaAdjunta,
  type IncidenciaDetalle,
} from "./mock-data";

const STORAGE_KEY = "utm-desk-demo-incidencias";
let nextNumber = INCIDENCIAS_INICIALES.length + 1;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function readDemoIncidencias(): IncidenciaDetalle[] {
  if (typeof window === "undefined") return clone(INCIDENCIAS_INICIALES);
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (!stored) return clone(INCIDENCIAS_INICIALES);
  try {
    return JSON.parse(stored) as IncidenciaDetalle[];
  } catch {
    window.localStorage.removeItem(STORAGE_KEY);
    return clone(INCIDENCIAS_INICIALES);
  }
}

function writeDemoIncidencias(incidencias: IncidenciaDetalle[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(incidencias));
  window.dispatchEvent(new CustomEvent("utm-demo-incidencias-updated"));
}

export function createDemoIncidencia(payload: RegistroIncidenciaPayload) {
  const now = new Date().toISOString();
  const folio = `INC-${new Date().getFullYear()}-${String(nextNumber++).padStart(4, "0")}`;
  const detalle = payload.categoria === "computo_redes"
    ? {
        direccion_ip: payload.detalle_especifico.direccion_ip,
        vlan: payload.detalle_especifico.vlan,
        puerto_uplink: payload.detalle_especifico.puerto_uplink,
        equipos_afectados: payload.detalle_especifico.equipos_afectados,
      }
    : payload.detalle_especifico;
  const incidencia: IncidenciaDetalle = {
    _id: `demo-${crypto.randomUUID()}`,
    folio,
    titulo: payload.titulo,
    descripcion: payload.descripcion,
    prioridad: payload.prioridad,
    estado: "abierta",
    fecha_creacion: now,
    categoria: payload.categoria,
    tags: payload.tags,
    horas_invertidas: 0,
    evidencias_adjuntas: (payload.evidencias ?? []).map((item) => ({
      nombre_archivo: item.nombre_archivo,
      tipo_mime: item.tipo_mime,
      peso_kb: item.peso_kb,
      url_storage: `incidencias/${folio}/${item.nombre_archivo}`,
      fecha_carga: now,
    })),
    ubicacion: payload.ubicacion,
    reportante: {
      id_usuario: payload.reportante.id_usuario,
      nombre: payload.reportante.nombre,
      correo: payload.reportante.correo,
      rol: payload.reportante.rol,
    },
    detalle_especifico: detalle,
    historial_seguimiento: [{
      fecha: now,
      autor: payload.reportante.nombre,
      estado_nuevo: "abierta",
      horas_sumadas: 0,
      comentario: "Incidencia creada.",
    }],
  };
  const incidencias = [...readDemoIncidencias(), incidencia];
  writeDemoIncidencias(incidencias);
  return incidencia;
}

export function updateDemoIncidencia(
  id: string,
  update: (incidencia: IncidenciaDetalle) => void,
) {
  const incidencias = readDemoIncidencias();
  const incidencia = incidencias.find((item) => item._id === id || item.folio === id);
  if (!incidencia) return null;
  update(incidencia);
  writeDemoIncidencias(incidencias);
  return incidencia;
}

export function updateDemoStatus(
  id: string,
  estado: EstadoIncidencia,
  horas: number,
  comentario: string,
  autor: string,
) {
  return updateDemoIncidencia(id, (incidencia) => {
    incidencia.estado = estado;
    incidencia.horas_invertidas += horas;
    if (estado === "resuelta" || estado === "cerrada") incidencia.fecha_resolucion = new Date().toISOString();
    else delete incidencia.fecha_resolucion;
    incidencia.historial_seguimiento.unshift({
      fecha: new Date().toLocaleString("es-MX"),
      autor,
      estado_nuevo: estado,
      horas_sumadas: horas,
      comentario: comentario.trim(),
    });
  });
}

export function updateDemoTags(id: string, action: "add" | "remove", tag: string) {
  return updateDemoIncidencia(id, (incidencia) => {
    if (action === "add" && !incidencia.tags.includes(tag)) incidencia.tags.push(tag);
    if (action === "remove") incidencia.tags = incidencia.tags.filter((item) => item !== tag);
  });
}

export function addDemoEvidence(id: string, evidence: EvidenciaAdjunta) {
  return updateDemoIncidencia(id, (incidencia) => {
    incidencia.evidencias_adjuntas.push(evidence);
  });
}
