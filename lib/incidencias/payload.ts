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
    reportante: borrador.reportante,
  };

  if (borrador.categoria === "computo_redes") {
    return {
      ...base,
      categoria: "computo_redes",
      detalle_especifico: {
        direccion_ip: borrador.detalle_computo.direccion_ip,
        vlan: Number(borrador.detalle_computo.vlan),
        puerto_uplink: borrador.detalle_computo.puerto_uplink,
        equipos_afectados: borrador.detalle_computo.equipos_afectados.length,
      },
    };
  }

  if (borrador.categoria === "infraestructura") {
    return {
      ...base,
      categoria: "infraestructura",
      detalle_especifico: borrador.detalle_infraestructura,
    };
  }

  return {
    ...base,
    categoria: "academico",
    detalle_especifico: borrador.detalle_academico,
  };
}
