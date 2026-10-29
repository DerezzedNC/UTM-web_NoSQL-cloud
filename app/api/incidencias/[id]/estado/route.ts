import { actualizarEstadoDb } from "@/lib/incidencias/db";
import type { EstadoIncidencia } from "@/lib/incidencias/types";
import { canCloseTicket, hasPermission, type FrontendRole } from "@/lib/rbac";

const ESTADOS: EstadoIncidencia[] = ["abierta", "en proceso", "en espera", "resuelta", "cerrada"];

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const role = request.headers.get("x-user-role") as FrontendRole | null;
  if (role && !hasPermission(role, "incidencia:update")) {
    return Response.json({ error: "Tu rol no puede actualizar el estado." }, { status: 403 });
  }

  const body = (await request.json()) as {
    estado_nuevo?: EstadoIncidencia;
    horas_sumadas?: number;
    comentario?: string;
    autor?: string;
  };
  if (
    !body.estado_nuevo ||
    !ESTADOS.includes(body.estado_nuevo) ||
    !body.comentario?.trim() ||
    typeof body.horas_sumadas !== "number" ||
    body.horas_sumadas < 0
  ) {
    return Response.json({ error: "estado_nuevo, horas_sumadas y comentario son obligatorios" }, { status: 400 });
  }
  if (role === "tecnico" && body.estado_nuevo === "cerrada") {
    return Response.json({ error: "El rol Técnico solo puede avanzar hasta resuelta." }, { status: 403 });
  }
  if (body.estado_nuevo === "cerrada" && role && !canCloseTicket(role)) {
    return Response.json({ error: "Solo Coordinador o Administrador pueden cerrar definitivamente." }, { status: 403 });
  }

  try {
    const updated = await actualizarEstadoDb(id, {
      estado_nuevo: body.estado_nuevo,
      horas_sumadas: body.horas_sumadas,
      comentario: body.comentario,
      autor: body.autor ?? "Usuario actual",
    });
    if (!updated) return Response.json({ error: "Incidencia no encontrada" }, { status: 404 });
    return Response.json({ data: updated });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "No se pudo actualizar el estado en MongoDB.";
    return Response.json({ error: msg }, { status: 500 });
  }
}
