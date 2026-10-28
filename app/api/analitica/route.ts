import { INCIDENCIAS_INICIALES } from "@/lib/incidencias/mock-data";

const RESUELTOS = new Set(["resuelta", "cerrada"]);

export async function GET() {
  const edificios = new Map<string, { edificio: string; tickets_resueltos_cerrados: number; horas_totales: number }>();
  const tags = new Map<string, number>();

  for (const incidencia of INCIDENCIAS_INICIALES) {
    for (const tag of incidencia.tags) tags.set(tag, (tags.get(tag) ?? 0) + 1);
    if (!RESUELTOS.has(incidencia.estado)) continue;
    const current = edificios.get(incidencia.ubicacion.edificio) ?? {
      edificio: incidencia.ubicacion.edificio,
      tickets_resueltos_cerrados: 0,
      horas_totales: 0,
    };
    current.tickets_resueltos_cerrados += 1;
    current.horas_totales += incidencia.horas_invertidas;
    edificios.set(incidencia.ubicacion.edificio, current);
  }

  return Response.json({
    eficiencia_por_edificio: [...edificios.values()].map((item) => ({
      ...item,
      promedio_horas: item.tickets_resueltos_cerrados
        ? item.horas_totales / item.tickets_resueltos_cerrados
        : 0,
    })),
    top_tags: [...tags.entries()]
      .map(([tag, frecuencia]) => ({ tag, frecuencia }))
      .sort((a, b) => b.frecuencia - a.frecuencia || a.tag.localeCompare(b.tag))
      .slice(0, 10),
  });
}
