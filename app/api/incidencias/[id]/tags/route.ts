import { getIncidencia } from "@/lib/incidencias/mock-data";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const incidencia = getIncidencia(id);
  if (!incidencia) return Response.json({ error: "Incidencia no encontrada" }, { status: 404 });
  const body = (await request.json()) as { action?: "add" | "remove"; tag?: string };
  const tag = body.tag?.trim();
  if (!tag || !body.action) return Response.json({ error: "tag y action son obligatorios" }, { status: 400 });
  if (body.action === "add" && !incidencia.tags.includes(tag)) incidencia.tags.push(tag);
  if (body.action === "remove") incidencia.tags = incidencia.tags.filter((item) => item !== tag);
  return Response.json({ data: incidencia.tags });
}
