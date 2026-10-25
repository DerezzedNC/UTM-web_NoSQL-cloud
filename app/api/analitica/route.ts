import { INCIDENCIAS_INICIALES } from "@/lib/incidencias/mock-data";

export async function GET() {
  const porEdificio = Array.from(
    INCIDENCIAS_INICIALES.reduce(
      (map, incidencia) => {
        const key = incidencia.ubicacion.edificio;
        const current = map.get(key) ?? {
          edificio: key,
          total: 0,
          resueltos: 0,
          horas_invertidas: 0,
        };
        current.total += 1;
        current.resueltos += incidencia.estado === "resuelta" || incidencia.estado === "cerrada" ? 1 : 0;
        current.horas_invertidas += incidencia.horas_invertidas;
        map.set(key, current);
        return map;
      },
      new Map<
        string,
        { edificio: string; total: number; resueltos: number; horas_invertidas: number }
      >(),
    ).values(),
  );

  const tags = new Map<string, number>();
  for (const incidencia of INCIDENCIAS_INICIALES) {
    for (const tag of incidencia.tags) tags.set(tag, (tags.get(tag) ?? 0) + 1);
  }

  const total = INCIDENCIAS_INICIALES.length;
  const activas = INCIDENCIAS_INICIALES.filter((item) =>
    ["abierta", "en_proceso", "en_espera"].includes(item.estado),
  ).length;
  const resueltas = INCIDENCIAS_INICIALES.filter((item) =>
    ["resuelta", "cerrada"].includes(item.estado),
  ).length;
  const horas = INCIDENCIAS_INICIALES.reduce((sum, item) => sum + item.horas_invertidas, 0);

  return Response.json({
    data: {
      kpis: {
        total,
        activas,
        horas_invertidas: horas,
        promedio_horas: total ? horas / total : 0,
        tasa_resolucion: total ? (resueltas / total) * 100 : 0,
        criticas_altas_pendientes: INCIDENCIAS_INICIALES.filter(
          (item) =>
            ["critica", "alta"].includes(item.prioridad) &&
            ["abierta", "en_proceso", "en_espera"].includes(item.estado),
        ).length,
      },
      por_edificio: porEdificio,
      top_tags: [...tags.entries()]
        .map(([tag, cantidad]) => ({ tag, cantidad }))
        .sort((a, b) => b.cantidad - a.cantidad)
        .slice(0, 10),
      por_categoria: [
        "computo_redes",
        "infraestructura",
        "academico",
      ].map((categoria) => ({
        categoria,
        total: INCIDENCIAS_INICIALES.filter((item) => item.categoria === categoria).length,
      })),
      criticas_activas: INCIDENCIAS_INICIALES.filter(
        (item) =>
          ["critica", "alta"].includes(item.prioridad) &&
          ["abierta", "en_proceso", "en_espera"].includes(item.estado),
      ),
    },
    ventana_ttl_dias: 60,
  });
}
