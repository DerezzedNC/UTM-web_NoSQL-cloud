import { actualizarTagsDb } from "@/lib/incidencias/db";
import { hasPermission, type FrontendRole } from "@/lib/rbac";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const role = request.headers.get("x-user-role") as FrontendRole | null;
  if (role && !hasPermission(role, "incidencia:tags")) {
    return Response.json({ error: "Tu rol no puede gestionar etiquetas." }, { status: 403 });
  }
  const body = (await request.json()) as { action?: "add" | "remove"; tag?: string };
  const tag = body.tag?.trim();
  if (!tag || !body.action) {
    return Response.json({ error: "tag y action son obligatorios" }, { status: 400 });
  }

  try {
    const tags = await actualizarTagsDb(id, body.action, tag);
    if (!tags) return Response.json({ error: "Incidencia no encontrada" }, { status: 404 });
    return Response.json({ data: tags });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "No se pudieron actualizar las etiquetas.";
    return Response.json({ error: msg }, { status: 500 });
  }
}
