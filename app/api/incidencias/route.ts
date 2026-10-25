import { registroIncidenciaSchema } from "@/lib/incidencias/registro-schema";

let consecutivo = 4;

export async function POST(request: Request) {
  const role = request.headers.get("x-user-role");
  if (role !== "reportante" && role !== "admin") {
    return Response.json(
      { error: "Solo reportante y admin pueden registrar incidencias." },
      { status: 403 },
    );
  }

  const body: unknown = await request.json();
  const result = registroIncidenciaSchema.safeParse(body);

  if (!result.success) {
    return Response.json(
      { error: "El payload no cumple el esquema de incidencias_campus.", issues: result.error.flatten() },
      { status: 400 },
    );
  }

  const folio = `INC-${new Date().getFullYear()}-${String(consecutivo++).padStart(4, "0")}`;
  return Response.json(
    { data: { _id: `mock-${crypto.randomUUID()}`, folio, ...result.data } },
    { status: 201 },
  );
}
