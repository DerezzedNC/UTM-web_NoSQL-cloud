export const PRIORIDADES = ["baja", "media", "alta", "critica"] as const;
export const CATEGORIAS = [
  "computo_redes",
  "infraestructura",
  "academico",
] as const;
export const NIVELES_RIESGO = ["Bajo", "Medio", "Alto", "Crítico"] as const;

export type Prioridad = (typeof PRIORIDADES)[number];
export type CategoriaIncidencia = (typeof CATEGORIAS)[number];
export type NivelRiesgo = (typeof NIVELES_RIESGO)[number];

export type UbicacionCampus = {
  edificio: string;
  piso: string;
  aula_laboratorio: string;
};

export type DetalleComputoRedes = {
  direccion_ip: string;
  vlan: string;
  puerto_uplink: string;
  equipos_afectados: string[];
};

export type DetalleInfraestructura = {
  tipo_dano: string;
  riesgo_seguridad: NivelRiesgo;
  requiere_insumos: boolean;
  insumos_solicitados: string[];
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

export type IncidenciaCampus = {
  titulo: string;
  descripcion: string;
  prioridad: Prioridad;
  categoria: CategoriaIncidencia;
  ubicacion: UbicacionCampus;
  detalle_especifico: DetalleEspecifico;
};

export type BorradorIncidencia = {
  titulo: string;
  descripcion: string;
  prioridad: Prioridad | "";
  categoria: CategoriaIncidencia | "";
  ubicacion: UbicacionCampus;
  detalle_computo: DetalleComputoRedes;
  detalle_infraestructura: DetalleInfraestructura;
  detalle_academico: DetalleAcademico;
};
