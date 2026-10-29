import { registroIncidenciaSchema } from "@/lib/incidencias/registro-schema";
import { INCIDENCIAS_INICIALES } from "@/lib/incidencias/mock-data";
import type { IncidenciaCampus } from "@/lib/incidencias/types";

export async function POST(request: Request) {
  const role = request.headers.get("x-user-role");
  if (role !== "reportante" && role !== "admin") {
    return Response.json(
      { error: "Solo reportante y admin pueden registrar incidencias." },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "El cuerpo debe ser JSON válido." }, { status: 400 });
  }
  const result = registroIncidenciaSchema.safeParse(body);

  if (!result.success) {
    return Response.json(
      { error: "El payload no cumple el esquema de incidencias_campus.", issues: result.error.flatten() },
      { status: 400 },
    );
  }

  const now = new Date().toISOString();
  const year = new Date().getFullYear();
  const nextNumber = INCIDENCIAS_INICIALES.length + 1;
  const folio = `INC-${year}-${String(nextNumber).padStart(4, "0")}`;
  const { evidencias, ...restData } = result.data;
  const created: IncidenciaCampus = {
    _id: `mock-${crypto.randomUUID()}`,
    folio,
    ...restData,
    estado: "abierta" as const,
    horas_invertidas: 0,
    fecha_creacion: now,
    historial_seguimiento: [{
      fecha: now,
      autor: result.data.reportante.nombre,
      estado_nuevo: "abierta" as const,
      horas_sumadas: 0,
      comentario: "Incidencia creada.",
    }],
    evidencias_adjuntas: (evidencias ?? []).map((item) => ({
      nombre_archivo: item.nombre_archivo,
      tipo_mime: item.tipo_mime,
      peso_kb: item.peso_kb,
      url_storage: `incidencias/${folio}/${item.nombre_archivo}`,
      fecha_carga: now,
    })),
  };
  INCIDENCIAS_INICIALES.push(created);
  return Response.json(
    { data: created },
    { status: 201 },
  );
}
