import { getIncidencia, type EvidenciaAdjunta } from "@/lib/incidencias/mock-data";

const MIME_PERMITIDOS = ["image/png", "image/jpeg", "application/pdf"];

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const incidencia = getIncidencia(id);
  if (!incidencia) return Response.json({ error: "Incidencia no encontrada" }, { status: 404 });
  const body = (await request.json()) as Partial<EvidenciaAdjunta>;
  if (!body.nombre_archivo || !body.tipo_mime || !MIME_PERMITIDOS.includes(body.tipo_mime) || typeof body.peso_kb !== "number" || body.peso_kb > 5120) {
    return Response.json({ error: "Formato no permitido o archivo mayor a 5120 KB" }, { status: 400 });
  }
  const evidencia: EvidenciaAdjunta = { nombre_archivo: body.nombre_archivo, tipo_mime: body.tipo_mime, peso_kb: body.peso_kb, fecha_carga: new Date().toLocaleString("es-MX"), storage_key: `incidencias/${incidencia.folio}/${body.nombre_archivo}` };
  incidencia.evidencias_adjuntas.push(evidencia);
  return Response.json({ data: evidencia }, { status: 201 });
}
