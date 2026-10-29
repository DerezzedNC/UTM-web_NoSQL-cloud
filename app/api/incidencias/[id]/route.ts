import { actualizarTriageDb, obtenerIncidenciaDb } from "@/lib/incidencias/db";
import type { Prioridad } from "@/lib/incidencias/types";
import { hasPermission, type FrontendRole } from "@/lib/rbac";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  try {
    const incidencia = await obtenerIncidenciaDb(id);
    if (!incidencia) {
      return Response.json({ error: "Incidencia no encontrada" }, { status: 404 });
    }
    return Response.json({ data: incidencia });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error al leer el expediente.";
    return Response.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const role = request.headers.get("x-user-role") as FrontendRole | null;
  if (!role || !hasPermission(role, "incidencia:triage")) {
    return Response.json(
      { error: "Solo el Coordinador o Administrador pueden clasificar y asignar incidencias." },
      { status: 403 },
    );
  }

  const body = (await request.json()) as {
    prioridad?: Prioridad;
    id_tecnico?: string;
    riesgo_seguridad?: string;
    autor?: string;
  };

  try {
    const result = await actualizarTriageDb(id, body);
    if (result.error) {
      return Response.json({ error: result.error }, { status: result.status ?? 400 });
    }
    return Response.json({ data: result.data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "No se pudo actualizar la asignación.";
    return Response.json({ error: msg }, { status: 500 });
  }
}
