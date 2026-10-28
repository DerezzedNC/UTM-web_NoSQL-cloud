import type {
  CategoriaIncidencia,
  EstadoIncidencia,
  EvidenciaAdjunta,
  HistorialSeguimiento,
  IncidenciaCampus,
  Prioridad,
  RolReportante,
  UbicacionCampus,
} from "./types";

export type IncidenciaDetalle = IncidenciaCampus;
export type { EstadoIncidencia, EvidenciaAdjunta } from "./types";
export type RolUsuario = "admin" | "directiva" | "coordinador" | "tecnico" | "reportante";

const evento = (
  fecha: string,
  autor: string,
  estado_nuevo: EstadoIncidencia,
  horas_sumadas: number,
  comentario: string,
): HistorialSeguimiento => ({ fecha, autor, estado_nuevo, horas_sumadas, comentario });

const evidencia = (
  nombre_archivo: string,
  tipo_mime: string,
  peso_kb: number,
  url_storage: string,
  fecha_carga: string,
): EvidenciaAdjunta => ({ nombre_archivo, tipo_mime, peso_kb, url_storage, fecha_carga });

const base = (
  _id: string,
  folio: string,
  titulo: string,
  descripcion: string,
  categoria: CategoriaIncidencia,
  prioridad: Prioridad,
  estado: EstadoIncidencia,
  horas_invertidas: number,
  fecha_creacion: string,
  reportante: { id_usuario: string; nombre: string; rol: RolReportante; correo: string },
  ubicacion: UbicacionCampus,
  detalle_especifico: IncidenciaCampus["detalle_especifico"],
  tags: string[],
  historial_seguimiento: HistorialSeguimiento[],
  evidencias_adjuntas: EvidenciaAdjunta[],
  fecha_resolucion?: string,
): IncidenciaCampus => ({
  _id,
  folio,
  titulo,
  descripcion,
  categoria,
  prioridad,
  estado,
  horas_invertidas,
  fecha_creacion,
  ...(fecha_resolucion ? { fecha_resolucion } : {}),
  reportante,
  ubicacion,
  detalle_especifico,
  tags,
  historial_seguimiento,
  evidencias_adjuntas,
});

export const INCIDENCIAS_INICIALES: IncidenciaDetalle[] = [
  base(
    "65fabc001infra0001",
    "INC-2026-0001",
    "Filtración de agua en laboratorio de electrónica",
    "Se reporta filtración sobre el plafón del laboratorio y humedad cerca de los contactos eléctricos.",
    "infraestructura",
    "critica",
    "resuelta",
    4.5,
    "2026-03-18T08:30:00-06:00",
    { id_usuario: "u-ana-lopez", nombre: "Ana López", rol: "Docente", correo: "ana.lopez@utm.mx" },
    { edificio: "Edificio B", piso: "Nivel 2", aula_laboratorio: "Lab. Electrónica 2" },
    { tipo_dano: "Filtración en plafón y muro norte", riesgo_seguridad: "Alto", requiere_insumos: true, contratista_externo: true },
    ["seguridad", "mantenimiento", "agua"],
    [
      evento("2026-03-18T08:45:00-06:00", "Ana López", "en proceso", 2, "La filtración aumentó después de la lluvia."),
      evento("2026-03-18T10:22:00-06:00", "Carlos Ramírez", "resuelta", 2.5, "Se aisló el contacto y se selló la filtración."),
    ],
    [
      evidencia("filtracion-lab-electronica.jpg", "image/jpeg", 1840, "incidencias/INC-2026-0001/filtracion-lab-electronica.jpg", "2026-03-18T08:43:00-06:00"),
      evidencia("reporte-mantenimiento.pdf", "application/pdf", 620, "incidencias/INC-2026-0001/reporte-mantenimiento.pdf", "2026-03-18T10:25:00-06:00"),
    ],
    "2026-03-18T10:22:00-06:00",
  ),
  base(
    "65fabc002red0002",
    "INC-2026-0002",
    "Intermitencia en switch de distribución del laboratorio",
    "Pérdida intermitente de conectividad en los equipos del laboratorio de cómputo.",
    "computo_redes",
    "alta",
    "en proceso",
    2.5,
    "2026-03-18T09:30:00-06:00",
    { id_usuario: "u-marco-santos", nombre: "Marco Santos", rol: "Administrativo", correo: "marco.santos@utm.mx" },
    { edificio: "Edificio C", piso: "Nivel 1", aula_laboratorio: "Lab. Cómputo 3" },
    { direccion_ip: "10.24.110.22", vlan: 40, puerto_uplink: "Gi0/48", equipos_afectados: 42 },
    ["red", "switch", "conectividad"],
    [evento("2026-03-18T10:14:00-06:00", "Jorge Méndez", "en proceso", 2.5, "Se confirmó la caída del puerto Gi0/48.")],
    [evidencia("captura-switch.png", "image/png", 930, "incidencias/INC-2026-0002/captura-switch.png", "2026-03-18T09:52:00-06:00")],
  ),
  base(
    "65fabc003acad0003",
    "INC-2026-0003",
    "Acceso intermitente a plataforma de aulas virtuales",
    "El grupo de Sistemas Operativos no puede completar actividades en la plataforma académica.",
    "academico",
    "media",
    "en espera",
    1,
    "2026-03-17T14:00:00-06:00",
    { id_usuario: "u-lucia-garcia", nombre: "Lucía García", rol: "Docente", correo: "lucia.garcia@utm.mx" },
    { edificio: "Edificio A", piso: "Nivel 3", aula_laboratorio: "Aula A-304" },
    { plataforma: "Moodle UTM", codigo_curso: "SIS-402", periodo_escolar: "2026-1", estudiantes_impactados: 38 },
    ["Moodle", "clase", "acceso"],
    [evento("2026-03-17T16:30:00-06:00", "Sofía Ortiz", "en espera", 1, "Se solicitó evidencia de error a la coordinación académica.")],
    [evidencia("error-moodle.pdf", "application/pdf", 410, "incidencias/INC-2026-0003/error-moodle.pdf", "2026-03-17T14:05:00-06:00")],
  ),
];

export function getIncidencia(id: string) {
  return INCIDENCIAS_INICIALES.find((incidencia) => incidencia._id === id || incidencia.folio === id);
}
