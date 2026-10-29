import { crearIncidenciaDb } from "@/lib/incidencias/db";
import { registroIncidenciaSchema } from "@/lib/incidencias/registro-schema";

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

  try {
    const created = await crearIncidenciaDb(result.data);
    return Response.json({ data: created }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "No se pudo guardar en MongoDB.";
    return Response.json({ error: msg }, { status: 500 });
  }
}
