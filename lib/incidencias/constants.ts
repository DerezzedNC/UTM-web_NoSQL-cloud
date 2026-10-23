import type { CategoriaIncidencia, Prioridad } from "./types";

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

export const BORRADOR_INICIAL = {
  titulo: "",
  descripcion: "",
  prioridad: "" as const,
  categoria: "" as const,
  ubicacion: {
    edificio: "",
    piso: "",
    aula_laboratorio: "",
  },
  detalle_computo: {
    direccion_ip: "",
    vlan: "",
    puerto_uplink: "",
    equipos_afectados: [] as string[],
  },
  detalle_infraestructura: {
    tipo_dano: "",
    riesgo_seguridad: "Medio" as const,
    requiere_insumos: false,
    insumos_solicitados: [] as string[],
    contratista_externo: false,
  },
  detalle_academico: {
    plataforma: "",
    codigo_curso: "",
    periodo_escolar: "",
    estudiantes_impactados: 0,
  },
};
