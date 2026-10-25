import type { CategoriaIncidencia, Prioridad, UbicacionCampus } from "./types";

export type RolUsuario = "admin" | "directiva" | "coordinador" | "tecnico" | "reportante";
export type EstadoIncidencia = "abierta" | "en_proceso" | "en_espera" | "resuelta" | "cerrada";

export type EvidenciaAdjunta = {
  nombre_archivo: string;
  tipo_mime: "image/png" | "image/jpeg" | "application/pdf";
  peso_kb: number;
  fecha_carga: string;
  storage_key: string;
};

export type HistorialEvento = {
  fecha: string;
  autor: string;
  estado_nuevo: EstadoIncidencia;
  horas_sumadas: number;
  comentario: string;
};

export type IncidenciaDetalle = {
  _id: string;
  folio: string;
  titulo: string;
  descripcion: string;
  prioridad: Prioridad;
  estado: EstadoIncidencia;
  categoria: CategoriaIncidencia;
  tags: string[];
  horas_invertidas: number;
  fecha_resolucion?: string;
  evidencias_adjuntas: EvidenciaAdjunta[];
  ubicacion: UbicacionCampus;
  reportante: { id_usuario: string; nombre: string; correo: string; cargo: string };
  tecnico_asignado: { id_usuario: string; nombre: string; correo: string; area: string } | null;
  detalle_especifico:
    | { direccion_ip: string; vlan: string; puerto_uplink: string; equipos_afectados: string[] }
    | { tipo_dano: string; riesgo_seguridad: string; requiere_insumos: boolean; insumos_solicitados: string[]; contratista_externo: boolean }
    | { plataforma: string; codigo_curso: string; periodo_escolar: string; estudiantes_impactados: number };
  historial_seguimiento: HistorialEvento[];
};

export const INCIDENCIAS_INICIALES: IncidenciaDetalle[] = [
  {
    _id: "65fabc001infra0001", folio: "INC-2026-0001", titulo: "Filtración de agua en laboratorio de electrónica",
    descripcion: "Se reporta filtración sobre el plafón del laboratorio y humedad cerca de los contactos eléctricos. El área fue delimitada para evitar riesgos durante la jornada.",
    prioridad: "critica", estado: "resuelta", categoria: "infraestructura", tags: ["seguridad", "mantenimiento", "agua"], horas_invertidas: 4.5, fecha_resolucion: "2026-03-18T10:22:00-06:00",
    evidencias_adjuntas: [
      { nombre_archivo: "filtracion-lab-electronica.jpg", tipo_mime: "image/jpeg", peso_kb: 1840, fecha_carga: "18/03/2026 08:43", storage_key: "incidencias/INC-2026-0001/filtracion-lab-electronica.jpg" },
      { nombre_archivo: "reporte-mantenimiento.pdf", tipo_mime: "application/pdf", peso_kb: 620, fecha_carga: "18/03/2026 10:25", storage_key: "incidencias/INC-2026-0001/reporte-mantenimiento.pdf" },
    ],
    ubicacion: { edificio: "Edificio B", piso: "Nivel 2", aula_laboratorio: "Lab. Electrónica 2" },
    reportante: { id_usuario: "u-ana-lopez", nombre: "Ana López", correo: "ana.lopez@utm.mx", cargo: "Docente de Ingeniería" },
    tecnico_asignado: { id_usuario: "u-carlos-ramirez", nombre: "Carlos Ramírez", correo: "carlos.ramirez@utm.mx", area: "infraestructura" },
    detalle_especifico: { tipo_dano: "Filtración en plafón y muro norte", riesgo_seguridad: "Alto", requiere_insumos: true, insumos_solicitados: ["Sellador impermeable", "Escalera dieléctrica"], contratista_externo: true },
    historial_seguimiento: [
      { fecha: "18/03/2026 10:22", autor: "Carlos Ramírez", estado_nuevo: "resuelta", horas_sumadas: 2.5, comentario: "Se aisló el contacto eléctrico, se selló la filtración y se liberó el laboratorio." },
      { fecha: "18/03/2026 08:45", autor: "Ana López", estado_nuevo: "en_proceso", horas_sumadas: 2, comentario: "La filtración aumentó después de la lluvia de esta mañana." },
    ],
  },
  {
    _id: "65fabc002red0002", folio: "INC-2026-0002", titulo: "Intermitencia en switch de distribución del laboratorio",
    descripcion: "Pérdida intermitente de conectividad en los equipos del laboratorio de cómputo. La incidencia afecta las clases prácticas del turno matutino.",
    prioridad: "alta", estado: "en_proceso", categoria: "computo_redes", tags: ["red", "switch", "conectividad"], horas_invertidas: 2.5,
    evidencias_adjuntas: [{ nombre_archivo: "captura-snmp-switch.png", tipo_mime: "image/png", peso_kb: 930, fecha_carga: "18/03/2026 09:52", storage_key: "incidencias/INC-2026-0002/captura-snmp-switch.png" }],
    ubicacion: { edificio: "Edificio C", piso: "Nivel 1", aula_laboratorio: "Lab. Cómputo 3" },
    reportante: { id_usuario: "u-marco-santos", nombre: "Marco Santos", correo: "marco.santos@utm.mx", cargo: "Coordinador de laboratorio" },
    tecnico_asignado: { id_usuario: "u-jorge-mendez", nombre: "Jorge Méndez", correo: "jorge.mendez@utm.mx", area: "computo_redes" },
    detalle_especifico: { direccion_ip: "10.24.110.22", vlan: "40, 112, 115", puerto_uplink: "Gi0/48", equipos_afectados: ["42 clientes", "2 puntos de acceso"] },
    historial_seguimiento: [{ fecha: "18/03/2026 10:14", autor: "Jorge Méndez", estado_nuevo: "en_proceso", horas_sumadas: 2.5, comentario: "Se confirmó la caída del puerto Gi0/48 y se inició diagnóstico del transceiver." }],
  },
  {
    _id: "65fabc003acad0003", folio: "INC-2026-0003", titulo: "Acceso intermitente a plataforma de aulas virtuales",
    descripcion: "El grupo de Sistemas Operativos no puede completar actividades en la plataforma académica. El fallo ocurre únicamente durante la sesión de este curso.",
    prioridad: "media", estado: "en_espera", categoria: "academico", tags: ["Moodle", "clase", "acceso"], horas_invertidas: 1,
    evidencias_adjuntas: [{ nombre_archivo: "error-moodle.pdf", tipo_mime: "application/pdf", peso_kb: 410, fecha_carga: "17/03/2026 14:05", storage_key: "incidencias/INC-2026-0003/error-moodle.pdf" }],
    ubicacion: { edificio: "Edificio A", piso: "Nivel 3", aula_laboratorio: "Aula A-304" },
    reportante: { id_usuario: "u-lucia-garcia", nombre: "Lucía García", correo: "lucia.garcia@utm.mx", cargo: "Docente de Sistemas" },
    tecnico_asignado: { id_usuario: "u-sofia-ortiz", nombre: "Sofía Ortiz", correo: "sofia.ortiz@utm.mx", area: "academico" },
    detalle_especifico: { plataforma: "Moodle UTM", codigo_curso: "SIS-402", periodo_escolar: "2026-1", estudiantes_impactados: 38 },
    historial_seguimiento: [{ fecha: "17/03/2026 16:30", autor: "Sofía Ortiz", estado_nuevo: "en_espera", horas_sumadas: 1, comentario: "Se solicitó evidencia de error a la coordinación académica." }],
  },
];

export function getIncidencia(id: string) {
  return INCIDENCIAS_INICIALES.find((incidencia) => incidencia._id === id || incidencia.folio === id);
}
