import { obtenerAnaliticaDb } from "@/lib/incidencias/db";

export async function GET() {
  try {
    const report = await obtenerAnaliticaDb();
    return Response.json(report);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error al generar analítica.";
    return Response.json({ error: msg }, { status: 500 });
  }
}
