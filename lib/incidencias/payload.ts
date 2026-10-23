import type { IncidenciaCampusPayload } from "./schema";
import type { BorradorIncidencia } from "./types";

export function armarPayload(
  borrador: BorradorIncidencia,
): IncidenciaCampusPayload | null {
  if (!borrador.prioridad || !borrador.categoria) {
    return null;
  }

  const base = {
    titulo: borrador.titulo,
    descripcion: borrador.descripcion,
    prioridad: borrador.prioridad,
    ubicacion: borrador.ubicacion,
  };

  if (borrador.categoria === "computo_redes") {
    return {
      ...base,
      categoria: "computo_redes",
      detalle_especifico: borrador.detalle_computo,
    };
  }

  if (borrador.categoria === "infraestructura") {
    return {
      ...base,
      categoria: "infraestructura",
      detalle_especifico: {
        ...borrador.detalle_infraestructura,
        insumos_solicitados: borrador.detalle_infraestructura.requiere_insumos
          ? borrador.detalle_infraestructura.insumos_solicitados
          : [],
      },
    };
  }

  return {
    ...base,
    categoria: "academico",
    detalle_especifico: borrador.detalle_academico,
  };
}
