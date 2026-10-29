import { INCIDENCIAS_INICIALES } from "@/lib/incidencias/mock-data";

const normalizar = (value: string) => value.trim().toLocaleLowerCase("es-MX");

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = normalizar(searchParams.get("q") ?? "");
  const categoria = searchParams.get("categoria") ?? "";
  const estado = searchParams.get("estado") ?? "";
  const edificio = normalizar(searchParams.get("edificio") ?? "");
  const rol = searchParams.get("rol") ?? "";
  const idUsuario = normalizar(searchParams.get("id_usuario") ?? "");
  const correo = normalizar(searchParams.get("correo") ?? "");

  const data = INCIDENCIAS_INICIALES
    .map((incidencia) => {
      const titulo = normalizar(incidencia.titulo);
      const descripcion = normalizar(incidencia.descripcion);
      const relevance = q
        ? (titulo.includes(q) ? 10 : 0) + (descripcion.includes(q) ? 5 : 0)
        : 0;
      return { incidencia, relevance };
    })
    .filter(({ incidencia, relevance }) => {
      if (rol === "reportante") {
        const esSuya =
          normalizar(incidencia.reportante.id_usuario) === idUsuario ||
          normalizar(incidencia.reportante.correo) === correo;
        if (!esSuya) return false;
      }
      if (rol === "tecnico") {
        const asignadaAEl =
          incidencia.tecnico_asignado &&
          (normalizar(incidencia.tecnico_asignado.id_usuario) === idUsuario ||
            normalizar(incidencia.tecnico_asignado.correo) === correo);
        if (!asignadaAEl) return false;
      }
      return (
        (!q || relevance > 0) &&
        (!categoria || incidencia.categoria === categoria) &&
        (!estado || incidencia.estado === estado) &&
        (!edificio || normalizar(incidencia.ubicacion.edificio).includes(edificio))
      );
    })
    .sort((a, b) => b.relevance - a.relevance || b.incidencia.fecha_creacion.localeCompare(a.incidencia.fecha_creacion))
    .map(({ incidencia }) => incidencia);

  return Response.json({ data });
}
