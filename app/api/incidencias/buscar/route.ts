import { listarIncidenciasDb } from "@/lib/incidencias/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  try {
    const data = await listarIncidenciasDb({
      q: searchParams.get("q") ?? "",
      categoria: searchParams.get("categoria") ?? "",
      estado: searchParams.get("estado") ?? "",
      edificio: searchParams.get("edificio") ?? "",
      rol: searchParams.get("rol") ?? "",
      id_usuario: searchParams.get("id_usuario") ?? "",
      correo: searchParams.get("correo") ?? "",
    });
    return Response.json({ data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error al consultar incidencias.";
    return Response.json({ error: msg }, { status: 500 });
  }
}
