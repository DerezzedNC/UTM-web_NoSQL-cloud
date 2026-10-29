import type { RegistroIncidenciaPayload } from "./registro-schema";
import type { BorradorIncidencia } from "./types";

export function armarPayload(
  borrador: BorradorIncidencia,
): RegistroIncidenciaPayload | null {
  if (!borrador.categoria) {
    return null;
  }

  const base = {
    titulo: borrador.titulo,
    descripcion: borrador.descripcion,
    prioridad: borrador.prioridad || ("media" as const),
    tags: [] as string[],
    ubicacion: borrador.ubicacion,
    reportante: {
      id_usuario: borrador.reportante.id_usuario,
      nombre: borrador.reportante.nombre,
      rol_institucional: (borrador.reportante.rol_institucional ?? borrador.reportante.rol) as "Docente" | "Estudiante" | "Administrativo",
      rol: (borrador.reportante.rol ?? borrador.reportante.rol_institucional) as "Docente" | "Estudiante" | "Administrativo",
      correo: borrador.reportante.correo,
    },
    evidencias: borrador.evidencias.map((ev) => ({
      nombre_archivo: ev.nombre_archivo,
      tipo_mime: ev.tipo_mime as "image/png" | "image/jpeg" | "application/pdf",
      peso_kb: ev.peso_kb,
      ...(ev.contenido_base64 ? { contenido_base64: ev.contenido_base64 } : {}),
    })),
  };

  if (borrador.categoria === "computo_redes") {
    return {
      ...base,
      categoria: "computo_redes",
      detalle_especifico: {
        direccion_ip: borrador.detalle_computo.direccion_ip,
        vlan: Number(borrador.detalle_computo.vlan) || 1,
        puerto_uplink: borrador.detalle_computo.puerto_uplink,
        equipos_afectados: Math.max(1, borrador.detalle_computo.equipos_afectados.length),
      },
    };
  }

  if (borrador.categoria === "infraestructura") {
    const rawRiesgo = borrador.detalle_infraestructura.riesgo_seguridad;
    const riesgoNormalizado = (rawRiesgo === "Crítico" ? "Critico" : rawRiesgo) as "Bajo" | "Medio" | "Alto" | "Critico";
    return {
      ...base,
      categoria: "infraestructura",
      detalle_especifico: {
        ...borrador.detalle_infraestructura,
        riesgo_seguridad: riesgoNormalizado,
        insumos_solicitados: borrador.detalle_infraestructura.insumos_solicitados ?? [],
      },
    };
  }

  return {
    ...base,
    categoria: "academico",
    detalle_especifico: {
      ...borrador.detalle_academico,
      estudiantes_impactados: Math.max(1, borrador.detalle_academico.estudiantes_impactados || 1),
    },
  };
}
