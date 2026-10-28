import { getIncidencia, type EstadoIncidencia } from "@/lib/incidencias/mock-data";
import { canCloseTicket, hasPermission, type FrontendRole } from "@/lib/rbac";

const ESTADOS: EstadoIncidencia[] = ["abierta", "en proceso", "en espera", "resuelta", "cerrada"];

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const incidencia = getIncidencia(id);
  if (!incidencia) return Response.json({ error: "Incidencia no encontrada" }, { status: 404 });
  const role = request.headers.get("x-user-role") as FrontendRole | null;
  if (role && !hasPermission(role, "incidencia:update")) return Response.json({ error: "Tu rol no puede actualizar el estado." }, { status: 403 });
  const body = (await request.json()) as { estado_nuevo?: EstadoIncidencia; horas_sumadas?: number; comentario?: string; autor?: string };
  if (!body.estado_nuevo || !ESTADOS.includes(body.estado_nuevo) || !body.comentario?.trim() || typeof body.horas_sumadas !== "number" || body.horas_sumadas < 0) {
    return Response.json({ error: "estado_nuevo, horas_sumadas y comentario son obligatorios" }, { status: 400 });
  }
  if (role === "tecnico" && body.estado_nuevo === "cerrada") return Response.json({ error: "El rol Técnico solo puede avanzar hasta resuelta." }, { status: 403 });
  if (body.estado_nuevo === "cerrada" && role && !canCloseTicket(role)) return Response.json({ error: "Solo Coordinador o Administrador pueden cerrar definitivamente." }, { status: 403 });
  incidencia.estado = body.estado_nuevo;
  incidencia.horas_invertidas += body.horas_sumadas;
  if (body.estado_nuevo === "resuelta" || body.estado_nuevo === "cerrada") incidencia.fecha_resolucion = new Date().toISOString();
  if (body.estado_nuevo !== "resuelta" && body.estado_nuevo !== "cerrada") delete incidencia.fecha_resolucion;
  incidencia.historial_seguimiento.unshift({ fecha: new Date().toLocaleString("es-MX"), autor: body.autor ?? "Usuario actual", estado_nuevo: body.estado_nuevo, horas_sumadas: body.horas_sumadas, comentario: body.comentario.trim() });
  return Response.json({ data: incidencia });
}
