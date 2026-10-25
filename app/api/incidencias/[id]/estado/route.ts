import { getIncidencia, type EstadoIncidencia } from "@/lib/incidencias/mock-data";

const ESTADOS: EstadoIncidencia[] = ["abierta", "en_proceso", "en_espera", "resuelta", "cerrada"];

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const incidencia = getIncidencia(id);
  if (!incidencia) return Response.json({ error: "Incidencia no encontrada" }, { status: 404 });
  const body = (await request.json()) as { estado_nuevo?: EstadoIncidencia; horas_sumadas?: number; comentario?: string; autor?: string };
  if (!body.estado_nuevo || !ESTADOS.includes(body.estado_nuevo) || !body.comentario?.trim() || typeof body.horas_sumadas !== "number" || body.horas_sumadas < 0) {
    return Response.json({ error: "estado_nuevo, horas_sumadas y comentario son obligatorios" }, { status: 400 });
  }
  incidencia.estado = body.estado_nuevo;
  incidencia.horas_invertidas += body.horas_sumadas;
  if (body.estado_nuevo === "resuelta") incidencia.fecha_resolucion = new Date().toISOString();
  if (body.estado_nuevo !== "resuelta") delete incidencia.fecha_resolucion;
  incidencia.historial_seguimiento.unshift({ fecha: new Date().toLocaleString("es-MX"), autor: body.autor ?? "Usuario actual", estado_nuevo: body.estado_nuevo, horas_sumadas: body.horas_sumadas, comentario: body.comentario.trim() });
  return Response.json({ data: incidencia });
}
