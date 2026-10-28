export const PRIORIDADES = ["baja", "media", "alta", "critica"] as const;
export const CATEGORIAS = [
  "computo_redes",
  "infraestructura",
  "academico",
] as const;
export const ESTADOS_INCIDENCIA = [
  "abierta",
  "en proceso",
  "en espera",
  "resuelta",
  "cerrada",
] as const;
export const ROLES_REPORTANTE = ["Docente", "Estudiante", "Administrativo"] as const;

export type Prioridad = (typeof PRIORIDADES)[number];
export type CategoriaIncidencia = (typeof CATEGORIAS)[number];
export type EstadoIncidencia = (typeof ESTADOS_INCIDENCIA)[number];
export type RolReportante = (typeof ROLES_REPORTANTE)[number];

export type UbicacionCampus = {
  edificio: string;
  piso: string;
  aula_laboratorio: string;
};

export type DetalleComputoRedes = {
  direccion_ip: string;
  vlan: number;
  puerto_uplink: string;
  equipos_afectados: number;
};

export type DetalleInfraestructura = {
  tipo_dano: string;
  riesgo_seguridad: string;
  requiere_insumos: boolean;
  contratista_externo: boolean;
};

export type DetalleAcademico = {
  plataforma: string;
  codigo_curso: string;
  periodo_escolar: string;
  estudiantes_impactados: number;
};

export type DetalleEspecifico =
  | DetalleComputoRedes
  | DetalleInfraestructura
  | DetalleAcademico;

export type HistorialSeguimiento = {
  fecha: string;
  autor: string;
  estado_nuevo: EstadoIncidencia;
  horas_sumadas: number;
  comentario: string;
};

export type EvidenciaAdjunta = {
  nombre_archivo: string;
  tipo_mime: string;
  peso_kb: number;
  url_storage: string;
  fecha_carga: string;
};

export type IncidenciaCampus = {
  _id: string;
  folio: string;
  titulo: string;
  descripcion: string;
  prioridad: Prioridad;
  categoria: CategoriaIncidencia;
  estado: EstadoIncidencia;
  horas_invertidas: number;
  fecha_creacion: string;
  fecha_resolucion?: string;
  reportante: {
    id_usuario: string;
    nombre: string;
    rol: RolReportante;
    correo: string;
  };
  ubicacion: UbicacionCampus;
  detalle_especifico: DetalleEspecifico;
  tags: string[];
  historial_seguimiento: HistorialSeguimiento[];
  evidencias_adjuntas: EvidenciaAdjunta[];
};

export type BorradorDetalleComputo = Omit<DetalleComputoRedes, "vlan" | "equipos_afectados"> & {
  vlan: string;
  equipos_afectados: string[];
};

export type BorradorDetalleInfraestructura = DetalleInfraestructura;

export type BorradorIncidencia = {
  titulo: string;
  descripcion: string;
  prioridad: Prioridad | "";
  categoria: CategoriaIncidencia | "";
  ubicacion: UbicacionCampus;
  reportante: {
    id_usuario: string;
    nombre: string;
    rol: RolReportante;
    correo: string;
  };
  detalle_computo: BorradorDetalleComputo;
  detalle_infraestructura: BorradorDetalleInfraestructura;
  detalle_academico: DetalleAcademico;
};
