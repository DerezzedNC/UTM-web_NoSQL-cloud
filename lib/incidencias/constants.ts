import type { BorradorIncidencia, CategoriaIncidencia, Prioridad, TecnicoAsignado } from "./types";

export const CATEGORIA_META: Record<
  CategoriaIncidencia,
  { etiqueta: string; resumen: string }
> = {
  computo_redes: {
    etiqueta: "Cómputo y redes",
    resumen: "IP, VLAN, uplink y equipos de red afectados.",
  },
  infraestructura: {
    etiqueta: "Infraestructura",
    resumen: "Daños físicos, riesgo e insumos de obra o mantenimiento.",
  },
  academico: {
    etiqueta: "Académico",
    resumen: "Plataformas, cursos y estudiantes impactados.",
  },
};

export const PRIORIDAD_META: Record<
  Prioridad,
  { etiqueta: string; clase: string }
> = {
  baja: {
    etiqueta: "Baja",
    clase:
      "border-emerald-200 bg-emerald-50 text-emerald-800 data-[selected=true]:border-emerald-500 data-[selected=true]:ring-emerald-200",
  },
  media: {
    etiqueta: "Media",
    clase:
      "border-amber-200 bg-amber-50 text-amber-900 data-[selected=true]:border-amber-500 data-[selected=true]:ring-amber-200",
  },
  alta: {
    etiqueta: "Alta",
    clase:
      "border-orange-200 bg-orange-50 text-orange-900 data-[selected=true]:border-orange-500 data-[selected=true]:ring-orange-200",
  },
  critica: {
    etiqueta: "Crítica",
    clase:
      "border-rose-200 bg-rose-50 text-rose-800 data-[selected=true]:border-rose-500 data-[selected=true]:ring-rose-200",
  },
};

export const TECNICOS_DISPONIBLES: TecnicoAsignado[] = [
  {
    id_usuario: "TEC-0205",
    nombre: "Ing. Roberto Pech Moo",
    correo: "roberto.pech@utm.edu.mx",
    area: "computo_redes",
  },
  {
    id_usuario: "TEC-0412",
    nombre: "Téc. Miguel Balam Dzib",
    correo: "miguel.balam@utm.edu.mx",
    area: "infraestructura",
  },
  {
    id_usuario: "TEC-0518",
    nombre: "Lic. Sofía Ortiz Lara",
    correo: "sofia.ortiz@utm.edu.mx",
    area: "academico",
  },
];

export const BORRADOR_INICIAL: BorradorIncidencia = {
  titulo: "",
  descripcion: "",
  prioridad: "media",
  categoria: "",
  ubicacion: {
    edificio: "",
    piso: "",
    aula_laboratorio: "",
  },
  reportante: {
    id_usuario: "",
    nombre: "",
    rol_institucional: "Docente",
    rol: "Docente",
    correo: "",
  },
  evidencias: [],
  detalle_computo: {
    direccion_ip: "",
    vlan: "",
    puerto_uplink: "",
    equipos_afectados: [],
  },
  detalle_infraestructura: {
    tipo_dano: "",
    riesgo_seguridad: "Medio",
    requiere_insumos: false,
    contratista_externo: false,
  },
  detalle_academico: {
    plataforma: "",
    codigo_curso: "",
    periodo_escolar: "",
    estudiantes_impactados: 0,
  },
};
