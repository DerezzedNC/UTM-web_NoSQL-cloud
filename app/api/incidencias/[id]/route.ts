import { PRIORIDAD_META, TECNICOS_DISPONIBLES } from "@/lib/incidencias/constants";
import { getIncidencia } from "@/lib/incidencias/mock-data";
import { PRIORIDADES, type Prioridad } from "@/lib/incidencias/types";
import { hasPermission, type FrontendRole } from "@/lib/rbac";

const RIESGOS = ["Bajo", "Medio", "Alto", "Crítico"] as const;

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const incidencia = getIncidencia(id);
  if (!incidencia) {
    return Response.json({ error: "Incidencia no encontrada" }, { status: 404 });
  }
  return Response.json({ data: incidencia });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const incidencia = getIncidencia(id);
  if (!incidencia) {
    return Response.json({ error: "Incidencia no encontrada" }, { status: 404 });
  }

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

  const cambios: string[] = [];

  if (body.prioridad && PRIORIDADES.includes(body.prioridad) && body.prioridad !== incidencia.prioridad) {
    incidencia.prioridad = body.prioridad;
    cambios.push(`Prioridad definida como ${PRIORIDAD_META[body.prioridad].etiqueta}`);
  }

  if (typeof body.id_tecnico === "string") {
    if (!body.id_tecnico) {
      delete incidencia.tecnico_asignado;
      cambios.push("Se retiró la asignación de técnico");
    } else {
      const tecnico = TECNICOS_DISPONIBLES.find((item) => item.id_usuario === body.id_tecnico);
      if (!tecnico) {
        return Response.json({ error: "Técnico seleccionado no válido." }, { status: 400 });
      }
      if (incidencia.tecnico_asignado?.id_usuario !== tecnico.id_usuario) {
        incidencia.tecnico_asignado = tecnico;
        cambios.push(`Asignada a ${tecnico.nombre}`);
      }
    }
  }

  if (
    body.riesgo_seguridad &&
    RIESGOS.includes(body.riesgo_seguridad as (typeof RIESGOS)[number]) &&
    "riesgo_seguridad" in incidencia.detalle_especifico &&
    incidencia.detalle_especifico.riesgo_seguridad !== body.riesgo_seguridad
  ) {
    incidencia.detalle_especifico.riesgo_seguridad = body.riesgo_seguridad;
    cambios.push(`Riesgo de seguridad evaluado como ${body.riesgo_seguridad}`);
  }

  if (cambios.length > 0) {
    incidencia.historial_seguimiento.unshift({
      fecha: new Date().toLocaleString("es-MX"),
      autor: body.autor?.trim() || "Coordinación",
      estado_nuevo: incidencia.estado,
      horas_sumadas: 0,
      comentario: `${cambios.join(" · ")}.`,
    });
  }

  return Response.json({ data: incidencia });
}

